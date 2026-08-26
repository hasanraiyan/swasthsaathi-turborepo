import { randomUUID } from 'node:crypto';

import {
  filePresented,
  runError,
  stateDelta,
  textMessageContent,
  textMessageEnd,
  textMessageStart,
  toolCallArgs,
  toolCallEnd,
  toolCallResult,
  toolCallStart,
  type AguiEvent,
} from './events';
import { commandUpdate, messageOf, textOf, toFiles, toTodos } from './state';

/**
 * Turns a LangGraph event stream into AG-UI events.
 *
 * LangGraph reports what the graph is doing; AG-UI describes what the user
 * should see. The gap is mostly bookkeeping: the model streams text and tool
 * arguments as undifferentiated chunks, while AG-UI wants each to be opened,
 * filled and closed, so the translator holds the open message and tool ids
 * and closes them at the right moment.
 */
export class AguiTranslator {
  private messageId: string | null = null;
  private readonly openToolCalls = new Set<string>();

  /** One LangGraph event in, zero or more AG-UI events out. */
  *translate(event: {
    event: string;
    data?: unknown;
    name?: string;
  }): Generator<AguiEvent> {
    switch (event.event) {
      case 'on_chat_model_stream':
        yield* this.onModelChunk(event.data);
        break;
      case 'on_chat_model_end':
        yield* this.closeText();
        break;
      case 'on_tool_end':
        yield* this.onToolEnd(event.data);
        // `present_file` writes nothing; its whole purpose is this event, so
        // the app opens the file rather than the user reading a path.
        if (event.name === 'present_file') {
          yield* this.onFilePresented(event.data);
        }
        break;
      default:
        break;
    }
  }

  /** Close anything still open when the run stops. */
  *finish(): Generator<AguiEvent> {
    yield* this.closeText();
    for (const toolCallId of this.openToolCalls) {
      yield toolCallEnd(toolCallId);
    }
    this.openToolCalls.clear();
  }

  *fail(message: string): Generator<AguiEvent> {
    yield* this.finish();
    yield runError(message);
  }

  private *onModelChunk(data: unknown): Generator<AguiEvent> {
    const chunk = (data as { chunk?: ModelChunk } | undefined)?.chunk;
    if (!chunk) {
      return;
    }

    for (const call of chunk.tool_call_chunks ?? []) {
      // A tool call arriving means the model has stopped talking.
      yield* this.closeText();

      const toolCallId = call.id ?? [...this.openToolCalls].at(-1);
      if (!toolCallId) {
        continue;
      }
      if (!this.openToolCalls.has(toolCallId)) {
        this.openToolCalls.add(toolCallId);
        yield toolCallStart(
          toolCallId,
          call.name ?? 'tool',
          this.messageId ?? randomUUID(),
        );
      }
      if (call.args) {
        yield toolCallArgs(toolCallId, call.args);
      }
    }

    const text = textOf(chunk.content);
    if (text) {
      if (!this.messageId) {
        this.messageId = randomUUID();
        yield textMessageStart(this.messageId);
      }
      yield textMessageContent(this.messageId, text);
    }
  }

  /**
   * A tool finished: report its result, and anything it changed.
   *
   * The tools that write to the agent's own state -- the plan, the files it
   * is drafting -- return a `Command` holding both the new state and the
   * message describing it, rather than the message alone. Unwrapping it is
   * what lets the plan appear as the agent works through it, instead of
   * arriving complete once there is nothing left to watch.
   */
  private *onToolEnd(data: unknown): Generator<AguiEvent> {
    const raw = (data as { output?: unknown })?.output;
    const update = commandUpdate(raw);
    const output = (update ? messageOf(update) : raw) as
      { tool_call_id?: string; content?: unknown } | undefined;

    const toolCallId = output?.tool_call_id;
    if (toolCallId) {
      if (this.openToolCalls.delete(toolCallId)) {
        yield toolCallEnd(toolCallId);
      }
      yield toolCallResult(randomUUID(), toolCallId, textOf(output?.content));
    }

    if (update?.todos !== undefined) {
      yield stateDelta('/todos', toTodos(update.todos));
    }
    if (update?.files !== undefined) {
      yield stateDelta('/files', toFiles(update.files));
    }
  }

  private *onFilePresented(data: unknown): Generator<AguiEvent> {
    const output = (data as { output?: { content?: unknown } })?.output;
    try {
      const payload = JSON.parse(textOf(output?.content)) as {
        filePath?: string;
        title?: string;
        description?: string;
      };
      if (payload.filePath) {
        yield filePresented(
          payload.filePath,
          payload.title ?? '',
          payload.description ?? '',
        );
      }
    } catch {
      // The tool builds this payload itself, so a parse failure means the
      // shape changed -- not worth failing a run the user is watching.
    }
  }

  private *closeText(): Generator<AguiEvent> {
    if (this.messageId) {
      yield textMessageEnd(this.messageId);
      this.messageId = null;
    }
  }
}

interface ModelChunk {
  content?: unknown;
  tool_call_chunks?: Array<{ id?: string; name?: string; args?: string }>;
}
