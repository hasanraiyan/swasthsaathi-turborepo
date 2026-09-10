"use client";

import * as React from "react";
import { api } from "@/lib/api/core";
import { useAguiChat } from "@/lib/agui/use-agui-chat";
import {
  toChatView,
  hitlInterruptFrom,
  clarificationInterruptFrom,
} from "@/lib/agui/chat-adapter";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
  type ChatInterruptData,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Sentinel whose dedicated "Project Agent Architect" graph the project-scoped
// /architect/agui route runs (agent-backend modules/agents/architectConstants.js
// PROJECT_ARCHITECT_AGENT_ID). It is not a real project Agent — it can't be
// picked from the project's agent list, only reached through the Architect
// endpoint — so it lives here as a constant rather than as list data.
const PROJECT_ARCHITECT_AGENT_ID = "000000000000000000000001";

/**
 * "Just the chat" surface for the Project Agent Architect — the spec bot that
 * creates/edits a project's Agents by conversation (its tools: upsert_agent,
 * get_agent). Mirrors AgentChat's text-chat plumbing against the
 * project-scoped `/architect/agui` AG-UI SSE endpoint, minus the per-agent
 * test affordances (no Voice tab, no workspace files / subagents).
 *
 * The Architect's conversation is one shared, deterministic server-side
 * thread per project (`architect-<domain>`), and every agent the bot creates
 * here is a real project Agent — the parent re-fetches the agent list (via
 * onAgentsRefreshed) whenever an upsert_agent tool call reports success, so
 * the new/updated Agent appears in the Playground picker.
 */
function ArchitectChat({
  projectId,
  onAgentsRefreshed,
}: {
  projectId: string;
  onAgentsRefreshed: () => void;
}) {
  const url = React.useMemo(
    () =>
      `${api.defaults.baseURL ?? "/api/v1"}/projects/${projectId}/architect/agui`,
    [projectId]
  );

  const chat = useAguiChat({
    url,
    agentId: PROJECT_ARCHITECT_AGENT_ID,
    getToken: React.useCallback(
      () =>
        typeof window !== "undefined"
          ? (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } })
              .Clerk?.session?.getToken?.() ?? Promise.resolve(null)
          : Promise.resolve(null),
      []
    ),
  });

  const { send, stop, respondToApproval, respondToClarification } = chat;

  const view = React.useMemo(
    () =>
      toChatView({
        messages: chat.messages,
        toolCalls: chat.toolCalls,
        conversation: chat.conversation,
        isRunning: chat.isRunning,
      }),
    [chat.messages, chat.toolCalls, chat.conversation, chat.isRunning]
  );

  // ── Composer ────────────────────────────────────────────────────────────
  const [input, setInput] = React.useState("");
  const handleSend = React.useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await send(text);
    } catch {
      // errors surface through chat.error
    }
  }, [input, send]);

  // ── Interrupts (HITL approval + clarification) ──────────────────────────
  // Same panel flow as AgentChat, but the per-interrupt buffers live in refs
  // keyed by the interrupt object's identity, so nothing needs a
  // reset-on-change effect (the Architect does pause to clarify before it
  // upserts an Agent).
  const interrupt = React.useMemo<ChatInterruptData | null>(() => {
    if (chat.pendingApproval) return hitlInterruptFrom(chat.pendingApproval);
    if (chat.pendingClarification?.questions?.length) {
      return clarificationInterruptFrom(chat.pendingClarification);
    }
    return null;
  }, [chat.pendingApproval, chat.pendingClarification]);

  // HITL: the whole request is answered at once — buffer one decision per
  // action (keyed by its positional id), then fire them all together.
  const hitlRef = React.useRef<{
    approval: object;
    decisions: Record<string, "approve" | "reject">;
    fired: boolean;
  } | null>(null);

  const handleDecideHitl = React.useCallback(
    (actionId: string, decision: "approve" | "reject") => {
      const approval = chat.pendingApproval;
      if (!approval) return;
      if (!hitlRef.current || hitlRef.current.approval !== approval) {
        hitlRef.current = { approval, decisions: {}, fired: false };
      }
      const held = hitlRef.current;
      if (held.fired) return;
      const next = { ...held.decisions, [actionId]: decision };
      held.decisions = next;
      const { actionRequests } = approval;
      const allDecided =
        actionRequests.length > 0 && actionRequests.every((_, i) => next[String(i)]);
      if (allDecided) {
        held.fired = true;
        void respondToApproval(
          actionRequests.map((_, i) =>
            next[String(i)] === "reject"
              ? { type: "reject", message: "Rejected by the developer." }
              : { type: "approve" }
          )
        );
      }
    },
    [chat.pendingApproval, respondToApproval]
  );

  // Clarification: the hook answers ONE question at a time, so the panel shows
  // a single-question wizard slice; each submit answers only the current step.
  // The busy flag lives in a ref so a second submit can't double-answer.
  const clarRef = React.useRef<{ clar: object; busy: boolean } | null>(null);

  const handleSubmitClarification = React.useCallback(
    (answers: Record<string, string>) => {
      const clar = chat.pendingClarification;
      if (!clar) return;
      if (!clarRef.current || clarRef.current.clar !== clar) {
        clarRef.current = { clar, busy: false };
      }
      const held = clarRef.current;
      if (held.busy) return;
      const q = clar.questions[clar.currentIndex || 0];
      if (!q) return;
      const value = answers[q.id ?? `q-${clar.currentIndex || 0}`];
      held.busy = true;
      if (value && value.trim()) {
        void respondToClarification({ answer: value.trim(), freeform: true });
      } else {
        void respondToClarification({ skipped: true });
      }
    },
    [chat.pendingClarification, respondToClarification]
  );

  const interruptKey = chat.pendingApproval
    ? "hitl"
    : `clar-${chat.pendingClarification?.currentIndex ?? 0}`;

  // ── Agent-list refresh on successful upsert ─────────────────────────────
  // The Architect's mutations all flow through its upsert_agent tool; when one
  // reports {status:"success"} the parent re-fetches the project's agents so
  // the new/updated Agent appears in the picker. Tracked per tool-call id so a
  // single upsert fires exactly one refresh (ids are run-local uuids, so the
  // set never needs clearing).
  const handledUpsertIds = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    for (const tc of chat.toolCalls) {
      if (tc.status !== "completed" || tc.name !== "upsert_agent") continue;
      if (handledUpsertIds.current.has(tc.id)) continue;
      handledUpsertIds.current.add(tc.id);
      let succeeded = false;
      try {
        const parsed = JSON.parse(tc.resultText) as { status?: string };
        succeeded = parsed?.status === "success";
      } catch {
        succeeded = false;
      }
      if (succeeded) onAgentsRefreshed();
    }
  }, [chat.toolCalls, onAgentsRefreshed]);

  const hasTranscript = view.turns.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {!hasTranscript ? (
          <ChatEmptyState
            title="Describe the agent you want"
            description="I'm the Agent Architect — describe what your agent should do and I'll create it (or update it) for you, wired to this project's tools and knowledge. The agents I make show up in the picker above, ready to test over chat or voice."
          />
        ) : (
          <ChatScroller>
            {view.turns.map((turn) => {
              const rows: React.ReactNode[] = [];
              if (turn.userMessage) {
                rows.push(
                  <ChatScrollerItem key={`${turn.key}-user`}>
                    <ChatMessage message={turn.userMessage} />
                  </ChatScrollerItem>
                );
              }
              const a = turn.assistantMessage;
              const hasVisual =
                !!a.content?.trim() ||
                !!a.isStreaming ||
                (a.reasoning?.length ?? 0) > 0 ||
                (a.toolCalls?.length ?? 0) > 0;
              if (hasVisual) {
                rows.push(
                  <ChatScrollerItem key={`${turn.key}-assistant`}>
                    <ChatMessage message={a} />
                  </ChatScrollerItem>
                );
              }
              return rows;
            })}
          </ChatScroller>
        )}
      </div>

      {/* px-4 matches ChatScroller's own message padding above, so the
          composer lines up with the message bubbles now that the page
          wrapper no longer adds its own horizontal padding on mobile. Bottom
          padding is capped to the safe-area inset (not a flat pb-4) so it
          doesn't carry extra dead space on top of that on a phone screen,
          while still clearing the home-indicator area. */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
        {interrupt && (
          <div className="mb-2">
            <InterruptPanel
              key={interruptKey}
              interrupt={interrupt}
              onSubmitClarification={handleSubmitClarification}
              onDecideHitl={handleDecideHitl}
            />
          </div>
        )}

        {chat.error && (
          <Alert variant="destructive" className="mb-2">
            <AlertTitle>Architect run failed</AlertTitle>
            <AlertDescription>{chat.error}</AlertDescription>
          </Alert>
        )}

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stop}
          isStreaming={chat.isRunning}
          placeholder="Describe an agent…"
        />
      </div>
    </div>
  );
}

export { ArchitectChat };
