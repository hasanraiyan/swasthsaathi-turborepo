import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DOSE_STATUS } from '@repo/contracts';
import type { DoseStatus } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/**
 * One dose that was due at a particular moment, and what happened to it.
 *
 * Rows are materialised from the schedule the first time a day is opened, so
 * a dose the user never came back for still becomes `missed` rather than
 * silently vanishing -- the absence of an action is the whole signal in
 * adherence tracking.
 *
 * The `{ scheduleId, scheduledFor }` unique index is what makes that
 * materialisation idempotent: opening the same day twice cannot duplicate it.
 */
@Schema({ collection: 'medication_doses', ...ownedSchemaOptions })
export class MedicationDose {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'MedicationSchedule',
    required: true,
  })
  scheduleId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
    index: true,
  })
  medicineId!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  scheduledFor!: Date;

  @Prop({
    type: String,
    enum: [...DOSE_STATUS],
    default: 'pending',
    index: true,
  })
  status!: DoseStatus;

  @Prop({ type: Date, default: null })
  actionedAt!: Date | null;

  @Prop({ type: Number, required: true, min: 0 })
  doseAmount!: number;

  @Prop({ type: String, required: true })
  doseUnit!: string;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type MedicationDoseDocument = HydratedDocument<MedicationDose>;
export const MedicationDoseSchema =
  SchemaFactory.createForClass(MedicationDose);
MedicationDoseSchema.index(
  { scheduleId: 1, scheduledFor: 1 },
  { unique: true },
);
MedicationDoseSchema.index({ userId: 1, scheduledFor: -1 });
