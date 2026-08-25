import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { medicineCapabilities } from '@repo/contracts';
import type {
  Actor,
  ById,
  CreateMedicineInput,
  DeleteResult,
  ListMedicinesInput,
  ListResult,
  MedicationSchedule as MedicationScheduleRecord,
  Medicine as MedicineRecord,
  MedicineWithSchedules,
  UpdateMedicineInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { today } from '../../common/dates';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { ReferenceValidator } from '../../database/reference-validator';
import { MedicationDose } from '../../database/schemas/medication-dose.schema';
import { MedicationSchedule } from '../../database/schemas/medication-schedule.schema';
import { Medicine } from '../../database/schemas/medicine.schema';
import { serializeAll } from '../../database/serialize';
import { escapeRegExp } from '../doctors/doctors.service';

/**
 * Medicines: the *what* of a user's treatment.
 *
 * Stopping and deleting are deliberately different operations. Stopping is
 * the everyday action -- the course ended, the doctor changed it -- and it
 * keeps the whole dose history, which is what makes an adherence record worth
 * showing anyone. Deleting is for a mistaken entry and takes the history
 * with it.
 */
@Injectable()
export class MedicinesService
  extends OwnedCrudService<Medicine, MedicineRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Medicine';

  constructor(
    @InjectModel(Medicine.name) protected readonly model: Model<Medicine>,
    @InjectModel(MedicationSchedule.name)
    private readonly schedules: Model<MedicationSchedule>,
    @InjectModel(MedicationDose.name)
    private readonly doses: Model<MedicationDose>,
    private readonly refs: ReferenceValidator,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(medicineCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(medicineCapabilities.get, (actor, input) =>
        this.get(actor, input),
      ),
      bindCapability(medicineCapabilities.create, (actor, input) =>
        this.create(actor, input),
      ),
      bindCapability(medicineCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(medicineCapabilities.stop, (actor, input) =>
        this.stop(actor, input),
      ),
      bindCapability(medicineCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListMedicinesInput,
  ): Promise<ListResult<MedicineRecord>> {
    const filter: QueryFilter<Medicine> = {};
    if (input.status) {
      filter.status = input.status;
    }
    if (input.conditionId) {
      filter.conditionId = this.objectId(input.conditionId, 'conditionId');
    }
    if (input.search) {
      const term = new RegExp(escapeRegExp(input.search), 'i');
      filter.$or = [{ name: term }, { purpose: term }];
    }
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        sort: { name: 1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  async get(actor: Actor, { id }: ById): Promise<MedicineWithSchedules> {
    const medicine = await this.getOwned(actor, id);
    const schedules = await this.schedules
      .find({ userId: actor.userId, medicineId: this.objectId(id) })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return {
      ...medicine,
      schedules: serializeAll<MedicationScheduleRecord>(schedules),
    };
  }

  async create(
    actor: Actor,
    input: CreateMedicineInput,
  ): Promise<MedicineRecord> {
    return this.createOwned(actor, {
      ...input,
      conditionId: await this.refs.condition(actor, input.conditionId),
      prescribedByDoctorId: await this.refs.doctor(
        actor,
        input.prescribedByDoctorId,
        'prescribedByDoctorId',
      ),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateMedicineInput,
  ): Promise<MedicineRecord> {
    return this.updateOwned(actor, id, {
      ...patch,
      conditionId: await this.refs.condition(actor, patch.conditionId),
      prescribedByDoctorId: await this.refs.doctor(
        actor,
        patch.prescribedByDoctorId,
        'prescribedByDoctorId',
      ),
    });
  }

  /**
   * End a course without losing its history.
   *
   * Schedules are deactivated and doses still in the future are removed --
   * leaving a reminder for a medicine the user was told to stop is the kind
   * of mistake a health app cannot afford.
   */
  async stop(
    actor: Actor,
    { id, endedOn, reason }: { id: string; endedOn?: string; reason?: string },
  ): Promise<MedicineRecord> {
    const medicine = await this.updateOwned(actor, id, {
      status: 'stopped',
      endedOn: endedOn ?? today(),
      stoppedReason: reason ?? null,
    });

    const medicineId = this.objectId(id);
    await this.schedules
      .updateMany(
        { userId: actor.userId, medicineId },
        { $set: { active: false } },
      )
      .exec();
    await this.doses
      .deleteMany({
        userId: actor.userId,
        medicineId,
        status: 'pending',
        scheduledFor: { $gt: new Date() },
      })
      .exec();

    return medicine;
  }

  async remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    // Confirm ownership before touching anything, so a bad id can't delete a
    // stranger's doses on the way to a 404.
    await this.getOwned(actor, id);
    const medicineId = this.objectId(id);
    await this.doses.deleteMany({ userId: actor.userId, medicineId }).exec();
    await this.schedules
      .deleteMany({ userId: actor.userId, medicineId })
      .exec();
    return this.deleteOwned(actor, id);
  }
}
