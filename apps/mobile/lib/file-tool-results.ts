/**
 * Reading `ls` and `read_file`'s results back into structured data.
 *
 * Both tools (from deepagents' filesystem backend) return plain text, not
 * JSON -- so this parses the exact formats their own source produces, not a
 * guess at a nicer shape. Get either wrong and the card silently shows
 * nothing rather than an error, which is worse than the plain text it
 * replaces.
 */

export interface LsEntry {
  path: string;
  isDir: boolean;
  size: number | null;
}

/**
 * `ls`'s tool returns one line per entry: "`path` (directory)" or
 * "`path` (`N` bytes)" or bare `path` when the backend reports no size, and
 * "No files found in `path`" when the directory is empty. On its own error
 * path it returns "Error listing files: ..." as plain text, never a thrown
 * exception -- so this is the only place that state is detectable.
 */
export function parseLsResult(raw: string): { entries: LsEntry[]; error: string | null } {
  if (raw.startsWith('Error listing files:')) {
    return { entries: [], error: raw.slice('Error listing files:'.length).trim() };
  }
  if (raw.startsWith('No files found')) {
    return { entries: [], error: null };
  }

  const entries = raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line): LsEntry => {
      if (line.endsWith(' (directory)')) {
        return { path: line.slice(0, -' (directory)'.length), isDir: true, size: null };
      }
      const sized = /^(.*) \((\d+) bytes\)$/.exec(line);
      if (sized) {
        return { path: sized[1]!, isDir: false, size: Number(sized[2]) };
      }
      return { path: line, isDir: false, size: null };
    });

  return { entries, error: null };
}

export interface NumberedLine {
  /** The raw label deepagents printed -- usually a line number, occasionally
   *  a "N.1" continuation marker for a line too long to show on one row. */
  label: string;
  text: string;
}

/**
 * `read_file` prefixes every line with `"{number, right-padded to 6}\t"`
 * before returning it (see deepagents' `formatContentWithLineNumbers`). This
 * undoes that so the card can draw its own gutter instead of showing the
 * padding as part of the text.
 */
export function parseNumberedLines(raw: string): NumberedLine[] {
  return raw.split('\n').map((row) => {
    const tab = row.indexOf('\t');
    if (tab === -1) {
      return { label: '', text: row };
    }
    return { label: row.slice(0, tab).trim(), text: row.slice(tab + 1) };
  });
}

export function lineRange(lines: NumberedLine[]): { start: number; end: number; count: number } | null {
  if (lines.length === 0) {
    return null;
  }
  const first = Number.parseFloat(lines[0]!.label);
  const last = Number.parseFloat(lines[lines.length - 1]!.label);
  return {
    start: Number.isFinite(first) ? Math.floor(first) : 1,
    end: Number.isFinite(last) ? Math.floor(last) : lines.length,
    count: lines.length,
  };
}

/** The leaf name a path ends in, for a label that doesn't repeat `/workspace/`. */
export function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : path;
}
