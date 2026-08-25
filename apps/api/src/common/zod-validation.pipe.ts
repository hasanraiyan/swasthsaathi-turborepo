import { Injectable, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { InvalidInputError } from './errors';

/**
 * Validate a request body or query against a contract schema.
 *
 * Uses the same schemas the capability registry uses, so a route and its
 * capability can never drift apart on what they accept.
 */
@Injectable()
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value ?? {});
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
}

/** `@Body(zodBody(createMedicineSchema)) input: CreateMedicineInput` */
export function zodBody<S extends z.ZodType>(schema: S): ZodValidationPipe<S> {
  return new ZodValidationPipe(schema);
}
