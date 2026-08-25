import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { symptomCapabilities } from '@repo/contracts';
import type {
  Actor,
  ById,
  CreateSymptomEntryInput,
  DeleteResult,
  ListResult,
  ListSymptomEntriesInput,
  SymptomEntry as SymptomEntryRecord,
  UpdateSymptomEntryInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { endOfDayExclusive, startOfDay } from '../../common/dates';
import { ConflictError } from '../../common/errors';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { ReferenceValidator } from '../../database/reference-validator';
import { SymptomEntry } from '../../database/schemas/symptom-entry.schema';
import { escapeRegExp } from '../doctors/doctors.service';

/** Symptom episodes. The value is the pattern over time, not any one entry. */
@Injectable()
export class SymptomsService
  extends OwnedCrudService<SymptomEntry, SymptomEntryRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Symptom entry';

  constructor(
    @InjectModel(SymptomEntry.name)
    protected readonly model: Model<SymptomEntry>,
    private readonly refs: ReferenceValidator,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(symptomCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(symptomCapabilities.get, (actor, input) =>
        this.get(actor, input),
      ),
      bindCapability(symptomCapabilities.log, (actor, input) =>
        this.log(actor, input),
      ),
      bindCapability(symptomCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(symptomCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListSymptomEntriesInput,
  ): Promise<ListResult<SymptomEntryRecord>> {
    const filter: QueryFilter<SymptomEntry> = {};
    if (input.name) {
      // Anchored so "head" doesn't also match "lightheadedness".
      filter.name = new RegExp(`^${escapeRegExp(input.name)}$`, 'i');
    }
    if (input.conditionId) {
      filter.conditionId = this.objectId(input.conditionId, 'conditionId');
    }
    if (input.ongoingOnly) {
      filter.endedAt = null;
    }
    if (input.from || input.to) {
      filter.startedAt = {
        ...(input.from ? { $gte: startOfDay(input.from) } : {}),
        ...(input.to ? { $lt: endOfDayExclusive(input.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        sort: { startedAt: -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  get(actor: Actor, { id }: ById): Promise<SymptomEntryRecord> {
    return this.getOwned(actor, id);
  }

  async log(
    actor: Actor,
    input: CreateSymptomEntryInput,
  ): Promise<SymptomEntryRecord> {
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    const endedAt = input.endedAt ? new Date(input.endedAt) : null;
    assertOrder(startedAt, endedAt);

    return this.createOwned(actor, {
      ...input,
      startedAt,
      endedAt,
      conditionId: await this.refs.condition(actor, input.conditionId),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateSymptomEntryInput,
  ): Promise<SymptomEntryRecord> {
    const current = await this.getOwned(actor, id);
    const startedAt = patch.startedAt
      ? new Date(patch.startedAt)
      : new Date(current.startedAt);
    const endedAt =
      patch.endedAt === undefined
        ? current.endedAt
          ? new Date(current.endedAt)
          : null
        : patch.endedAt
          ? new Date(patch.endedAt)
          : null;
    assertOrder(startedAt, endedAt);

    return this.updateOwned(actor, id, {
      ...patch,
      ...(patch.startedAt ? { startedAt } : {}),
      ...(patch.endedAt !== undefined ? { endedAt } : {}),
      conditionId: await this.refs.condition(actor, patch.conditionId),
    });
  }

  remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    return this.deleteOwned(actor, id);
  }
}

function assertOrder(startedAt: Date, endedAt: Date | null): void {
  if (endedAt && endedAt < startedAt) {
    throw new ConflictError('A symptom cannot end before it started');
  }
}
