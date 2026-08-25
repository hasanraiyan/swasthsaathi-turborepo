import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CONDITION_SEVERITY, CONDITION_STATUS } from '@repo/contracts';
import type { ConditionSeverity, ConditionStatus } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { DATE_ONLY_MATCH, ownedSchemaOptions } from './schema-options';

/**
 * A condition the user lives with. Medicines, symptoms, appointments and
 * documents all optionally point back here, which is what lets the app answer
 * "what am I taking this for?".
 */
@Schema({ collection: 'conditions', ...ownedSchemaOptions })
export class Condition {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({
    type: String,
    enum: [...CONDITION_STATUS],
    default: 'active',
    index: true,
  })
  status!: ConditionStatus;

  @Prop({ type: String, enum: [...CONDITION_SEVERITY], default: null })
  severity!: ConditionSeverity | null;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  diagnosedOn!: string | null;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  resolvedOn!: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Doctor', default: null })
  diagnosedByDoctorId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type ConditionDocument = HydratedDocument<Condition>;
export const ConditionSchema = SchemaFactory.createForClass(Condition);
ConditionSchema.index({ userId: 1, createdAt: -1 });
