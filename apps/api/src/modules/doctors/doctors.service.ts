import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { doctorCapabilities } from '@repo/contracts';
import type {
  Actor,
  ById,
  CreateDoctorInput,
  DeleteResult,
  Doctor as DoctorRecord,
  ListDoctorsInput,
  ListResult,
  UpdateDoctorInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { Doctor } from '../../database/schemas/doctor.schema';

/** The user's own list of clinicians. */
@Injectable()
export class DoctorsService
  extends OwnedCrudService<Doctor, DoctorRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Doctor';

  constructor(
    @InjectModel(Doctor.name) protected readonly model: Model<Doctor>,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(doctorCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(doctorCapabilities.get, (actor, input) =>
        this.get(actor, input),
      ),
      bindCapability(doctorCapabilities.create, (actor, input) =>
        this.create(actor, input),
      ),
      bindCapability(doctorCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(doctorCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListDoctorsInput,
  ): Promise<ListResult<DoctorRecord>> {
    const filter: QueryFilter<Doctor> = {};
    if (input.search) {
      // Escaped so a user searching for "Dr. A+" doesn't hand us a broken regex.
      const term = new RegExp(escapeRegExp(input.search), 'i');
      filter.$or = [{ name: term }, { specialty: term }, { hospital: term }];
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

  get(actor: Actor, { id }: ById): Promise<DoctorRecord> {
    return this.getOwned(actor, id);
  }

  create(actor: Actor, input: CreateDoctorInput): Promise<DoctorRecord> {
    return this.createOwned(actor, { ...input });
  }

  update(
    actor: Actor,
    { id, ...patch }: UpdateDoctorInput,
  ): Promise<DoctorRecord> {
    return this.updateOwned(actor, id, { ...patch });
  }

  remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    return this.deleteOwned(actor, id);
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
