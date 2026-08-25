import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DEFAULT_SESSION_TITLE } from '@repo/contracts';
import type {
  Actor,
  ById,
  ChatMessage as ChatMessageRecord,
  ChatSession as ChatSessionRecord,
  CreateSessionInput,
  DeleteResult,
  ListMessagesInput,
  ListResult,
  ListSessionsInput,
  MessageRole,
  ToolCall,
  UpdateSessionTitleInput,
} from '@repo/contracts';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors';
import { OwnedCrudService } from '../../../database/owned-crud.service';
import { ChatMessage } from '../../../database/schemas/chat-message.schema';
import { ChatSession } from '../../../database/schemas/chat-session.schema';
import { serializeAll } from '../../../database/serialize';

export interface AppendMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string | null;
}

/**
 * Conversations and their turns.
 *
 * Deliberately not exposed as capabilities: the agent should answer within a
 * conversation, not manage the list of them. Session housekeeping belongs to
 * the person, through the app.
 */
@Injectable()
export class SessionService extends OwnedCrudService<
  ChatSession,
  ChatSessionRecord
> {
  protected readonly entityName = 'Session';

  constructor(
    @InjectModel(ChatSession.name) protected readonly model: Model<ChatSession>,
    @InjectModel(ChatMessage.name)
    private readonly messages: Model<ChatMessage>,
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
      // Sessions that have never been used sort by when they were made, so a
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

  async remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    // Ownership first, so a bad id can't delete a stranger's messages on the
    // way to a 404.
    await this.getOwned(actor, id);
    await this.messages
      .deleteMany({ userId: actor.userId, sessionId: this.objectId(id) })
      .exec();
    return this.deleteOwned(actor, id);
  }

  async clear(actor: Actor): Promise<{ deleted: number }> {
    await this.messages.deleteMany({ userId: actor.userId }).exec();
    const result = await this.model.deleteMany({ userId: actor.userId }).exec();
    return { deleted: result.deletedCount ?? 0 };
  }

  // --- messages ----------------------------------------------------------

  async listMessages(
    actor: Actor,
    input: ListMessagesInput,
  ): Promise<ListResult<ChatMessageRecord>> {
    // Reading a session's messages must prove the session is the caller's;
    // the message query alone would happily scope to the wrong session.
    await this.getOwned(actor, input.sessionId);
    const filter = {
      userId: actor.userId,
      sessionId: this.objectId(input.sessionId),
    };

    const [docs, total] = await Promise.all([
      this.messages
        .find(filter)
        .sort({ createdAt: 1 })
        .skip(input.offset)
        .limit(input.limit)
        .lean()
        .exec(),
      this.messages.countDocuments(filter).exec(),
    ]);

    return {
      items: serializeAll<ChatMessageRecord>(docs),
      total,
      limit: input.limit,
      offset: input.offset,
    };
  }

  /** Append a turn and mark the session as active. */
  async appendMessage(
    actor: Actor,
    input: AppendMessageInput,
  ): Promise<ChatMessageRecord> {
    const sessionId = this.objectId(input.sessionId, 'sessionId');
    const created = await new this.messages({
      userId: actor.userId,
      sessionId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls ?? [],
      toolCallId: input.toolCallId ?? null,
    }).save();

    await this.model
      .updateOne(
        { _id: sessionId, userId: actor.userId },
        { $set: { lastMessageAt: new Date() } },
      )
      .exec();

    return serializeAll<ChatMessageRecord>([created.toObject()])[0];
  }

  /** The whole conversation, oldest first, for replaying to the model. */
  async transcript(
    actor: Actor,
    sessionId: string,
  ): Promise<ChatMessageRecord[]> {
    const docs = await this.messages
      .find({
        userId: actor.userId,
        sessionId: this.objectId(sessionId, 'sessionId'),
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return serializeAll<ChatMessageRecord>(docs);
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
