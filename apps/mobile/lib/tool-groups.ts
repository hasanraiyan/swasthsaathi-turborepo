import type { TranscriptToolCall } from '@repo/contracts';

/**
 * How one turn's tool calls become rows in the thread.
 *
 * A single call is a single row. Several calls in a row collapse into one
 * group, the way a person would describe "checked your medicines and your
 * last few readings" as one thing rather than two. `write_todos` is never a
 * row at all -- the plan above the answer already shows that work -- and
 * `present_file` always stands alone, since it is the file arriving, not a
 * step to fold into a summary of steps.
 */
export type ToolRenderItem =
  | { kind: 'call'; call: TranscriptToolCall }
  | { kind: 'group'; calls: TranscriptToolCall[] };

export function groupToolCalls(calls: TranscriptToolCall[]): ToolRenderItem[] {
  const items: ToolRenderItem[] = [];
  let pending: TranscriptToolCall[] = [];

  const flush = () => {
    if (pending.length === 1) {
      items.push({ kind: 'call', call: pending[0]! });
    } else if (pending.length > 1) {
      items.push({ kind: 'group', calls: pending });
    }
    pending = [];
  };

  for (const call of calls) {
    if (call.toolName === 'write_todos') {
      continue;
    }
    if (call.toolName === 'present_file') {
      flush();
      items.push({ kind: 'call', call });
      continue;
    }
    pending.push(call);
  }
  flush();

  return items;
}
