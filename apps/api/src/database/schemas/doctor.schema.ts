import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/** The user's own address book of clinicians. Not a provider directory. */
@Schema({ collection: 'doctors', ...ownedSchemaOptions })
export class Doctor {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: null, trim: true })
  specialty!: string | null;

  @Prop({ type: String, default: null, trim: true })
  hospital!: string | null;

  @Prop({ type: String, default: null, trim: true })
  phone!: string | null;

  @Prop({ type: String, default: null, trim: true, lowercase: true })
  email!: string | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type DoctorDocument = HydratedDocument<Doctor>;
export const DoctorSchema = SchemaFactory.createForClass(Doctor);
DoctorSchema.index({ userId: 1, name: 1 });
