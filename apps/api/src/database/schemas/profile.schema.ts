import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BLOOD_GROUP, SEX_AT_BIRTH } from '@repo/contracts';
import type { BloodGroup, SexAtBirth } from '@repo/contracts';
import type { HydratedDocument } from 'mongoose';

import { DATE_ONLY_MATCH, ownedSchemaOptions } from './schema-options';

/**
 * Health context for the person using the app. One document per Clerk user.
 * Name and email stay in Clerk; only what other capabilities need lives here.
 */
@Schema({ collection: 'profiles', ...ownedSchemaOptions })
export class Profile {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId!: string;

  @Prop({ type: String, default: null })
  fullName!: string | null;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  dateOfBirth!: string | null;

  @Prop({ type: String, enum: [...SEX_AT_BIRTH], default: null })
  sexAtBirth!: SexAtBirth | null;

  @Prop({ type: String, enum: [...BLOOD_GROUP], default: null })
  bloodGroup!: BloodGroup | null;

  @Prop({ type: Number, default: null })
  heightCm!: number | null;

  @Prop({ type: Number, default: null })
  weightKg!: number | null;

  @Prop({ type: [String], default: [] })
  allergies!: string[];

  @Prop({ type: String, default: null })
  emergencyContactName!: string | null;

  @Prop({ type: String, default: null })
  emergencyContactPhone!: string | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type ProfileDocument = HydratedDocument<Profile>;
export const ProfileSchema = SchemaFactory.createForClass(Profile);
