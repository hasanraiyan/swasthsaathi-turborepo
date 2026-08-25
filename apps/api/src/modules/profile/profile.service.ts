import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { profileCapabilities } from '@repo/contracts';
import type {
  Actor,
  Profile as ProfileRecord,
  UpdateProfileInput,
} from '@repo/contracts';
import type { Model } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { stripUndefined } from '../../database/owned-crud.service';
import { Profile } from '../../database/schemas/profile.schema';
import { serialize } from '../../database/serialize';

/**
 * The user's health profile.
 *
 * Unlike the other domains there is exactly one document per user and it is
 * never explicitly created -- reading it brings it into existence, so the app
 * never has to handle an "onboarding not done" state.
 */
@Injectable()
export class ProfileService implements CapabilityProvider {
  constructor(
    @InjectModel(Profile.name) private readonly model: Model<Profile>,
  ) {}

  /**
   * Fill in fields a stored profile predates.
   *
   * Mongoose applies schema defaults on insert, never to documents already in
   * the collection, so a profile written before `familyHistory` existed comes
   * back with the key *missing* rather than empty. Every consumer -- the
   * preventive plan, the app, a future agent tool -- is promised the shape in
   * `profileSchema`, so it is made true here, at the one place profiles are
   * read, rather than with a `?? []` at each use.
   *
   * This also removes the need for a backfill migration: the next save writes
   * the real values anyway.
   */
  private toRecord(doc: unknown): ProfileRecord {
    const record = serialize<ProfileRecord>(doc);
    return {
      ...record,
      allergies: record.allergies ?? [],
      familyHistory: record.familyHistory ?? [],
      tobaccoUse: record.tobaccoUse ?? null,
      alcoholUse: record.alcoholUse ?? null,
      activityLevel: record.activityLevel ?? null,
    };
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(profileCapabilities.get, (actor) => this.get(actor)),
      bindCapability(profileCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
    ];
  }

  async get(actor: Actor): Promise<ProfileRecord> {
    const doc = await this.model
      .findOneAndUpdate(
        { userId: actor.userId },
        { $setOnInsert: { userId: actor.userId } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
    return this.toRecord(doc);
  }

  async update(
    actor: Actor,
    input: UpdateProfileInput,
  ): Promise<ProfileRecord> {
    const $set = stripUndefined({ ...input });
    const doc = await this.model
      .findOneAndUpdate(
        { userId: actor.userId },
        { $set, $setOnInsert: { userId: actor.userId } },
        {
          returnDocument: 'after',
          upsert: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      )
      .lean()
      .exec();
    return this.toRecord(doc);
  }
}
