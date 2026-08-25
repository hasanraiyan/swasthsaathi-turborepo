import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { medicationScheduleCapabilities } from '@repo/contracts';
import type {
  Actor,
  ById,
  CreateMedicationScheduleInput,
  DeleteResult,
  ListMedicationSchedulesInput,
  ListResult,
  MedicationSchedule as MedicationScheduleRecord,
  UpdateMedicationScheduleInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { today } from '../../common/dates';
import { ConflictError } from '../../common/errors';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { ReferenceValidator } from '../../database/reference-validator';
import { MedicationDose } from '../../database/schemas/medication-dose.schema';
import { MedicationSchedule } from '../../database/schemas/medication-schedule.schema';

/**
 * Medication schedules: the *when* of a medicine.
 *
 * Changing a schedule only affects doses that haven't happened yet. Doses
 * already logged keep the amount and timing they were actually taken at,
 * because rewriting them would quietly falsify the adherence history.
 */
@Injectable()
export class MedicationSchedulesService
  extends OwnedCrudService<MedicationSchedule, MedicationScheduleRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Medication schedule';

  constructor(
    @InjectModel(MedicationSchedule.name)
    protected readonly model: Model<MedicationSchedule>,
    @InjectModel(MedicationDose.name)
    private readonly doses: Model<MedicationDose>,
    private readonly refs: ReferenceValidator,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(medicationScheduleCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(medicationScheduleCapabilities.create, (actor, input) =>
        this.create(actor, input),
      ),
      bindCapability(medicationScheduleCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(medicationScheduleCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListMedicationSchedulesInput,
  ): Promise<ListResult<MedicationScheduleRecord>> {
    const filter: QueryFilter<MedicationSchedule> = {};
    if (input.medicineId) {
      filter.medicineId = this.objectId(input.medicineId, 'medicineId');
    }
    if (input.activeOnly) {
      filter.active = true;
    }
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        sort: { createdAt: 1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  async create(
    actor: Actor,
    input: CreateMedicationScheduleInput,
  ): Promise<MedicationScheduleRecord> {
    const medicineId = await this.refs.requiredMedicine(
      actor,
      input.medicineId,
    );
    const startsOn = input.startsOn ?? today();
    assertRangeIsValid(startsOn, input.endsOn ?? null);

    return this.createOwned(actor, {
      ...input,
      medicineId,
      startsOn,
      // A duplicate time would materialise two doses at the same instant and
      // fail the unique index, so collapse them up front.
      timesOfDay: [...new Set(input.timesOfDay)].sort(),
      daysOfWeek: [...new Set(input.daysOfWeek)].sort(),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateMedicationScheduleInput,
  ): Promise<MedicationScheduleRecord> {
    const current = await this.getOwned(actor, id);
    const startsOn = patch.startsOn ?? current.startsOn;
    const endsOn = patch.endsOn === undefined ? current.endsOn : patch.endsOn;
    assertRangeIsValid(startsOn, endsOn ?? null);

    const updated = await this.updateOwned(actor, id, {
      ...patch,
      ...(patch.timesOfDay
        ? { timesOfDay: [...new Set(patch.timesOfDay)].sort() }
        : {}),
      ...(patch.daysOfWeek
        ? { daysOfWeek: [...new Set(patch.daysOfWeek)].sort() }
        : {}),
    });

    // Drop future doses so the next day view re-materialises them from the
    // new timing. Anything already taken, skipped or missed is left alone.
    await this.doses
      .deleteMany({
        userId: actor.userId,
        scheduleId: this.objectId(id),
        status: 'pending',
        scheduledFor: { $gt: new Date() },
      })
      .exec();

    return updated;
  }

  async remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    await this.getOwned(actor, id);
    await this.doses
      .deleteMany({
        userId: actor.userId,
        scheduleId: this.objectId(id),
        status: 'pending',
      })
      .exec();
    return this.deleteOwned(actor, id);
  }
}

function assertRangeIsValid(startsOn: string, endsOn: string | null): void {
  if (endsOn && endsOn < startsOn) {
    throw new ConflictError('A schedule cannot end before it starts');
  }
}
