/**
 * Reading the agent's own markdown back into structure.
 *
 * Not a CommonMark implementation -- a scoped parser for what this agent
 * actually writes: memory notes and prep sheets built from headings, bold,
 * lists, a quote or a rule now and then. That scope is deliberate. Every file
 * this reads is produced by `write_file`/`edit_file` on our own agent, never
 * from an external or adversarial source, so there is no reason to carry the
 * weight of tables, footnotes, or raw HTML passthrough that content like this
 * never contains.
 */

export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

/** One line of text, split into runs of bold/italic/code/link and plain text. */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer });
      buffer = '';
    }
  };

  while (i < text.length) {
    if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end !== -1) {
        flush();
        segments.push({ text: text.slice(i + 3, end), bold: true, italic: true });
        i = end + 3;
        continue;
      }
    }

    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      const marker = text.slice(i, i + 2);
      const end = text.indexOf(marker, i + 2);
      if (end !== -1) {
        flush();
        segments.push({ text: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        segments.push({ text: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }

    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          flush();
          segments.push({
            text: text.slice(i + 1, closeBracket),
            href: text.slice(closeBracket + 2, closeParen),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    if (text[i] === '*' || text[i] === '_') {
      const marker = text[i];
      const end = text.indexOf(marker, i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        segments.push({ text: text.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }

    buffer += text[i];
    i += 1;
  }

  flush();
  return segments;
}

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'code'; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^```/;

/** The blocks a file's markdown is made of, in reading order. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (FENCE.test(line.trim())) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i]!.trim())) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      i += 1; // the closing fence
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i += 1;
      continue;
    }

    if (RULE.test(line.trim())) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i]!)) {
        items.push(pattern.exec(lines[i]!)![1]!.trim());
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !HEADING.test(lines[i]!) &&
      !BULLET.test(lines[i]!) &&
      !NUMBERED.test(lines[i]!) &&
      !lines[i]!.trim().startsWith('>') &&
      !FENCE.test(lines[i]!.trim()) &&
      !RULE.test(lines[i]!.trim())
    ) {
      paragraphLines.push(lines[i]!);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  return blocks;
}
