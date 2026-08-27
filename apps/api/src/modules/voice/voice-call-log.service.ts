import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  Actor,
  ById,
  ListResult,
  ListVoiceCallsInput,
  VoiceCallLog as VoiceCallLogRecord,
} from '@repo/contracts';
import type { Model } from 'mongoose';

import { OwnedCrudService } from '../../database/owned-crud.service';
import { VoiceCallLog } from '../../database/schemas/voice-call-log.schema';

/**
 * A call as it looks before persistence: real `Date`s, not the ISO strings
 * `VoiceCallTurn` (the wire/contract shape) promises once serialized back
 * out. `serialize()` does that conversion on the way out of Mongo.
 */
export interface RecordedCall {
  linkedSessionId: string | null;
  model: string;
  startedAt: Date;
  endedAt: Date;
  endReason: string;
  turns: Array<{ role: 'user' | 'assistant'; text: string; at: Date }>;
}

/**
 * The record a finished voice call leaves behind.
 *
 * Written once, by `VoiceCallService`, when a call ends -- there is no
 * per-turn persistence, matching how a call's transcript is assembled in
 * memory for the call's duration first. See the schema for why this is its
 * own collection rather than living in the same place as text chat history.
 */
@Injectable()
export class VoiceCallLogService extends OwnedCrudService<
  VoiceCallLog,
  VoiceCallLogRecord
> {
  protected readonly entityName = 'Call';

  constructor(
    @InjectModel(VoiceCallLog.name)
    protected readonly model: Model<VoiceCallLog>,
  ) {
    super();
  }

  record(actor: Actor, call: RecordedCall): Promise<VoiceCallLogRecord> {
    // Spread into a fresh literal: `createOwned` takes `Record<string,
    // unknown>`, which a named interface's variable doesn't structurally
    // satisfy even though every value in it is fine.
    return this.createOwned(actor, { ...call });
  }

  async list(
    actor: Actor,
    input: ListVoiceCallsInput,
  ): Promise<ListResult<VoiceCallLogRecord>> {
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        sort: { startedAt: -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  get(actor: Actor, { id }: ById): Promise<VoiceCallLogRecord> {
    return this.getOwned(actor, id);
  }
}
