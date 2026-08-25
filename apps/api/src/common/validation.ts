import type { z } from 'zod';

import { InvalidInputError } from './errors';

/**
 * Validate a value against a contract schema, raising a domain error rather
 * than a Zod one so the HTTP filter and a future agent caller both get the
 * same shape back.
 *
 * Controllers use this instead of a Nest pipe because most write routes merge
 * a path parameter into the body (`PATCH /medicines/:id`) before validating,
 * which a pipe bound to a single argument cannot see.
 */
export function parseInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.infer<S> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new InvalidInputError(
      'Validation failed',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return result.data;
}
