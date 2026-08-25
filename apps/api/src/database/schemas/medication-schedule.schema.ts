import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DOSE_TIMING } from '@repo/contracts';
import type { DoseTiming } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { DATE_ONLY_MATCH, ownedSchemaOptions } from './schema-options';

/**
 * When and how much of a medicine to take.
 *
 * `timesOfDay` holds wall-clock `HH:MM` strings rather than instants, so
 * "8 in the morning" stays 8 in the morning when the user travels. Doses are
 * materialised from these strings against the user's current day.
 */
@Schema({ collection: 'medication_schedules', ...ownedSchemaOptions })
export class MedicationSchedule {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
    index: true,
  })
  medicineId!: Types.ObjectId;

  @Prop({ type: Number, default: 1, min: 0 })
  doseAmount!: number;

  @Prop({ type: String, default: 'tablet', trim: true })
  doseUnit!: string;

  @Prop({ type: [String], required: true })
  timesOfDay!: string[];

  /** Empty means every day. Sunday = 0, matching `Date.prototype.getDay()`. */
  @Prop({ type: [Number], default: [] })
  daysOfWeek!: number[];

  @Prop({ type: String, enum: [...DOSE_TIMING], default: 'anytime' })
  timing!: DoseTiming;

  @Prop({ type: String, required: true, match: DATE_ONLY_MATCH })
  startsOn!: string;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  endsOn!: string | null;

  @Prop({ type: Boolean, default: true })
  remindersEnabled!: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type MedicationScheduleDocument = HydratedDocument<MedicationSchedule>;
export const MedicationScheduleSchema =
  SchemaFactory.createForClass(MedicationSchedule);
MedicationScheduleSchema.index({ userId: 1, active: 1 });
