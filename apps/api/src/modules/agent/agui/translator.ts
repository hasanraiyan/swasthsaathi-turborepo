import { randomUUID } from 'node:crypto';

import {
  runError,
  textMessageContent,
  textMessageEnd,
  textMessageStart,
  toolCallArgs,
  toolCallEnd,
  toolCallResult,
  toolCallStart,
  type AguiEvent,
} from './events';

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

  private *onToolEnd(data: unknown): Generator<AguiEvent> {
    const output = (
      data as { output?: { tool_call_id?: string; content?: unknown } }
    )?.output;
    const toolCallId = output?.tool_call_id;
    if (!toolCallId) {
      return;
    }
    if (this.openToolCalls.delete(toolCallId)) {
      yield toolCallEnd(toolCallId);
    }
    yield toolCallResult(randomUUID(), toolCallId, textOf(output?.content));
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

/** Content is a string for plain text and a block array once tools appear. */
export function textOf(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((block) =>
      typeof block === 'object' && block !== null && 'text' in block
        ? String((block as { text: unknown }).text)
        : '',
    )
    .join('');
}
