import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MEASUREMENT_TYPE } from '@repo/contracts';
import type { MeasurementType } from '@repo/contracts';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/**
 * A vital sign reading.
 *
 * `valueSecondary` exists for blood pressure: 120/80 is one reading, not two,
 * and splitting it across rows would make it impossible to chart as a pair or
 * hand to a doctor.
 */
@Schema({ collection: 'measurements', ...ownedSchemaOptions })
export class Measurement {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: String,
    enum: [...MEASUREMENT_TYPE],
    required: true,
    index: true,
  })
  type!: MeasurementType;

  @Prop({ type: Number, required: true })
  value!: number;

  @Prop({ type: Number, default: null })
  valueSecondary!: number | null;

  @Prop({ type: String, required: true })
  unit!: string;

  @Prop({ type: Date, required: true, index: true })
  measuredAt!: Date;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type MeasurementDocument = HydratedDocument<Measurement>;
export const MeasurementSchema = SchemaFactory.createForClass(Measurement);
MeasurementSchema.index({ userId: 1, type: 1, measuredAt: -1 });
