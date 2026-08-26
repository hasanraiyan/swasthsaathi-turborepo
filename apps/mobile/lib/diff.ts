/**
 * A line-level diff between two texts.
 *
 * `edit_file`'s result is just "Successfully replaced N occurrence(s)" -- the
 * actual change lives entirely in its arguments, `old_string` and
 * `new_string`. Diffing those directly is the only way to show what changed;
 * there is no other copy of the file's prior content on the client.
 */

export interface DiffRow {
  type: 'add' | 'remove' | 'context';
  text: string;
}

// A health record's files are short markdown notes, not source trees -- this
// exists so a pathological input degrades instead of hanging, not because it
// is expected to trigger in normal use.
const MAX_CELLS = 250_000;

export function diffLines(oldText: string, newText: string): DiffRow[] {
  const a = oldText ? oldText.split('\n') : [];
  const b = newText ? newText.split('\n') : [];

  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((text): DiffRow => ({ type: 'remove', text })),
      ...b.map((text): DiffRow => ({ type: 'add', text })),
    ];
  }

  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'context', text: a[i]! });
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      rows.push({ type: 'remove', text: a[i]! });
      i += 1;
    } else {
      rows.push({ type: 'add', text: b[j]! });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ type: 'remove', text: a[i]! });
    i += 1;
  }
  while (j < m) {
    rows.push({ type: 'add', text: b[j]! });
    j += 1;
  }

  return rows;
}

export function diffStat(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const row of rows) {
    if (row.type === 'add') {
      added += 1;
    } else if (row.type === 'remove') {
      removed += 1;
    }
  }
  return { added, removed };
}
