import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/**
 * Something the user felt, logged when they felt it.
 *
 * An entry is an episode, not a diagnosis: a start, an optional end, and a
 * severity the user chose. Its value is the pattern over time.
 */
@Schema({ collection: 'symptom_entries', ...ownedSchemaOptions })
export class SymptomEntry {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  @Prop({ type: Number, required: true, min: 1, max: 10 })
  severity!: number;

  @Prop({ type: Date, required: true, index: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  endedAt!: Date | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Condition',
    default: null,
    index: true,
  })
  conditionId!: Types.ObjectId | null;

  @Prop({ type: [String], default: [] })
  triggers!: string[];

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type SymptomEntryDocument = HydratedDocument<SymptomEntry>;
export const SymptomEntrySchema = SchemaFactory.createForClass(SymptomEntry);
SymptomEntrySchema.index({ userId: 1, startedAt: -1 });
