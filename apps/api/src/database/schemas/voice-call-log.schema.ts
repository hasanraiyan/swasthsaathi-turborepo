import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/** One turn of a call's transcript, from Gemini's input/output transcription. */
export class VoiceCallTurn {
  @Prop({ type: String, required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ type: String, required: true })
  text!: string;

  @Prop({ type: Date, required: true })
  at!: Date;
}

/**
 * The record a finished voice call leaves behind.
 *
 * Deliberately separate from `ChatSession`: text chat's only message store is
 * the LangGraph checkpointer, keyed by session id, and there is no supported
 * way to append to that outside of a real graph run. Rather than write into
 * checkpointer internals, a call gets its own record. `linkedSessionId` is a
 * display-only pointer for a future "opened from this chat" affordance, not
 * a foreign key text chat's history reads from.
 */
@Schema({ collection: 'voice_call_logs', ...ownedSchemaOptions })
export class VoiceCallLog {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChatSession',
    default: null,
  })
  linkedSessionId!: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: Date, required: true, index: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  endedAt!: Date | null;

  @Prop({ type: String, default: null })
  endReason!: string | null;

  @Prop({ type: [VoiceCallTurn], default: [] })
  turns!: VoiceCallTurn[];
}

export type VoiceCallLogDocument = HydratedDocument<VoiceCallLog>;
export const VoiceCallLogSchema = SchemaFactory.createForClass(VoiceCallLog);
VoiceCallLogSchema.index({ userId: 1, startedAt: -1 });
