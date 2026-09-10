// Local message/tool-call/interrupt/voice shapes for the chat component
// library. Not taken from @personaai/react's types — platform/ is
// Clerk-authed against agent-backend's /api/v1/projects/* admin routes, not
// the machine-credential Developer Platform API that package talks to.
// Whatever hook eventually parses raw AG-UI SSE events (mirroring
// frontend/src/components/agents/agui/AguiAgentChat.jsx) is responsible for
// producing these shapes; this library only ever renders them.

export type ChatRole = "user" | "assistant" | "system";

export interface ChatToolCall {
  id: string;
  name: string;
  /** Raw JSON string, as streamed — parsed for display where needed. */
  args?: string;
  /** Raw JSON string result, once the call finishes. */
  result?: string;
  status: "running" | "done" | "error";
  /** Present only for the `task` (subagent) tool — its own nested timeline. */
  subagentMessages?: ChatMessageData[];
  /** Present when this tool is backed by an interactive MCP Ext App. */
  mcpApp?: { resourceUri?: string; mcpId?: string; initialHtml?: string };
}

export interface ChatTodo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/**
 * A model "thinking" segment attached to an assistant message. Mirrors the
 * hook's `role:"reasoning"` messages: content streamed in via REASONING_*
 * events, `startedAt` the wall-clock open time, and `durationMs` stamped once
 * the backend closes the block (REASONING_END) — undefined while still live.
 */
export interface ChatReasoning {
  id: string;
  content: string;
  /** True while the block is the open tail of a live run (no end yet). */
  isStreaming?: boolean;
  startedAt?: number;
  durationMs?: number;
}

export interface ChatMessageData {
  id: string;
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
  toolCalls?: ChatToolCall[];
  /** Thinking/reasoning tokens that preceded this reply (may still stream). */
  reasoning?: ChatReasoning[];
}

export interface ChatClarificationQuestion {
  id?: string;
  question: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  allowCustom?: boolean;
  required?: boolean;
}

export interface ChatHitlAction {
  id: string;
  /** Humanized tool name, used only for the Approve/Reject buttons' aria-label. */
  label: string;
  /** Raw tool name (e.g. "upsert_agent") — lets the panel render this pending
   * call through the same ToolCallCard used for a completed one. */
  toolName: string;
  /** Raw JSON string of the tool call's arguments — the same shape
   * ToolCallCard renders as "Input" for a completed call, so an approval
   * request reads like the tool card the human is being asked to approve. */
  args?: string;
}

export type ChatInterruptData =
  | { kind: "hitl"; actionRequests: ChatHitlAction[] }
  | { kind: "clarification"; questions: ChatClarificationQuestion[] };

export type VoiceCallState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";
