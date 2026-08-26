import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DEFAULT_SESSION_TITLE } from '@repo/contracts';
import type {
  Actor,
  ById,
  ChatSession as ChatSessionRecord,
  CreateSessionInput,
  DeleteResult,
  ListResult,
  ListSessionsInput,
  UpdateSessionTitleInput,
} from '@repo/contracts';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors';
import { OwnedCrudService } from '../../../database/owned-crud.service';
import { ChatSession } from '../../../database/schemas/chat-session.schema';
import { serializeAll } from '../../../database/serialize';
import { AgentFactory } from '../llm/agent.factory';

/**
 * Conversations.
 *
 * A session record holds only what the graph does not: a title and when it
 * was last used. The turns themselves live in the checkpointer, which is why
 * deleting one has to reach in there as well.
 *
 * Deliberately not exposed as capabilities: the agent should answer within a
 * conversation, not manage the list of them.
 */
@Injectable()
export class SessionService extends OwnedCrudService<
  ChatSession,
  ChatSessionRecord
> {
  protected readonly entityName = 'Session';

  constructor(
    @InjectModel(ChatSession.name) protected readonly model: Model<ChatSession>,
    private readonly agents: AgentFactory,
  ) {
    super();
  }

  create(actor: Actor, input: CreateSessionInput): Promise<ChatSessionRecord> {
    return this.createOwned(actor, {
      title: input.title?.trim() || DEFAULT_SESSION_TITLE,
      lastMessageAt: null,
    });
  }

  async list(
    actor: Actor,
    input: ListSessionsInput,
  ): Promise<ListResult<ChatSessionRecord>> {
    const [items, total] = await Promise.all([
      // A session that has never been used sorts by when it was made, so a
      // freshly created one still appears at the top.
      this.listOwned(actor, {
        sort: { lastMessageAt: -1, createdAt: -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  get(actor: Actor, { id }: ById): Promise<ChatSessionRecord> {
    return this.getOwned(actor, id);
  }

  updateTitle(
    actor: Actor,
    { id, title }: UpdateSessionTitleInput,
  ): Promise<ChatSessionRecord> {
    return this.updateOwned(actor, id, { title: title.trim() });
  }

  /** Bump a session to the top of the list after it has been used. */
  async touch(actor: Actor, sessionId: string): Promise<void> {
    await this.model
      .updateOne(
        { _id: this.objectId(sessionId, 'sessionId'), userId: actor.userId },
        { $set: { lastMessageAt: new Date() } },
      )
      .exec();
  }

  /** Used by auto-titling, which must not overwrite a title the user chose. */
  async retitleIfUntouched(
    actor: Actor,
    sessionId: string,
    title: string,
  ): Promise<boolean> {
    const result = await this.model
      .updateOne(
        {
          _id: this.objectId(sessionId),
          userId: actor.userId,
          title: DEFAULT_SESSION_TITLE,
        },
        { $set: { title } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  /**
   * Delete a conversation, including what was said in it.
   *
   * The record alone is not the conversation -- every turn lives in the
   * checkpointer under the same id. Dropping only the record would leave the
   * whole transcript on disk indefinitely, which is not what someone
   * deleting a health conversation expects or should have to accept.
   */
  async remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    // Ownership first, so a bad id can never clear someone else's history.
    await this.getOwned(actor, id);
    await this.agents.forgetThread(id);
    return this.deleteOwned(actor, id);
  }

  async clear(actor: Actor): Promise<{ deleted: number }> {
    const owned = await this.model
      .find({ userId: actor.userId })
      .select('_id')
      .lean()
      .exec();

    // Sequential rather than parallel: this is rare and not urgent, and
    // firing one checkpointer delete per session at once would spike the
    // connection pool for no benefit.
    for (const session of owned) {
      await this.agents.forgetThread(String(session._id));
    }

    const result = await this.model.deleteMany({ userId: actor.userId }).exec();
    return { deleted: result.deletedCount ?? 0 };
  }

  /** Resolve the session to run in, creating one when none was given. */
  async resolveForRun(
    actor: Actor,
    sessionId?: string,
  ): Promise<ChatSessionRecord> {
    if (!sessionId) {
      return this.create(actor, {});
    }
    const session = await this.model
      .findOne({
        _id: this.objectId(sessionId, 'sessionId'),
        userId: actor.userId,
      })
      .lean()
      .exec();
    if (!session) {
      // Same response whether it is missing or someone else's -- a run must
      // never resume a conversation that is not the caller's.
      throw new NotFoundError('Session not found');
    }
    return serializeAll<ChatSessionRecord>([session])[0];
  }
}
