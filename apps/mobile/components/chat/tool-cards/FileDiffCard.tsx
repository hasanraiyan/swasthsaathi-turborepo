import { diffLines, type DiffRow } from '../../../lib/diff';
import { CodeLines } from './CodeLines';

interface FileDiffCardProps {
  /** `write_file` has no prior content to diff against -- everything it sent is new. */
  mode: 'write' | 'edit';
  content?: string;
  oldString?: string;
  newString?: string;
}

/**
 * What a write or an edit actually changed, line by line.
 *
 * `write_file`'s result is just "Successfully wrote to '...'", and
 * `edit_file`'s is "Successfully replaced N occurrence(s)" -- neither carries
 * the content. The change lives entirely in the call's own arguments, which
 * is what this diffs.
 */
export function FileDiffCard({ mode, content, oldString, newString }: FileDiffCardProps) {
  const rows: DiffRow[] =
    mode === 'write'
      ? (content ?? '').split('\n').map((text): DiffRow => ({ type: 'add', text }))
      : diffLines(oldString ?? '', newString ?? '');

  return (
    <CodeLines
      rows={rows.map((row, index) => ({
        key: String(index),
        gutter: row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' ',
        text: row.text,
        tone: row.type === 'context' ? undefined : row.type,
      }))}
    />
  );
}
