import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import type { Actor } from '@repo/contracts';
import {
  CompositeBackend,
  FilesystemBackend,
  StateBackend,
  StoreBackend,
  createDeepAgent,
} from 'deepagents';
import { MongoClient } from 'mongodb';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Model } from 'mongoose';

import { CapabilityRegistry } from '../../../capabilities/capability-registry.service';
import { AgentMemory } from '../../../database/schemas/agent-memory.schema';
import {
  MemoryFilesStore,
  userMemoryNamespace,
} from '../memory/memory-files.store';
import { ModelFactory } from './model.factory';
import { presentFileTool } from './present-file.tool';
import { readonlyBackend } from './readonly-backend';
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

### Files
Anything you produce for the user goes in \`/workspace/outputs/\` as a markdown
file, then \`present_file\` to open it for them. Do not paste a document you
have just written back into your reply as well -- they already have it.
Use this for anything worth keeping: a page to take to a doctor, a summary of
a period of readings. Not for a one-line answer.

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
  private skillCache: Array<{ name: string; description: string }> | null =
    null;

  constructor(
    @InjectModel(AgentMemory.name) memories: Model<AgentMemory>,
    private readonly registry: CapabilityRegistry,
    private readonly models: ModelFactory,
    private readonly config: ConfigService,
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
   * The skills on disk, by name.
   *
   * Read once: they ship with the code, so they cannot change while the
   * process is running, and re-reading the directory on every request would
   * be work for nothing. A malformed skill is skipped with a warning rather
   * than taking the assistant down.
   */
  skills(): Array<{ name: string; description: string }> {
    if (this.skillCache) {
      return this.skillCache;
    }

    const found: Array<{ name: string; description: string }> = [];
    try {
      for (const entry of readdirSync(this.skillsDir, {
        withFileTypes: true,
      })) {
        if (!entry.isDirectory()) {
          continue;
        }
        try {
          const source = readFileSync(
            join(this.skillsDir, entry.name, 'SKILL.md'),
            'utf8',
          );
          const description = /^description:\s*(.+)$/m
            .exec(source)?.[1]
            ?.trim();
          // The spec requires the name to match its directory, so the
          // directory is the name -- a mismatch in frontmatter is the bug.
          found.push({ name: entry.name, description: description ?? '' });
        } catch {
          this.logger.warn(
            `Skill "${entry.name}" has no readable SKILL.md; skipping.`,
          );
        }
      }
    } catch {
      this.logger.warn(`No skills directory at ${this.skillsDir}.`);
    }

    this.skillCache = found;
    return found;
  }

  /** Where skills live on disk. `cwd` is the app root in dev and in dist. */
  private get skillsDir(): string {
    return (
      this.config.get<string>('AGENT_SKILLS_DIR') ??
      join(process.cwd(), 'skills')
    );
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

    // `/workspace/` deliberately has no route: it falls through to the state
    // backend, so scratch files live with the conversation and are dropped
    // when it is. Only `/memories/` is meant to outlive a chat.
    const backend = new CompositeBackend(new StateBackend(), {
      '/memories/': new StoreBackend({ store: this.store, namespace }),
      '/skills/': readonlyBackend(
        new FilesystemBackend({ rootDir: this.skillsDir }),
        'Skills',
      ),
    });

    // Pause before anything that changes a health record. A model that
    // misreads "I stopped taking that" must not be able to act on it unseen.
    const interruptOn = confirmWrites
      ? Object.fromEntries(writeToolNames.map((name) => [name, true]))
      : {};

    return createDeepAgent({
      model: this.models.forChat(),
      systemPrompt: SYSTEM_PROMPT,
      tools: [...tools, presentFileTool()],
      checkpointer: this.checkpointer,
      store: this.store,
      backend,
      interruptOn,
      // Loaded into the system prompt each run; a missing file is skipped.
      memory: ['/memories/index.md'],
      // Read from disk, so what the assistant knows how to do is reviewed and
      // deployed like code rather than edited live.
      skills: ['/skills/'],
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
