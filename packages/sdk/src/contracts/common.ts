import { z } from 'zod';

/**
 * Shared primitives for every Swasthya Saathi domain contract.
 *
 * These schemas are the single source of truth: the API validates with them,
 * the mobile app derives its types from them, and the capability registry
 * turns them into JSON Schema so the same input shape can later be handed to
 * an AI agent as a tool definition. Nothing here may import from a domain
 * module -- dependencies point one way only.
 */

/** A Clerk user id (`user_...`). Every record in the system is owned by one. */
export const userIdSchema = z.string().min(1);

/**
 * Primary key for every domain record: a MongoDB ObjectId rendered as a
 * 24-character hex string. Kept as a string across the wire so neither the
 * mobile app nor a future agent tool has to know about BSON.
 */
export const idSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Expected a 24-character hex id');

/** Calendar date, `YYYY-MM-DD`. Used where the time of day carries no meaning. */
export const dateOnlySchema = z.iso.date();

/** Instant with an offset, `2026-08-25T09:30:00+05:30`. */
export const timestampSchema = z.iso.datetime({ offset: true });

/** Wall-clock time of day, `HH:MM` on a 24-hour clock. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24-hour time like "08:30"');

/** Free-text the user writes for themselves. Capped to keep rows small. */
export const notesSchema = z.string().max(2000);

/** Day of week, Sunday = 0, matching `Date.prototype.getDay()`. */
export const dayOfWeekSchema = z.number().int().min(0).max(6);

/** Fields the database owns. Never accepted as input. */
export const recordMetaShape = {
  id: idSchema,
  userId: userIdSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
};

/** What every `*.list` capability returns. */
export interface ListResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** What every `*.delete` capability returns. */
export interface DeleteResult {
  id: string;
  deleted: true;
}

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;

/** Input for any capability that addresses a single record by id. */
export const byIdSchema = z.object({ id: idSchema });
export type ById = z.infer<typeof byIdSchema>;

/**
 * Who an action is being performed on behalf of.
 *
 * Passed explicitly into every capability rather than read from request
 * context, so the same method is callable from an HTTP controller, a
 * background job, or a future agent tool without change.
 */
export interface Actor {
  userId: string;
  /** Present when the call came from an authenticated HTTP session. */
  sessionId?: string;
}

export type CapabilityKind = 'read' | 'write';

/**
 * A description of one reusable capability of the product.
 *
 * The manual app and any future agent call the *same* underlying service
 * method; this descriptor is the machine-readable contract that both sides
 * agree on. `name` doubles as the tool name and `description` as the tool
 * description when the registry exposes capabilities over MCP.
 */
export interface CapabilityDescriptor<I extends z.ZodType = z.ZodType> {
  /** Stable, namespaced id -- `medicines.create`. */
  name: string;
  /** Plain-language summary, written for a reader who cannot see the code. */
  description: string;
  kind: CapabilityKind;
  input: I;
}

/** Identity helper that preserves the literal input schema type. */
export function capability<I extends z.ZodType>(
  descriptor: CapabilityDescriptor<I>,
): CapabilityDescriptor<I> {
  return descriptor;
}
