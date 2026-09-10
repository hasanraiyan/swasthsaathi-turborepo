"use client";

import * as React from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { api } from "@/lib/api/core";
import {
  useAguiChat,
  type ChatMessage as HookChatMessage,
  type ToolCall as HookToolCall,
  type ConversationEntry as HookConversationEntry,
} from "@/lib/agui/use-agui-chat";
import {
  toChatView,
  hitlInterruptFrom,
  clarificationInterruptFrom,
  subagentMessagesForToolId,
} from "@/lib/agui/chat-adapter";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
  SubagentSheet,
  type ChatMessageData,
  type ChatInterruptData,
  type ChatToolCall,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getProjectAgentThreadMessages } from "@/lib/api/projects";

function normalizeCheckpointData(data: unknown): {
  messages: HookChatMessage[];
  toolCalls: HookToolCall[];
  conversation: HookConversationEntry[];
  agentState: Record<string, unknown>;
} {
  const messages: HookChatMessage[] = [];
  const toolCalls: HookToolCall[] = [];
  const conversation: HookConversationEntry[] = [];

  if (!data || typeof data !== "object") {
    return { messages, toolCalls, conversation, agentState: {} };
  }

  const raw = data as {
    messages?: Array<{
      id?: string;
      role?: string;
      content?: string;
      toolCalls?: Array<{
        toolCallId?: string;
        toolName?: string;
        args?: string;
        result?: string;
      }>;
    }>;
    state?: Record<string, unknown>;
    subagentTraces?: Record<string, unknown[]>;
  };

  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
  const subagentTraces = raw.subagentTraces || {};
  const agentState = typeof raw.state === "object" && raw.state !== null ? raw.state : {};

  rawMessages.forEach((msg, idx) => {
    if (!msg) return;
    const role = msg.role === "user" ? "user" : "assistant";
    const content = typeof msg.content === "string" ? msg.content : "";
    const msgId = msg.id || `${role}-${idx}-${Date.now()}`;

    if (role === "user") {
      messages.push({
        id: msgId,
        role: "user",
        content,
        timestamp: Date.now(),
      });
      conversation.push({ id: `entry-${msgId}`, type: "message", refId: msgId });
    } else {
      if (Array.isArray(msg.toolCalls)) {
        msg.toolCalls.forEach((tc) => {
          if (!tc) return;
          const tcId = tc.toolCallId || `tool-${Math.random().toString(16).slice(2)}`;
          const tcName = tc.toolName || "tool";
          const argsText = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args || {});
          const resultText = typeof tc.result === "string" ? tc.result : "";

          toolCalls.push({
            id: tcId,
            name: tcName,
            argumentsText: argsText,
            resultText,
            status: "completed",
            subEvents: Array.isArray(subagentTraces[tcId])
              ? (subagentTraces[tcId] as HookToolCall["subEvents"])
              : undefined,
          });
          conversation.push({ id: `entry-${tcId}`, type: "tool", refId: tcId });
        });
      }

      if (content || !msg.toolCalls?.length) {
        messages.push({
          id: msgId,
          role: "assistant",
          content,
          timestamp: Date.now(),
        });
        conversation.push({ id: `entry-${msgId}`, type: "message", refId: msgId });
      }
    }
  });

  return { messages, toolCalls, conversation, agentState };
}

/**
 * Live text-chat for one Agent — runs `useAguiChat` against the backend's
 * `test/agui` SSE endpoint and folds its AG-UI state into the render shapes
 * the chat component library consumes (see lib/agui/chat-adapter.ts).
 */
function AgentChatInner({
  projectId,
  agentId,
  threadId,
  initialMessages,
  initialAgentState,
  onToolCallsChange,
  onOpenFile,
  onWorkspaceFilesChange,
  onTitleGenerated,
}: {
  projectId: string;
  agentId: string;
  threadId?: string;
  initialMessages?: {
    messages: HookChatMessage[];
    toolCalls: HookToolCall[];
    conversation: HookConversationEntry[];
  };
  initialAgentState?: Record<string, unknown>;
  /** Bubbles the live, deduped tool-call list up for the Terminal panel — fires on every change. */
  onToolCallsChange?: (toolCalls: ChatToolCall[]) => void;
  /** present_file's card Open button — bubbles the path up instead of showing it in a local Sheet. */
  onOpenFile?: (path: string) => void;
  /** Bubbles the live agent filesystem up (for the Files sidebar to show real, current content) — fires on every change. */
  onWorkspaceFilesChange?: (
    files: Record<string, { content: string; size: number; createdAt: string | null; modifiedAt: string | null }>
  ) => void;
  /** Fires when AG-UI emits an auto-generated thread title. */
  onTitleGenerated?: (title: string) => void;
}) {
  const url = React.useMemo(
    () =>
      `${api.defaults.baseURL ?? "/api/v1"}/projects/${projectId}/agents/${agentId}/test/agui`,
    [projectId, agentId]
  );

  const chat = useAguiChat({
    url,
    agentId,
    threadId,
    initialMessages,
    initialAgentState,
    onTitleGenerated,
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

  // chat.* are state arrays — stable references between commits — so the
  // adapter re-runs only when the underlying transcript/tool list moves.
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

  React.useEffect(() => {
    onToolCallsChange?.(Array.from(view.toolCallsById.values()));
  }, [view.toolCallsById, onToolCallsChange]);

  React.useEffect(() => {
    if (onWorkspaceFilesChange && chat.agentState?.files) {
      onWorkspaceFilesChange(
        chat.agentState.files as Record<
          string,
          { content: string; size: number; createdAt: string | null; modifiedAt: string | null }
        >
      );
    }
  }, [chat.agentState?.files, onWorkspaceFilesChange]);

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

  const handleWidgetSendMessage = React.useCallback(
    async (text: string) => {
      try {
        await send(text);
      } catch {
        // errors surface through chat.error
      }
    },
    [send]
  );

  // ── Interrupts (HITL approval + clarification) ──────────────────────────
  const interrupt = React.useMemo<ChatInterruptData | null>(() => {
    if (chat.pendingApproval) return hitlInterruptFrom(chat.pendingApproval);
    if (chat.pendingClarification?.questions?.length) {
      return clarificationInterruptFrom(chat.pendingClarification);
    }
    return null;
  }, [chat.pendingApproval, chat.pendingClarification]);

  // HITL: the whole request is answered at once — buffer one decision per
  // action (keyed by its positional id), then fire them all together.
  const [hitlDecisions, setHitlDecisions] = React.useState<Record<string, "approve" | "reject">>({});
  const hitlFiredRef = React.useRef(false);
  React.useEffect(() => {
    setHitlDecisions({});
    hitlFiredRef.current = false;
  }, [chat.pendingApproval]);

  const handleDecideHitl = React.useCallback(
    (actionId: string, decision: "approve" | "reject") => {
      if (!chat.pendingApproval || hitlFiredRef.current) return;
      const next = { ...hitlDecisions, [actionId]: decision };
      setHitlDecisions(next);
      const { actionRequests } = chat.pendingApproval;
      const allDecided =
        actionRequests.length > 0 && actionRequests.every((_, i) => next[String(i)]);
      if (!allDecided) return;
      hitlFiredRef.current = true;
      void respondToApproval(
        actionRequests.map((_, i) =>
          next[String(i)] === "reject"
            ? { type: "reject", message: "Rejected by the developer." }
            : { type: "approve" }
        )
      );
    },
    [chat.pendingApproval, hitlDecisions, respondToApproval]
  );

  // Clarification: the hook answers ONE question at a time, so the panel shows
  // a single-question wizard slice; each submit answers only the current step.
  const [clarBusy, setClarBusy] = React.useState(false);
  React.useEffect(() => {
    setClarBusy(false);
  }, [chat.pendingClarification]);

  const handleSubmitClarification = React.useCallback(
    (answers: Record<string, string>) => {
      if (!chat.pendingClarification || clarBusy) return;
      const q =
        chat.pendingClarification.questions[chat.pendingClarification.currentIndex || 0];
      if (!q) return;
      const value = answers[q.id ?? `q-${chat.pendingClarification.currentIndex || 0}`];
      setClarBusy(true);
      if (value && value.trim()) {
        void respondToClarification({ answer: value.trim(), freeform: true });
      } else {
        void respondToClarification({ skipped: true });
      }
    },
    [chat.pendingClarification, clarBusy, respondToClarification]
  );

  const interruptKey = chat.pendingApproval
    ? "hitl"
    : `clar-${chat.pendingClarification?.currentIndex ?? 0}`;

  // ── Subagent sheet + workspace files (Files sidebar, not a local Sheet) ──
  const [openToolId, setOpenToolId] = React.useState<string | null>(null);

  const agentFiles = React.useMemo(() => {
    const files = chat.agentState?.files;
    return (files ?? {}) as Record<
      string,
      { content?: string; size?: number; created_at?: string | null; modified_at?: string | null }
    >;
  }, [chat.agentState]);

  React.useEffect(() => {
    if (!onWorkspaceFilesChange) return;
    const normalized: Record<
      string,
      { content: string; size: number; createdAt: string | null; modifiedAt: string | null }
    > = {};
    for (const [path, file] of Object.entries(agentFiles)) {
      normalized[path] = {
        content: file.content ?? "",
        size: file.size ?? 0,
        createdAt: file.created_at ?? null,
        modifiedAt: file.modified_at ?? null,
      };
    }
    onWorkspaceFilesChange(normalized);
  }, [agentFiles, onWorkspaceFilesChange]);

  const subagentMessages: ChatMessageData[] = React.useMemo(() => {
    if (!openToolId) return [];
    return subagentMessagesForToolId(view, openToolId) ?? [];
  }, [view, openToolId]);

  const hasTranscript = view.turns.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {!hasTranscript ? (
          <ChatEmptyState
            title="Test your agent"
            description="This runs the agent live against its real tools and knowledge. Ask anything to start a thread."
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
                    <ChatMessage
                      message={a}
                      todos={turn.todos.length ? turn.todos : undefined}
                      projectId={projectId}
                      onOpenSubagent={setOpenToolId}
                      onOpenWorkspaceFile={onOpenFile}
                      onSendMessage={handleWidgetSendMessage}
                    />
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
            <AlertTitle>Agent run failed</AlertTitle>
            <AlertDescription>{chat.error}</AlertDescription>
          </Alert>
        )}

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stop}
          isStreaming={chat.isRunning}
          placeholder="Ask your agent…"
        />
      </div>

      <SubagentSheet
        open={!!openToolId}
        onOpenChange={(open) => {
          if (!open) setOpenToolId(null);
        }}
        messages={subagentMessages}
      />
    </div>
  );
}

/**
 * Top-level AgentChat component with conversation thread history support.
 * When `threadId` is supplied, fetches past messages and checkpoint state before
 * mounting the streaming chat interface.
 */
function AgentChat({
  projectId,
  agentId,
  threadId,
  onToolCallsChange,
  onOpenFile,
  onWorkspaceFilesChange,
  onTitleGenerated,
}: {
  projectId: string;
  agentId: string;
  threadId?: string;
  onToolCallsChange?: (toolCalls: ChatToolCall[]) => void;
  onOpenFile?: (path: string) => void;
  onWorkspaceFilesChange?: (
    files: Record<string, { content: string; size: number; createdAt: string | null; modifiedAt: string | null }>
  ) => void;
  /** Fires when AG-UI emits an auto-generated thread title. */
  onTitleGenerated?: (title: string) => void;
}) {
  const [initialData, setInitialData] = React.useState<{
    messages: HookChatMessage[];
    toolCalls: HookToolCall[];
    conversation: HookConversationEntry[];
    agentState: Record<string, unknown>;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = React.useState(Boolean(threadId));

  React.useEffect(() => {
    if (!threadId) {
      setInitialData(null);
      setLoadingHistory(false);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    getProjectAgentThreadMessages(projectId, agentId, threadId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setInitialData(normalizeCheckpointData(data));
      })
      .catch((err) => {
        console.error("Failed to load thread messages:", err);
        if (!cancelled) setInitialData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId, threadId]);

  if (loadingHistory) {
    return (
      <div className="flex h-full min-h-[350px] flex-col items-center justify-center p-8 text-muted-foreground gap-2.5">
        <SpinnerIcon className="size-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Loading conversation history…</span>
      </div>
    );
  }

  return (
    <AgentChatInner
      key={`${agentId}-${threadId ?? "default"}`}
      projectId={projectId}
      agentId={agentId}
      threadId={threadId}
      initialMessages={initialData ?? undefined}
      initialAgentState={initialData?.agentState}
      onToolCallsChange={onToolCallsChange}
      onOpenFile={onOpenFile}
      onWorkspaceFilesChange={onWorkspaceFilesChange}
      onTitleGenerated={onTitleGenerated}
    />
  );
}

export { AgentChat };

