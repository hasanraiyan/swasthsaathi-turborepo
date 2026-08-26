/**
 * Wrap a deepagents backend so reads pass through but writes fail loudly.
 *
 * Used for `/skills/`. Skills ship with the code -- they are reviewed,
 * diffed and deployed like any other source -- so a conversation must never
 * be able to rewrite the instructions the assistant is following. The error
 * is returned to the model rather than thrown, so it reads "this is
 * read-only" and moves on instead of the run dying.
 */
export function readonlyBackend<T extends object>(
  backend: T,
  label = 'This directory',
): T {
  const source = backend as Record<string, unknown>;

  const passthrough = [
    'ls',
    'read',
    'readRaw',
    'grep',
    'glob',
    'downloadFiles',
  ] as const;
  const wrapper: Record<string, unknown> = {};

  for (const method of passthrough) {
    const fn = source[method];
    if (typeof fn === 'function') {
      wrapper[method] = (fn as (...args: unknown[]) => unknown).bind(backend);
    }
  }

  wrapper.write = (filePath: string) => ({
    error: `${label} is read-only.`,
    path: filePath,
    filesUpdate: null,
  });

  wrapper.edit = (filePath: string) => ({
    error: `${label} is read-only.`,
    path: filePath,
    filesUpdate: null,
    occurrences: 0,
  });

  wrapper.uploadFiles = (files: Array<[string, unknown]>) =>
    files.map(([filePath]) => ({ path: filePath, error: 'permission_denied' }));

  return wrapper as T;
}
