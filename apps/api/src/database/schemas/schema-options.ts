import type { SchemaOptions } from 'mongoose';

/**
 * Options shared by every user-owned collection.
 *
 * `timestamps` gives the `createdAt`/`updatedAt` that the contracts'
 * `recordMetaShape` promises, and dropping the version key keeps documents
 * matching the contract shape without a per-field projection.
 */
export const ownedSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  minimize: false,
};

/** Regex for the `YYYY-MM-DD` strings used for calendar dates. */
export const DATE_ONLY_MATCH = /^\d{4}-\d{2}-\d{2}$/;
