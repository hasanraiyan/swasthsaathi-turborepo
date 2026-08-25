import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MEDICINE_FORM, MEDICINE_STATUS } from '@repo/contracts';
import type { MedicineForm, MedicineStatus } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { DATE_ONLY_MATCH, ownedSchemaOptions } from './schema-options';

/**
 * The *what* of a medicine: the drug, its strength, why it is taken.
 * The *when* lives in MedicationSchedule and the *did it happen* in
 * MedicationDose, so a medicine can be paused without losing its history.
 */
@Schema({ collection: 'medicines', ...ownedSchemaOptions })
export class Medicine {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: [...MEDICINE_FORM], default: 'tablet' })
  form!: MedicineForm;

  @Prop({ type: String, default: null, trim: true })
  strength!: string | null;

  @Prop({ type: String, default: null, trim: true })
  purpose!: string | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Condition',
    default: null,
    index: true,
  })
  conditionId!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Doctor', default: null })
  prescribedByDoctorId!: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: [...MEDICINE_STATUS],
    default: 'active',
    index: true,
  })
  status!: MedicineStatus;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  startedOn!: string | null;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  endedOn!: string | null;

  /** Why it was stopped. Kept apart from `notes` so stopping never overwrites
   * what the user wrote about the medicine itself. */
  @Prop({ type: String, default: null })
  stoppedReason!: string | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type MedicineDocument = HydratedDocument<Medicine>;
export const MedicineSchema = SchemaFactory.createForClass(Medicine);
MedicineSchema.index({ userId: 1, status: 1, name: 1 });
