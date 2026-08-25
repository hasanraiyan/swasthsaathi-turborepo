import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MESSAGE_ROLE } from '@repo/contracts';
import type { MessageRole, ToolCall } from '@repo/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/**
 * A turn in a conversation.
 *
 * Stored rather than reconstructed from the model provider: the history is
 * the product's own record, it has to survive changing model or provider, and
 * the session list needs to read it without replaying anything.
 */
@Schema({ collection: 'chat_messages', ...ownedSchemaOptions })
export class ChatMessage {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  })
  sessionId!: Types.ObjectId;

  @Prop({ type: String, enum: [...MESSAGE_ROLE], required: true })
  role!: MessageRole;

  @Prop({ type: String, default: '' })
  content!: string;

  /** Tools this assistant turn asked for. Empty on user and tool turns. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: [] })
  toolCalls!: ToolCall[];

  /** On a `tool` turn, the call it answers. */
  @Prop({ type: String, default: null })
  toolCallId!: string | null;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
// The only read that matters: one session's turns, in the order they happened.
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
