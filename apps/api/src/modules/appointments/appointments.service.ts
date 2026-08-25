import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { appointmentCapabilities } from '@repo/contracts';
import type {
  Actor,
  Appointment as AppointmentRecord,
  ById,
  CreateAppointmentInput,
  DeleteResult,
  ListAppointmentsInput,
  ListResult,
  UpdateAppointmentInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { ReferenceValidator } from '../../database/reference-validator';
import { Appointment } from '../../database/schemas/appointment.schema';

/**
 * Visits to doctors, labs and clinics.
 *
 * Sorted newest-first by default because the common question is "what did the
 * doctor say last time"; `upcomingOnly` flips the view for "what's next".
 */
@Injectable()
export class AppointmentsService
  extends OwnedCrudService<Appointment, AppointmentRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Appointment';

  constructor(
    @InjectModel(Appointment.name) protected readonly model: Model<Appointment>,
    private readonly refs: ReferenceValidator,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(appointmentCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(appointmentCapabilities.get, (actor, input) =>
        this.get(actor, input),
      ),
      bindCapability(appointmentCapabilities.create, (actor, input) =>
        this.create(actor, input),
      ),
      bindCapability(appointmentCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(appointmentCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListAppointmentsInput,
  ): Promise<ListResult<AppointmentRecord>> {
    const filter: QueryFilter<Appointment> = {};
    if (input.status) {
      filter.status = input.status;
    }
    if (input.doctorId) {
      filter.doctorId = this.objectId(input.doctorId, 'doctorId');
    }
    if (input.conditionId) {
      filter.conditionId = this.objectId(input.conditionId, 'conditionId');
    }
    if (input.upcomingOnly) {
      filter.scheduledFor = { $gte: new Date() };
    }

    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        // Upcoming reads forward in time; history reads backward.
        sort: { scheduledFor: input.upcomingOnly ? 1 : -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  get(actor: Actor, { id }: ById): Promise<AppointmentRecord> {
    return this.getOwned(actor, id);
  }

  async create(
    actor: Actor,
    input: CreateAppointmentInput,
  ): Promise<AppointmentRecord> {
    return this.createOwned(actor, {
      ...input,
      scheduledFor: new Date(input.scheduledFor),
      doctorId: await this.refs.doctor(actor, input.doctorId),
      conditionId: await this.refs.condition(actor, input.conditionId),
      followUpOfId: await this.refs.appointment(
        actor,
        input.followUpOfId,
        'followUpOfId',
      ),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateAppointmentInput,
  ): Promise<AppointmentRecord> {
    return this.updateOwned(actor, id, {
      ...patch,
      ...(patch.scheduledFor
        ? { scheduledFor: new Date(patch.scheduledFor) }
        : {}),
      doctorId: await this.refs.doctor(actor, patch.doctorId),
      conditionId: await this.refs.condition(actor, patch.conditionId),
      followUpOfId: await this.refs.appointment(
        actor,
        patch.followUpOfId,
        'followUpOfId',
      ),
    });
  }

  remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    return this.deleteOwned(actor, id);
  }
}
