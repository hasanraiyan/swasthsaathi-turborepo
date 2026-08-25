import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { documentCapabilities } from '@repo/contracts';
import type {
  Actor,
  ById,
  CreateDocumentInput,
  DeleteResult,
  HealthDocument as HealthDocumentRecord,
  ListDocumentsInput,
  ListResult,
  UpdateDocumentInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { ReferenceValidator } from '../../database/reference-validator';
import { HealthDocument } from '../../database/schemas/health-document.schema';
import { escapeRegExp } from '../doctors/doctors.service';

/**
 * Lab reports, prescriptions and scans.
 *
 * Metadata only -- the file lives in object storage. Uploading is not wired
 * up yet, so `storageKey` is accepted but nothing mints it; the record is
 * still useful on its own as an index of what exists and where.
 */
@Injectable()
export class DocumentsService
  extends OwnedCrudService<HealthDocument, HealthDocumentRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Document';

  constructor(
    @InjectModel(HealthDocument.name)
    protected readonly model: Model<HealthDocument>,
    private readonly refs: ReferenceValidator,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(documentCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(documentCapabilities.get, (actor, input) =>
        this.get(actor, input),
      ),
      bindCapability(documentCapabilities.create, (actor, input) =>
        this.create(actor, input),
      ),
      bindCapability(documentCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(documentCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListDocumentsInput,
  ): Promise<ListResult<HealthDocumentRecord>> {
    const filter: QueryFilter<HealthDocument> = {};
    if (input.kind) {
      filter.kind = input.kind;
    }
    if (input.doctorId) {
      filter.doctorId = this.objectId(input.doctorId, 'doctorId');
    }
    if (input.conditionId) {
      filter.conditionId = this.objectId(input.conditionId, 'conditionId');
    }
    if (input.search) {
      filter.title = new RegExp(escapeRegExp(input.search), 'i');
    }

    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        // Undated documents sort last rather than disappearing.
        sort: { documentDate: -1, createdAt: -1 },
        filter,
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  get(actor: Actor, { id }: ById): Promise<HealthDocumentRecord> {
    return this.getOwned(actor, id);
  }

  async create(
    actor: Actor,
    input: CreateDocumentInput,
  ): Promise<HealthDocumentRecord> {
    return this.createOwned(actor, {
      ...input,
      doctorId: await this.refs.doctor(actor, input.doctorId),
      conditionId: await this.refs.condition(actor, input.conditionId),
      appointmentId: await this.refs.appointment(actor, input.appointmentId),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateDocumentInput,
  ): Promise<HealthDocumentRecord> {
    return this.updateOwned(actor, id, {
      ...patch,
      doctorId: await this.refs.doctor(actor, patch.doctorId),
      conditionId: await this.refs.condition(actor, patch.conditionId),
      appointmentId: await this.refs.appointment(actor, patch.appointmentId),
    });
  }

  remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    return this.deleteOwned(actor, id);
  }
}
