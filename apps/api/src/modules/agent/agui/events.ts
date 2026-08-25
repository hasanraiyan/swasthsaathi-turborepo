import { EventType } from '@ag-ui/core';

/**
 * AG-UI events, as this API emits them.
 *
 * The vocabulary comes from `@ag-ui/core` so a standard AG-UI client can read
 * the stream without knowing anything about Swasthya Saathi. Only the subset
 * that a single agent with tools actually produces is built here -- there are
 * no subagents, no shared state document and no human-in-the-loop graph, so
 * the `STEP_*`, `STATE_DELTA` and `ACTIVITY_*` families are deliberately
 * unused rather than emitted empty.
 */
export interface AguiEvent {
  type: EventType;
  timestamp: number;
  [key: string]: unknown;
}

function event(type: EventType, fields: Record<string, unknown>): AguiEvent {
  return { type, timestamp: Date.now(), ...fields };
}

export const runStarted = (threadId: string, runId: string): AguiEvent =>
  event(EventType.RUN_STARTED, { threadId, runId });

export const runFinished = (threadId: string, runId: string): AguiEvent =>
  event(EventType.RUN_FINISHED, { threadId, runId });

export const runError = (message: string, code?: string): AguiEvent =>
  event(EventType.RUN_ERROR, { message, ...(code ? { code } : {}) });

export const textMessageStart = (messageId: string): AguiEvent =>
  event(EventType.TEXT_MESSAGE_START, { messageId, role: 'assistant' });

export const textMessageContent = (
  messageId: string,
  delta: string,
): AguiEvent => event(EventType.TEXT_MESSAGE_CONTENT, { messageId, delta });

export const textMessageEnd = (messageId: string): AguiEvent =>
  event(EventType.TEXT_MESSAGE_END, { messageId });

export const toolCallStart = (
  toolCallId: string,
  toolCallName: string,
  parentMessageId: string,
): AguiEvent =>
  event(EventType.TOOL_CALL_START, {
    toolCallId,
    toolCallName,
    parentMessageId,
  });

export const toolCallArgs = (toolCallId: string, delta: string): AguiEvent =>
  event(EventType.TOOL_CALL_ARGS, { toolCallId, delta });

export const toolCallEnd = (toolCallId: string): AguiEvent =>
  event(EventType.TOOL_CALL_END, { toolCallId });

export const toolCallResult = (
  messageId: string,
  toolCallId: string,
  content: string,
): AguiEvent =>
  event(EventType.TOOL_CALL_RESULT, {
    messageId,
    toolCallId,
    content,
    role: 'tool',
  });

/**
 * A write the user has not seen yet. The run stops here rather than acting on
 * their health record unasked; the client answers through `/agent/resume`.
 */
export const confirmationRequired = (
  toolCallId: string,
  toolCallName: string,
  args: unknown,
  description: string,
): AguiEvent =>
  event(EventType.CUSTOM, {
    name: 'tool.confirmation_required',
    value: { toolCallId, toolCallName, args, description },
  });

/** Lets the session list rename itself mid-stream instead of refetching. */
export const sessionTitled = (sessionId: string, title: string): AguiEvent =>
  event(EventType.CUSTOM, {
    name: 'session.title',
    value: { sessionId, title },
  });
