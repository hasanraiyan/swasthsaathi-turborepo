import { Types } from 'mongoose';

type Plain = Record<string, unknown>;

/**
 * Convert a lean Mongoose document into the plain JSON shape the contracts in
 * `@repo/contracts` describe.
 *
 * Doing this in one place, rather than a hand-written mapper per domain, is
 * what keeps a capability's HTTP response and its future agent-tool result
 * byte-identical -- there is only one serialisation path to get wrong.
 *
 * - `_id` becomes `id`
 * - ObjectIds become 24-character hex strings
 * - Dates become ISO-8601 strings
 * - `__v` is dropped
 * - `undefined` becomes `null`, matching the `.nullable()` entity contracts
 *
 * Calendar dates (`YYYY-MM-DD`) are deliberately stored as strings in Mongo,
 * not Dates, so a date of birth can't drift across a timezone boundary. They
 * pass through untouched.
 */
export function serialize<T>(input: unknown): T {
  return convert(input) as T;
}

export function serializeAll<T>(input: unknown[]): T[] {
  return input.map((item) => serialize<T>(item));
}

function convert(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(convert);
  }
  if (typeof value === 'object') {
    const out: Plain = {};
    for (const [key, raw] of Object.entries(value as Plain)) {
      if (key === '__v') {
        continue;
      }
      out[key === '_id' ? 'id' : key] = convert(raw);
    }
    return out;
  }
  return value;
}
