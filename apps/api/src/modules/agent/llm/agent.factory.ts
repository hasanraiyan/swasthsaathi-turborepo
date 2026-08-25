import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import type { Actor } from '@repo/contracts';
import {
  CompositeBackend,
  StateBackend,
  StoreBackend,
  createDeepAgent,
} from 'deepagents';
import { MongoClient } from 'mongodb';
import type { Model } from 'mongoose';

import { CapabilityRegistry } from '../../../capabilities/capability-registry.service';
import { AgentMemory } from '../../../database/schemas/agent-memory.schema';
import {
  MemoryFilesStore,
  userMemoryNamespace,
} from '../memory/memory-files.store';
import { ModelFactory } from './model.factory';
import { buildToolset } from './tool-adapter';

const SYSTEM_PROMPT = `You are Swasthya Saathi, a health companion.

You help someone stay on top of their health journey: what they take, how they
feel, who they see, and the checks worth doing before anything is wrong. Your
purpose is prevention as much as treatment.

You are not a doctor. Never diagnose and never prescribe. When something sounds
urgent, say so plainly and tell them to seek care now.

Use your tools to read and change their record rather than guessing or asking
them to repeat what is already there. Speak plainly and briefly; most people
read this on a phone, often while unwell.

### Memory
Your filesystem has a \`/memories/\` directory that survives every conversation.
- \`/memories/index.md\` is loaded for you automatically. Never read it yourself.
- Keep it an index, not a dump: one line per topic pointing at its own file,
  e.g. "- Prefers Hindi for medicine names -> /memories/preferences.md".
- Move a topic into its own file once it outgrows two or three lines.
Record lasting facts and preferences. Never record a passing detail of today's
conversation.`;

/**
 * Builds the agent.
 *
 * Everything that makes this a *deep* agent -- persisted conversation state,
 * long-term memory as a filesystem, and pausing before a write -- comes from
 * `createDeepAgent` rather than a hand-written loop. What this project
 * supplies is the part that is actually ours: the tools, which are the
 * capability registry, and the memory store behind `/memories/`.
 */
@Injectable()
export class AgentFactory {
  private readonly logger = new Logger(AgentFactory.name);
  private readonly checkpointer: MongoDBSaver;
  private readonly store: MemoryFilesStore;

  constructor(
    @InjectModel(AgentMemory.name) memories: Model<AgentMemory>,
    private readonly registry: CapabilityRegistry,
    private readonly models: ModelFactory,
    config: ConfigService,
  ) {
    // The checkpointer gets its own client on purpose. It is built against
    // driver 6, while Mongoose 9 brings driver 7, and the two `MongoClient`
    // types are not interchangeable -- so the app connection cannot be
    // shared with it. A second pooled client is the cost of that mismatch.
    const uri = config.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error(
        'MONGODB_URI is not set; the assistant cannot persist conversations.',
      );
    }
    this.checkpointer = new MongoDBSaver({ client: new MongoClient(uri) });
    this.store = new MemoryFilesStore(memories);
  }

  /**
   * One agent per caller.
   *
   * Not cached: the tools close over the actor so that every capability call
   * is scoped to the person who asked. Sharing an instance between users
   * would be the one mistake in this whole design that leaks health records.
   */
  build(actor: Actor, confirmWrites: boolean) {
    const { tools, writeToolNames } = buildToolset(this.registry, actor);

    const namespace = userMemoryNamespace(actor.userId);
    const backend = new CompositeBackend(new StateBackend(), {
      '/memories/': new StoreBackend({ store: this.store, namespace }),
    });

    // Pause before anything that changes a health record. A model that
    // misreads "I stopped taking that" must not be able to act on it unseen.
    const interruptOn = confirmWrites
      ? Object.fromEntries(writeToolNames.map((name) => [name, true]))
      : {};

    return createDeepAgent({
      model: this.models.forChat(),
      systemPrompt: SYSTEM_PROMPT,
      tools,
      checkpointer: this.checkpointer,
      store: this.store,
      backend,
      interruptOn,
      // Loaded into the system prompt each run; a missing file is skipped.
      memory: ['/memories/index.md'],
    });
  }

  /** Drops a conversation's persisted state when its session is deleted. */
  async forgetThread(threadId: string): Promise<void> {
    try {
      await this.checkpointer.deleteThread(threadId);
    } catch (error) {
      this.logger.warn(
        `Could not clear checkpoints for ${threadId}: ${String(error)}`,
      );
    }
  }
}
