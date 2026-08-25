import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DOCUMENT_KIND } from '@repo/contracts';
import type { DocumentKind } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { DATE_ONLY_MATCH, ownedSchemaOptions } from './schema-options';

/**
 * A medical document the user has kept: a lab report, prescription or scan.
 *
 * Metadata only. The file lives in object storage under `storageKey`;
 * download URLs are minted per request and never stored, so a leaked
 * document row can't be turned into a leaked report.
 *
 * Named `HealthDocument` because `Document` collides with Mongoose's own.
 */
@Schema({ collection: 'documents', ...ownedSchemaOptions })
export class HealthDocument {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({
    type: String,
    enum: [...DOCUMENT_KIND],
    default: 'other',
    index: true,
  })
  kind!: DocumentKind;

  @Prop({ type: String, default: null, match: DATE_ONLY_MATCH })
  documentDate!: string | null;

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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Appointment',
    default: null,
  })
  appointmentId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  storageKey!: string | null;

  @Prop({ type: String, default: null })
  mimeType!: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  sizeBytes!: number | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type HealthDocumentDocument = HydratedDocument<HealthDocument>;
export const HealthDocumentSchema =
  SchemaFactory.createForClass(HealthDocument);
HealthDocumentSchema.index({ userId: 1, documentDate: -1 });
