import { HttpAgent } from '@ag-ui/client';
import type { Message, RunAgentInput, State } from '@ag-ui/core';
import type { AgentFile, AgentTodo, TranscriptTurn } from '@repo/contracts';

import { resolveBaseUrl } from './api';

/**
 * The API's agent, as an AG-UI client.
 *
 * Extends the SDK's `HttpAgent` rather than parsing the stream by hand: it
 * already accumulates streamed text, reassembles fragmented tool-call
 * arguments and applies state snapshots, and it verifies the event sequence
 * on the way through, so a protocol mistake surfaces as an error instead of a
 * quietly malformed transcript.
 *
 * Streaming works on device because Expo SDK 57 replaces the global `fetch`
 * with `expo/fetch`, whose `Response.body` is a real `ReadableStream`.
 * React Native's own fetch has no readable body, and the SDK needs one.
 */

export interface ApprovalDecision {
  type: 'approve' | 'reject';
  message?: string;
}

export class SwasthyaAgent extends HttpAgent {
  private readonly getToken: () => Promise<string | null>;
  private readonly baseUrl: string;
  private runs = 0;

  constructor(sessionId: string, getToken: () => Promise<string | null>) {
    const baseUrl = resolveBaseUrl();
    super({
      // `agentId`, `threadId` and every `runId` below are passed explicitly
      // on purpose. Left out, the SDK fills them in with `uuid`, which needs
      // `crypto.getRandomValues` -- absent in React Native, so it would throw
      // on the first run. These ids are correlation handles rather than
      // secrets, so a counter is the honest way to make them; nothing here
      // should look like it is producing random values when it is not.
      agentId: 'swasthya-saathi',
      threadId: sessionId,
      url: `${baseUrl}/agent/run`,
    });
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  /** Ask a question and stream the answer. */
  async ask(text: string): Promise<void> {
    this.addMessage({ id: this.localId('msg'), role: 'user', content: text });
    await this.authorize();
    await this.runAgent({ runId: this.localId('run') });
  }

  /**
   * Answer the writes the run stopped on.
   *
   * One decision per pending action, in the order they were offered -- the
   * interrupt carries no id, so position is the only thing tying an answer to
   * what it answers.
   */
  async decide(decisions: ApprovalDecision[]): Promise<void> {
    await this.authorize();
    await this.runAgent({
      runId: this.localId('run'),
      forwardedProps: { decisions },
    });
  }

  /** Starting or answering a run are different endpoints on this API. */
  override run(input: RunAgentInput) {
    this.url = `${this.baseUrl}/agent/${isResume(input) ? 'resume' : 'run'}`;
    return super.run(input);
  }

  /**
   * The API takes a message or a set of decisions, not a whole AG-UI run
   * input: the conversation lives in the agent's checkpointer, keyed by the
   * session, so replaying the transcript on every turn would only give the
   * server a second, less trustworthy copy of what it already has.
   */
  protected override requestInit(input: RunAgentInput): RequestInit {
    const body = isResume(input)
      ? { sessionId: input.threadId, decisions: decisionsOf(input) }
      : { sessionId: input.threadId, message: lastUserMessage(input.messages) };

    return {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      // Kept from the base implementation: this is what `abortRun()` trips.
      signal: this.abortController.signal,
    };
  }

  /** Headers are built once per run, since the token can have expired. */
  private async authorize(): Promise<void> {
    const token = await this.getToken();
    this.headers = {
      ...this.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private localId(prefix: string): string {
    this.runs += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.runs}`;
  }
}

function isResume(input: RunAgentInput): boolean {
  return decisionsOf(input).length > 0;
}

function decisionsOf(input: RunAgentInput): ApprovalDecision[] {
  const props = input.forwardedProps as { decisions?: ApprovalDecision[] } | undefined;
  return props?.decisions ?? [];
}

function lastUserMessage(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return typeof message.content === 'string' ? message.content : '';
    }
  }
  return '';
}

/**
 * AG-UI messages, as the transcript renders them.
 *
 * The protocol keeps a tool call and its result in separate messages; the
 * components take one row per call with its result folded in, which is also
 * what `GET /sessions/:id/messages` returns. Doing the same folding here is
 * what makes a live answer and the same answer after a reload look identical.
 */
export function turnsFrom(messages: Message[]): TranscriptTurn[] {
  const results = new Map<string, { content: string; isError: boolean }>();
  for (const message of messages) {
    if (message.role === 'tool') {
      results.set(message.toolCallId, {
        content: typeof message.content === 'string' ? message.content : '',
        isError: Boolean(message.error) || looksLikeError(message.content),
      });
    }
  }

  const turns: TranscriptTurn[] = [];
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }

    const toolCalls = (message.role === 'assistant' ? (message.toolCalls ?? []) : []).map(
      (call) => {
        const result = results.get(call.id);
        return {
          toolCallId: call.id,
          // The wire name is mangled to satisfy OpenAI's function-name rules.
          toolName: call.function.name.replace(/__/g, '.'),
          args: parseArgs(call.function.arguments),
          result: result?.content ?? null,
          isError: result?.isError ?? false,
        };
      },
    );

    // Assistant messages either side of a tool call are one reply, and are
    // merged the way the API merges them when it rebuilds a conversation.
    const previous = turns.at(-1);
    if (message.role === 'assistant' && previous?.role === 'assistant') {
      previous.content = [previous.content, message.content]
        .filter((part) => typeof part === 'string' && part.trim())
        .join('\n\n');
      previous.toolCalls.push(...toolCalls);
      continue;
    }

    turns.push({
      id: message.id,
      role: message.role,
      content: typeof message.content === 'string' ? message.content : '',
      toolCalls,
    });
  }

  return turns;
}

/** The files and plan the agent is working with, from a state snapshot. */
export function workspaceFrom(state: State): { files: AgentFile[]; todos: AgentTodo[] } {
  const snapshot = state as { files?: unknown; todos?: unknown };
  return {
    files: Array.isArray(snapshot.files) ? (snapshot.files as AgentFile[]) : [],
    todos: Array.isArray(snapshot.todos) ? (snapshot.todos as AgentTodo[]) : [],
  };
}

/**
 * Arguments arrive as JSON fragments, so mid-stream they do not parse yet.
 * An empty object until the call closes is right: the trace shows the tool
 * being called, and its arguments the moment they are whole.
 */
function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function looksLikeError(content: unknown): boolean {
  if (typeof content !== 'string') {
    return false;
  }
  try {
    const parsed = JSON.parse(content) as { error?: unknown };
    return Boolean(parsed?.error);
  } catch {
    return false;
  }
}
