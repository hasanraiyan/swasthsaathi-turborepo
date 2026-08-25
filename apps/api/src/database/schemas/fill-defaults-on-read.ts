import type { Schema } from 'mongoose';

type Plain = Record<string, unknown>;

/**
 * Give every document read back the shape its schema promises.
 *
 * Mongoose applies defaults on insert and never to documents already in the
 * collection. So the moment a field is added to a schema, every document
 * written before that comes back with the key *missing* rather than empty --
 * and code that trusts the contract (`familyHistory.length`,
 * `daysOfWeek.length`, `allergies.join()`) throws on data that was perfectly
 * valid when it was written.
 *
 * This closes that for the whole database rather than one field at a time:
 * after any read, a path that is absent is filled from its declared default,
 * and an array with no declared default becomes `[]`. It adds only what
 * Mongoose itself would have written at insert, so nothing already stored is
 * changed or reinterpreted, and no backfill migration is needed.
 *
 * Applied to every schema in `DatabaseModule`.
 */
export function fillDefaultsOnRead(schema: Schema): void {
  function fill(doc: unknown): void {
    if (!doc || typeof doc !== 'object') {
      return;
    }
    const target = doc as Plain;

    schema.eachPath((pathName, schemaType) => {
      if (pathName === '_id' || pathName === '__v' || target[pathName] !== undefined) {
        return;
      }

      const declared = (schemaType as unknown as { options?: { default?: unknown } }).options
        ?.default;

      if (declared !== undefined) {
        // Array defaults are stored as a factory, so each document gets its
        // own array rather than sharing one.
        target[pathName] = typeof declared === 'function' ? (declared as () => unknown)() : declared;
      } else if (schemaType.instance === 'Array') {
        target[pathName] = [];
      }
    });
  }

  // Covers lean reads too: a post-find hook receives whatever the query
  // resolved to, plain objects included.
  schema.post(['find', 'findOne', 'findOneAndUpdate'], function (result: unknown) {
    if (Array.isArray(result)) {
      result.forEach(fill);
    } else {
      fill(result);
    }
  });
}
