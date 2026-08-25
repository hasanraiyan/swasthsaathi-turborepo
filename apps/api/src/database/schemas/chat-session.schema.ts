import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DEFAULT_SESSION_TITLE } from '@repo/contracts';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/** One conversation with the health assistant. */
@Schema({ collection: 'chat_sessions', ...ownedSchemaOptions })
export class ChatSession {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, default: DEFAULT_SESSION_TITLE, trim: true })
  title!: string;

  /**
   * Ordering key for the session list. Kept separate from `updatedAt` so
   * renaming a session doesn't push it to the top of the list.
   */
  @Prop({ type: Date, default: null })
  lastMessageAt!: Date | null;
}

export type ChatSessionDocument = HydratedDocument<ChatSession>;
export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.index({ userId: 1, lastMessageAt: -1 });
