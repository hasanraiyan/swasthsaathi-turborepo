import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { memoryCapabilities } from '@repo/contracts';
import type {
  Actor,
  AgentMemory as AgentMemoryRecord,
  DeleteMemoryInput,
  ListResult,
  WriteMemoryInput,
} from '@repo/contracts';
import type { Model } from 'mongoose';

import { bindCapability } from '../../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../../capabilities/capability.types';
import { NotFoundError } from '../../../common/errors';
import { OwnedCrudService } from '../../../database/owned-crud.service';
import { AgentMemory } from '../../../database/schemas/agent-memory.schema';
import { serialize } from '../../../database/serialize';

/** Keeps a runaway agent from filling the context window with its own notes. */
const MAX_NOTES = 60;

/**
 * What the assistant remembers between conversations.
 *
 * Exposed as capabilities rather than wired into the agent directly, so the
 * same three operations serve the agent as tools, the REST API, and anything
 * added later -- with one implementation and one ownership check.
 */
@Injectable()
export class MemoryService
  extends OwnedCrudService<AgentMemory, AgentMemoryRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Memory';

  constructor(
    @InjectModel(AgentMemory.name) protected readonly model: Model<AgentMemory>,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(memoryCapabilities.list, (actor) => this.list(actor)),
      bindCapability(memoryCapabilities.write, (actor, input) =>
        this.write(actor, input),
      ),
      bindCapability(memoryCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(actor: Actor): Promise<ListResult<AgentMemoryRecord>> {
    const [items, total] = await Promise.all([
      this.listOwned(actor, { sort: { key: 1 }, limit: MAX_NOTES }),
      this.countOwned(actor),
    ]);
    return { items, total, limit: MAX_NOTES, offset: 0 };
  }

  /** Write or replace the note under this key. */
  async write(
    actor: Actor,
    input: WriteMemoryInput,
  ): Promise<AgentMemoryRecord> {
    const doc = await this.model
      .findOneAndUpdate(
        { userId: actor.userId, key: input.key },
        {
          $set: { content: input.content },
          $setOnInsert: { userId: actor.userId, key: input.key },
        },
        {
          returnDocument: 'after',
          upsert: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      )
      .lean()
      .exec();
    return serialize<AgentMemoryRecord>(doc);
  }

  async remove(
    actor: Actor,
    input: DeleteMemoryInput,
  ): Promise<{ key: string; deleted: true }> {
    const result = await this.model
      .deleteOne({ userId: actor.userId, key: input.key })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundError('Memory not found');
    }
    return { key: input.key, deleted: true };
  }

  async clear(actor: Actor): Promise<{ deleted: number }> {
    const result = await this.model.deleteMany({ userId: actor.userId }).exec();
    return { deleted: result.deletedCount ?? 0 };
  }

  /**
   * Everything remembered, as one markdown block for the system prompt.
   * Empty string when there is nothing, so the caller can leave the section
   * out rather than telling the model it knows nothing.
   */
  async asPromptSection(actor: Actor): Promise<string> {
    const { items } = await this.list(actor);
    if (items.length === 0) {
      return '';
    }
    return items.map((note) => `## ${note.key}\n${note.content}`).join('\n\n');
  }
}
