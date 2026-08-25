import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { ownedSchemaOptions } from './schema-options';

/**
 * One virtual memory file, backing the `BaseStore` that deepagents reads and
 * writes through its `/memories/` filesystem routes.
 *
 * Namespaced rather than keyed by `userId` alone because that is the shape
 * `StoreBackend` addresses: `['users', <userId>]`. Content is markdown on
 * purpose -- when what is remembered is a person's health, they should be
 * able to read it, correct it and delete it. A vector store would search
 * faster and be impossible to inspect.
 */
@Schema({ collection: 'agent_memories', ...ownedSchemaOptions })
export class AgentMemory {
  /** e.g. `['users', 'user_123']`. */
  @Prop({ type: [String], required: true })
  namespace!: string[];

  /**
   * Denormalised from `namespace[1]` so the REST API and every ownership
   * check can scope the way the rest of the database does.
   */
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** File path with a leading slash, e.g. `/memories/user/index.md`. */
  @Prop({ type: String, required: true })
  key!: string;

  @Prop({ type: String, required: true, maxlength: 200_000 })
  content!: string;

  @Prop({ type: String, default: 'text/markdown' })
  mimeType!: string;
}

export type AgentMemoryDocument = HydratedDocument<AgentMemory>;
export const AgentMemorySchema = SchemaFactory.createForClass(AgentMemory);
AgentMemorySchema.index({ namespace: 1, key: 1 }, { unique: true });
AgentMemorySchema.index({ userId: 1, key: 1 });
