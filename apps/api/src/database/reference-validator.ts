import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Actor } from '@repo/contracts';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';

import { InvalidInputError } from '../common/errors';
import { Appointment } from './schemas/appointment.schema';
import { Condition } from './schemas/condition.schema';
import { Doctor } from './schemas/doctor.schema';
import { Medicine } from './schemas/medicine.schema';

/**
 * Checks that an id a client supplied as a link actually points at one of
 * *their own* records.
 *
 * Without this, a user could attach their medicine to a stranger's condition
 * id and then read that condition back through the joined view -- the classic
 * insecure-direct-object-reference hole, and a serious one when the objects
 * are health records.
 */
@Injectable()
export class ReferenceValidator {
  constructor(
    @InjectModel(Condition.name) private readonly conditions: Model<Condition>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Medicine.name) private readonly medicines: Model<Medicine>,
    @InjectModel(Appointment.name)
    private readonly appointments: Model<Appointment>,
  ) {}

  condition(
    actor: Actor,
    id: string | null | undefined,
    field = 'conditionId',
  ) {
    return this.resolve(this.conditions, actor, id, field);
  }

  doctor(actor: Actor, id: string | null | undefined, field = 'doctorId') {
    return this.resolve(this.doctors, actor, id, field);
  }

  medicine(actor: Actor, id: string | null | undefined, field = 'medicineId') {
    return this.resolve(this.medicines, actor, id, field);
  }

  appointment(
    actor: Actor,
    id: string | null | undefined,
    field = 'appointmentId',
  ) {
    return this.resolve(this.appointments, actor, id, field);
  }

  /** Same as `medicine()` but rejects a missing value instead of passing it through. */
  async requiredMedicine(
    actor: Actor,
    id: string,
    field = 'medicineId',
  ): Promise<Types.ObjectId> {
    const resolved = await this.medicine(actor, id, field);
    if (!resolved) {
      throw new InvalidInputError(`"${field}" is required`, [
        { path: field, message: 'A medicine id is required' },
      ]);
    }
    return resolved;
  }

  /**
   * `undefined` passes through untouched so `stripUndefined` can leave the
   * field alone on an update; `null` passes through to clear the link.
   */
  private async resolve<T>(
    model: Model<T>,
    actor: Actor,
    id: string | null | undefined,
    field: string,
  ): Promise<Types.ObjectId | null | undefined> {
    if (id === undefined) {
      return undefined;
    }
    if (id === null) {
      return null;
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new InvalidInputError(`"${field}" is not a valid id`, [
        { path: field, message: 'Expected a 24-character hex id' },
      ]);
    }
    const objectId = new Types.ObjectId(id);
    const exists = await model
      .exists({ _id: objectId, userId: actor.userId } as never)
      .exec();
    if (!exists) {
      throw new InvalidInputError(
        `"${field}" does not point at one of your records`,
        [{ path: field, message: 'No such record' }],
      );
    }
    return objectId;
  }
}
