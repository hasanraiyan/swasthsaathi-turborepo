import type { Actor } from '@repo/contracts';
import { Types } from 'mongoose';
import type { QueryFilter, Model, SortOrder } from 'mongoose';

import { InvalidInputError, NotFoundError } from '../common/errors';
import { serialize } from './serialize';

export interface ListOptions<TDoc> {
  filter?: QueryFilter<TDoc>;
  sort?: Record<string, SortOrder>;
  limit?: number;
  offset?: number;
}

/**
 * Shared CRUD for user-owned collections.
 *
 * Every query built here is scoped to `actor.userId`. That is the single
 * defence against one user reading another's health record, so it lives in
 * one place rather than being re-typed in ten services where one omission
 * would go unnoticed.
 */
export abstract class OwnedCrudService<TDoc, TRecord> {
  protected abstract readonly model: Model<TDoc>;
  /** Used in error messages, e.g. "Medicine not found". */
  protected abstract readonly entityName: string;

  /** Narrow any filter to the acting user. Never bypass this. */
  protected scope(
    actor: Actor,
    filter: QueryFilter<TDoc> = {},
  ): QueryFilter<TDoc> {
    return { ...filter, userId: actor.userId };
  }

  protected objectId(id: string, field = 'id'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new InvalidInputError(`"${field}" is not a valid id`, [
        { path: field, message: 'Expected a 24-character hex id' },
      ]);
    }
    return new Types.ObjectId(id);
  }

  protected async getOwned(actor: Actor, id: string): Promise<TRecord> {
    const doc = await this.model
      .findOne(this.scope(actor, { _id: this.objectId(id) }))
      .lean()
      .exec();
    if (!doc) {
      // Same response whether the record is missing or belongs to someone
      // else -- a 404 must not confirm that another user's id exists.
      throw new NotFoundError(`${this.entityName} not found`);
    }
    return serialize<TRecord>(doc);
  }

  protected async listOwned(
    actor: Actor,
    options: ListOptions<TDoc> = {},
  ): Promise<TRecord[]> {
    const {
      filter,
      sort = { createdAt: -1 },
      limit = 50,
      offset = 0,
    } = options;
    const docs = await this.model
      .find(this.scope(actor, filter))
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
    return docs.map((doc) => serialize<TRecord>(doc));
  }

  protected async countOwned(
    actor: Actor,
    filter?: QueryFilter<TDoc>,
  ): Promise<number> {
    return this.model.countDocuments(this.scope(actor, filter)).exec();
  }

  protected async createOwned(
    actor: Actor,
    data: Record<string, unknown>,
  ): Promise<TRecord> {
    // The cast bridges a plain attribute bag to Mongoose's generated document
    // type; the schema's own validators are the real check.
    const created = await new this.model({
      ...data,
      userId: actor.userId,
    } as unknown as TDoc).save();
    return serialize<TRecord>(created.toObject());
  }

  protected async updateOwned(
    actor: Actor,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<TRecord> {
    const $set = stripUndefined(patch);
    const doc = await this.model
      .findOneAndUpdate(
        this.scope(actor, { _id: this.objectId(id) }),
        Object.keys($set).length > 0 ? { $set } : {},
        { returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundError(`${this.entityName} not found`);
    }
    return serialize<TRecord>(doc);
  }

  protected async deleteOwned(
    actor: Actor,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const result = await this.model
      .deleteOne(this.scope(actor, { _id: this.objectId(id) }))
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundError(`${this.entityName} not found`);
    }
    return { id, deleted: true };
  }
}

/**
 * Drop keys the caller didn't send.
 *
 * `undefined` means "leave alone" and `null` means "clear it" -- the contracts
 * use `.nullish()` on updatable fields precisely so a client can express the
 * difference, and `$set: { field: undefined }` would silently unset instead.
 */
export function stripUndefined(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
