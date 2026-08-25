import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PREVENTIVE_CHECK } from '@repo/contracts';
import type { PreventiveCheckKey } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { DATE_ONLY_MATCH, ownedSchemaOptions } from './schema-options';

/**
 * A preventive check the user actually completed.
 *
 * The only thing the prevention module writes down. Which checks apply and
 * when they are next due is derived on every read from the baseline, the
 * conditions on record and these completions -- so a plan cannot go stale,
 * and changing a risk factor needs no migration.
 */
@Schema({ collection: 'preventive_check_logs', ...ownedSchemaOptions })
export class PreventiveCheckLog {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: String,
    enum: [...PREVENTIVE_CHECK],
    required: true,
    index: true,
  })
  checkKey!: PreventiveCheckKey;

  @Prop({ type: String, required: true, match: DATE_ONLY_MATCH })
  completedOn!: string;

  @Prop({ type: String, default: null })
  note!: string | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Measurement',
    default: null,
  })
  measurementId!: Types.ObjectId | null;

  /** When it was entered, as opposed to the day it happened. */
  @Prop({ type: Date, default: Date.now })
  recordedAt!: Date;
}

export type PreventiveCheckLogDocument = HydratedDocument<PreventiveCheckLog>;
export const PreventiveCheckLogSchema =
  SchemaFactory.createForClass(PreventiveCheckLog);
PreventiveCheckLogSchema.index({ userId: 1, checkKey: 1, completedOn: -1 });
