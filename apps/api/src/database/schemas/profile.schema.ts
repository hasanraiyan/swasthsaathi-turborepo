import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ACTIVITY_LEVEL,
  ALCOHOL_USE,
  BLOOD_GROUP,
  FAMILY_HISTORY,
  SEX_AT_BIRTH,
  TOBACCO_USE,
} from '@repo/contracts';
import type {
  ActivityLevel,
  AlcoholUse,
  BloodGroup,
  FamilyHistoryItem,
  SexAtBirth,
  TobaccoUse,
} from '@repo/contracts';
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

  // The health baseline. Null means "not answered yet", which is different
  // from `never` -- the plan treats an unanswered habit as unknown rather
  // than assuming the healthiest option.
  @Prop({ type: String, enum: [...TOBACCO_USE], default: null })
  tobaccoUse!: TobaccoUse | null;

  @Prop({ type: String, enum: [...ALCOHOL_USE], default: null })
  alcoholUse!: AlcoholUse | null;

  @Prop({ type: String, enum: [...ACTIVITY_LEVEL], default: null })
  activityLevel!: ActivityLevel | null;

  @Prop({ type: [String], enum: [...FAMILY_HISTORY], default: [] })
  familyHistory!: FamilyHistoryItem[];

  @Prop({ type: String, default: null })
  emergencyContactName!: string | null;

  @Prop({ type: String, default: null })
  emergencyContactPhone!: string | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type ProfileDocument = HydratedDocument<Profile>;
export const ProfileSchema = SchemaFactory.createForClass(Profile);
