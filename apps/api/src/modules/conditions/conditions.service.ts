import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { conditionCapabilities } from '@repo/contracts';
import type {
  Actor,
  ById,
  Condition as ConditionRecord,
  CreateConditionInput,
  DeleteResult,
  ListConditionsInput,
  ListResult,
  UpdateConditionInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { ReferenceValidator } from '../../database/reference-validator';
import { Condition } from '../../database/schemas/condition.schema';

/**
 * Health conditions -- the spine the rest of the record hangs off.
 *
 * Deleting a condition deliberately leaves medicines, symptoms and documents
 * in place with a dangling link cleared elsewhere; losing the history of what
 * someone took would be worse than losing the label for why.
 */
@Injectable()
export class ConditionsService
  extends OwnedCrudService<Condition, ConditionRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Condition';

  constructor(
    @InjectModel(Condition.name) protected readonly model: Model<Condition>,
    private readonly refs: ReferenceValidator,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(conditionCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(conditionCapabilities.get, (actor, input) =>
        this.get(actor, input),
      ),
      bindCapability(conditionCapabilities.create, (actor, input) =>
        this.create(actor, input),
      ),
      bindCapability(conditionCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(conditionCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListConditionsInput,
  ): Promise<ListResult<ConditionRecord>> {
    const filter: QueryFilter<Condition> = {};
    if (input.status) {
      filter.status = input.status;
    }
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  get(actor: Actor, { id }: ById): Promise<ConditionRecord> {
    return this.getOwned(actor, id);
  }

  async create(
    actor: Actor,
    input: CreateConditionInput,
  ): Promise<ConditionRecord> {
    return this.createOwned(actor, {
      ...input,
      diagnosedByDoctorId: await this.refs.doctor(
        actor,
        input.diagnosedByDoctorId,
        'diagnosedByDoctorId',
      ),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateConditionInput,
  ): Promise<ConditionRecord> {
    return this.updateOwned(actor, id, {
      ...patch,
      diagnosedByDoctorId: await this.refs.doctor(
        actor,
        patch.diagnosedByDoctorId,
        'diagnosedByDoctorId',
      ),
    });
  }

  remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    return this.deleteOwned(actor, id);
  }
}
