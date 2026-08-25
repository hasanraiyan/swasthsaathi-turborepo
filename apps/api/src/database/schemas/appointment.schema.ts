import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { APPOINTMENT_STATUS } from '@repo/contracts';
import type { AppointmentStatus } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/**
 * A visit to a doctor, lab or clinic. `outcome` is filled in afterwards and is
 * where the doctor's instructions land -- the thing users most often forget
 * between visits, and the reason this isn't just a calendar entry.
 */
@Schema({ collection: 'appointments', ...ownedSchemaOptions })
export class Appointment {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Doctor',
    default: null,
    index: true,
  })
  doctorId!: Types.ObjectId | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Condition',
    default: null,
    index: true,
  })
  conditionId!: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  scheduledFor!: Date;

  @Prop({ type: Number, default: null, min: 1 })
  durationMinutes!: number | null;

  @Prop({ type: String, default: null, trim: true })
  location!: string | null;

  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({
    type: String,
    enum: [...APPOINTMENT_STATUS],
    default: 'scheduled',
    index: true,
  })
  status!: AppointmentStatus;

  @Prop({ type: String, default: null })
  outcome!: string | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Appointment',
    default: null,
  })
  followUpOfId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type AppointmentDocument = HydratedDocument<Appointment>;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({ userId: 1, scheduledFor: -1 });
