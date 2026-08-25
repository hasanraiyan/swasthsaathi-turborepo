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
    return serialize<ProfileRecord>(doc);
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
    return serialize<ProfileRecord>(doc);
  }
}
