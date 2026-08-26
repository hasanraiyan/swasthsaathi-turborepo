import type { AgentFile, AgentTodo } from '@repo/contracts';

/**
 * The agent's own state, in the shapes the app is given.
 *
 * Shared between the translator, which reports state as it changes during a
 * run, and the service, which reports it once the run settles. One set of
 * converters because the two must agree: a plan that changes shape the moment
 * the run finishes would look like the agent had changed its mind.
 */

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

export function toFiles(raw: unknown): AgentFile[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const files: AgentFile[] = [];

  for (const [path, data] of Object.entries(raw as Record<string, unknown>)) {
    if (path.startsWith('/skills/') || path.endsWith('/')) {
      continue;
    }
    const entry = data as {
      content?: unknown;
      is_dir?: boolean;
      isDir?: boolean;
    };
    if (entry?.is_dir === true || entry?.isDir === true) {
      continue;
    }
    const content = textOf(entry?.content);
    files.push({ path, content, size: content.length });
  }

  return files;
}

export function toTodos(raw: unknown): AgentTodo[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((todo: { content?: unknown; status?: unknown }) => ({
    content: typeof todo?.content === 'string' ? todo.content : '',
    status: typeof todo?.status === 'string' ? todo.status : 'pending',
  }));
}

/**
 * The state a tool changed, if it changed any.
 *
 * The tools that write -- `write_todos`, `write_file`, `edit_file`, `delete`
 * -- do not return their result directly. They return a LangGraph `Command`
 * carrying both the new state and the message that describes it, which is why
 * a plain reading of the tool's output finds neither.
 */
export function commandUpdate(output: unknown): Record<string, unknown> | null {
  if (!output || typeof output !== 'object') {
    return null;
  }
  const command = output as { lg_name?: unknown; update?: unknown };
  if (command.lg_name !== 'Command') {
    return null;
  }
  // `update` also has a tuple form; only the object form names its channels.
  return command.update &&
    !Array.isArray(command.update) &&
    typeof command.update === 'object'
    ? (command.update as Record<string, unknown>)
    : null;
}

/** The tool's own result, which a `Command` carries among its messages. */
export function messageOf(update: Record<string, unknown>): unknown {
  const messages = update.messages;
  return Array.isArray(messages) ? messages[0] : undefined;
}
