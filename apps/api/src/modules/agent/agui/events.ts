import { EventType } from '@ag-ui/core';

/**
 * AG-UI events, as this API emits them.
 *
 * The vocabulary comes from `@ag-ui/core` so a standard AG-UI client can read
 * the stream without knowing anything about Swasthya Saathi. Only the subset
 * that a single agent with tools actually produces is built here -- there are
 * no subagents and no steps worth naming, so the `STEP_*` and `ACTIVITY_*`
 * families are deliberately unused rather than emitted empty.
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
  index: number,
  toolName: string,
  args: unknown,
  description: string,
): AguiEvent =>
  event(EventType.CUSTOM, {
    name: 'tool.confirmation_required',
    // By position: the interrupt carries no id, and the decisions sent back
    // are matched to the pending actions by order.
    value: { index, toolName, args, description },
  });

/**
 * The agent's workspace as it now stands.
 *
 * Sent once the run settles so a client sees files that appeared during it
 * without refetching the whole conversation.
 */
export const stateSnapshot = (files: unknown, todos: unknown): AguiEvent =>
  event(EventType.STATE_SNAPSHOT, { snapshot: { files, todos } });

/**
 * One part of the workspace changed, mid-run.
 *
 * A patch rather than a snapshot because a snapshot replaces the whole state:
 * announcing a new plan that way would blank the files the agent had already
 * written, and announcing a new file would blank the plan. `add` rather than
 * `replace` since the client may not hold the key yet, and on a key it does
 * hold `add` overwrites -- `replace` on a missing path is invalid and would
 * be dropped.
 */
export const stateDelta = (
  path: '/files' | '/todos',
  value: unknown,
): AguiEvent =>
  event(EventType.STATE_DELTA, { delta: [{ op: 'add', path, value }] });

/** The agent asking the app to open a file it just wrote. */
export const filePresented = (
  filePath: string,
  title: string,
  description: string,
): AguiEvent =>
  event(EventType.CUSTOM, {
    name: 'file.presented',
    value: { filePath, title, description },
  });

/** Lets the session list rename itself mid-stream instead of refetching. */
export const sessionTitled = (sessionId: string, title: string): AguiEvent =>
  event(EventType.CUSTOM, {
    name: 'session.title',
    value: { sessionId, title },
  });
