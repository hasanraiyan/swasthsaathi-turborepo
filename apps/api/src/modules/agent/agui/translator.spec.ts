import { AguiTranslator } from './translator';
import { EventType } from '@ag-ui/core';

/**
 * Unit tests for the AG-UI translator.
 *
 * Feed hand-written LangGraph events and assert the AG-UI events out.
 * The translator is the bridge between what the graph does and what the
 * user should see.
 */

function collectEvents(
  gen: Generator<unknown>,
): Array<{ type: unknown; [key: string]: unknown }> {
  return [...gen] as Array<{ type: unknown; [key: string]: unknown }>;
}

describe('AguiTranslator', () => {
  describe('text messages', () => {
    it('text chunks produce START, CONTENT, and END events', () => {
      const translator = new AguiTranslator();

      // Simulate text chunks
      const events1 = collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: { chunk: { content: 'Hello' } },
        }),
      );
      expect(events1[0]?.type).toBe(EventType.TEXT_MESSAGE_START);
      expect(events1[1]?.type).toBe(EventType.TEXT_MESSAGE_CONTENT);
      expect(events1[1]?.delta).toBe('Hello');

      // More text
      const events2 = collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: { chunk: { content: ' world' } },
        }),
      );
      expect(events2[0]?.type).toBe(EventType.TEXT_MESSAGE_CONTENT);
      expect(events2[0]?.delta).toBe(' world');

      // Model end closes the text
      const events3 = collectEvents(
        translator.translate({ event: 'on_chat_model_end' }),
      );
      expect(events3[0]?.type).toBe(EventType.TEXT_MESSAGE_END);
    });
  });

  describe('tool calls', () => {
    it('a tool call arriving closes the open text message first', () => {
      const translator = new AguiTranslator();

      // Start some text
      collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: { chunk: { content: 'Let me check...' } },
        }),
      );

      // Tool call arrives
      const events = collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: {
            chunk: {
              content: null,
              tool_call_chunks: [
                { id: 'call_1', name: 'medicines.get', args: '{"id":"' },
              ],
            },
          },
        }),
      );

      // Should close text first, then start tool call, then args
      expect(events[0]?.type).toBe(EventType.TEXT_MESSAGE_END);
      expect(events[1]?.type).toBe(EventType.TOOL_CALL_START);
      expect(events[2]?.type).toBe(EventType.TOOL_CALL_ARGS);
    });

    it('tool argument chunks are attributed to the open call even without id on continuation', () => {
      const translator = new AguiTranslator();

      // Start tool call with id
      collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: {
            chunk: {
              tool_call_chunks: [{ id: 'call_1', name: 'test', args: '{"a":' }],
            },
          },
        }),
      );

      // Continuation without id
      const events = collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: {
            chunk: {
              tool_call_chunks: [{ args: '1}' }],
            },
          },
        }),
      );

      expect(events[0]?.type).toBe(EventType.TOOL_CALL_ARGS);
    });
  });

  describe('tools that change state', () => {
    /**
     * `write_todos` and the file tools do not return their result. They
     * return a LangGraph `Command` carrying the new state and the message
     * describing it, so a plain reading of the output finds neither -- which
     * is how the plan came to appear only once the run had finished.
     */
    function writeTodosCommand(todos: unknown) {
      return {
        event: 'on_tool_end',
        name: 'write_todos',
        data: {
          output: {
            lg_name: 'Command',
            update: {
              todos,
              messages: [
                { tool_call_id: 'call_1', content: 'Updated todo list' },
              ],
            },
          },
        },
      };
    }

    it('reports the result the Command carries, not the Command', () => {
      const translator = new AguiTranslator();
      collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: {
            chunk: {
              tool_call_chunks: [
                { id: 'call_1', name: 'write_todos', args: '{}' },
              ],
            },
          },
        }),
      );

      const events = collectEvents(translator.translate(writeTodosCommand([])));

      const result = events.find((e) => e.type === EventType.TOOL_CALL_RESULT);
      expect(result?.toolCallId).toBe('call_1');
      expect(result?.content).toBe('Updated todo list');
    });

    it('announces the new plan as it is written, not after the run', () => {
      const translator = new AguiTranslator();

      const events = collectEvents(
        translator.translate(
          writeTodosCommand([
            { content: 'Read the appointment', status: 'completed' },
            { content: 'Check blood pressure', status: 'in_progress' },
          ]),
        ),
      );

      const delta = events.find((e) => e.type === EventType.STATE_DELTA);
      expect(delta?.delta).toEqual([
        {
          op: 'add',
          path: '/todos',
          value: [
            { content: 'Read the appointment', status: 'completed' },
            { content: 'Check blood pressure', status: 'in_progress' },
          ],
        },
      ]);
    });

    it('patches the plan alone, leaving files the run already wrote', () => {
      const translator = new AguiTranslator();
      const events = collectEvents(translator.translate(writeTodosCommand([])));

      // A snapshot here would replace the whole state, blanking the files.
      expect(events.some((e) => e.type === EventType.STATE_SNAPSHOT)).toBe(
        false,
      );
      const paths = events
        .filter((e) => e.type === EventType.STATE_DELTA)
        .flatMap((e) =>
          (e.delta as Array<{ path: string }>).map((op) => op.path),
        );
      expect(paths).toEqual(['/todos']);
    });

    it('reports a written file in the shape the app is given', () => {
      const translator = new AguiTranslator();

      const events = collectEvents(
        translator.translate({
          event: 'on_tool_end',
          name: 'write_file',
          data: {
            output: {
              lg_name: 'Command',
              update: {
                files: {
                  '/workspace/notes.md': { content: '# Notes' },
                  '/skills/explaining/SKILL.md': { content: 'read only' },
                },
                messages: [{ tool_call_id: 'call_2', content: 'Wrote file' }],
              },
            },
          },
        }),
      );

      const delta = events.find((e) => e.type === EventType.STATE_DELTA);
      expect(delta?.delta).toEqual([
        {
          op: 'add',
          path: '/files',
          // Skills are the agent's own reference, not the user's workspace.
          value: [{ path: '/workspace/notes.md', content: '# Notes', size: 7 }],
        },
      ]);
    });
  });

  describe('tool end', () => {
    it('on_tool_end emits TOOL_CALL_RESULT with the right toolCallId', () => {
      const translator = new AguiTranslator();

      // Start and end a tool call
      collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: {
            chunk: {
              tool_call_chunks: [{ id: 'call_1', name: 'test', args: '{}' }],
            },
          },
        }),
      );

      const events = collectEvents(
        translator.translate({
          event: 'on_tool_end',
          data: {
            output: {
              tool_call_id: 'call_1',
              content: 'result data',
            },
          },
        }),
      );

      // Should have TOOL_CALL_END and TOOL_CALL_RESULT
      const endEvent = events.find((e) => e.type === EventType.TOOL_CALL_END);
      const resultEvent = events.find(
        (e) => e.type === EventType.TOOL_CALL_RESULT,
      );

      expect(endEvent).toBeDefined();
      expect(resultEvent).toBeDefined();
      expect(resultEvent?.toolCallId).toBe('call_1');
    });
  });

  describe('file presentation', () => {
    it('present_file emits file.presented with the parsed path', () => {
      const translator = new AguiTranslator();

      collectEvents(
        translator.translate({
          event: 'on_chat_model_end',
        }),
      );

      const events = collectEvents(
        translator.translate({
          event: 'on_tool_end',
          name: 'present_file',
          data: {
            output: {
              content: JSON.stringify({
                filePath: '/workspace/outputs/report.md',
                title: 'Health Report',
                description: 'Summary of readings',
              }),
            },
          },
        }),
      );

      const fileEvent = events.find(
        (e) => (e as { name?: string }).name === 'file.presented',
      );
      expect(fileEvent).toBeDefined();
    });
  });

  describe('finish', () => {
    it('finish() closes an open text message', () => {
      const translator = new AguiTranslator();

      // Start text but don't end it — no tool call to close it first
      collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: { chunk: { content: 'Partial message' } },
        }),
      );

      const events = collectEvents(translator.finish());

      const textEnd = events.find((e) => e.type === EventType.TEXT_MESSAGE_END);
      expect(textEnd).toBeDefined();
    });

    it('finish() ends an open tool call', () => {
      const translator = new AguiTranslator();

      // Start a tool call but don't end it
      collectEvents(
        translator.translate({
          event: 'on_chat_model_stream',
          data: {
            chunk: {
              tool_call_chunks: [{ id: 'call_1', name: 'test', args: '{}' }],
            },
          },
        }),
      );

      const events = collectEvents(translator.finish());

      const toolEnd = events.find((e) => e.type === EventType.TOOL_CALL_END);
      expect(toolEnd).toBeDefined();
    });
  });
});
