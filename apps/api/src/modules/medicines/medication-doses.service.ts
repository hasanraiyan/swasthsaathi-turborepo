import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { medicationDoseCapabilities } from '@repo/contracts';
import type {
  Actor,
  AdherenceSummary,
  DaySchedule,
  GetAdherenceInput,
  GetDayScheduleInput,
  ListDosesInput,
  ListResult,
  MedicationDose as MedicationDoseRecord,
  MedicationDoseWithMedicine,
  RecordDoseInput,
} from '@repo/contracts';
import { Types } from 'mongoose';
import type { AnyBulkWriteOperation, Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import {
  addDays,
  atTimeOfDay,
  dayOfWeek,
  endOfDayExclusive,
  startOfDay,
  today,
} from '../../common/dates';
import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../common/errors';
import {
  OwnedCrudService,
  stripUndefined,
} from '../../database/owned-crud.service';
import { MedicationDose } from '../../database/schemas/medication-dose.schema';
import { MedicationSchedule } from '../../database/schemas/medication-schedule.schema';
import { Medicine } from '../../database/schemas/medicine.schema';
import { serialize, serializeAll } from '../../database/serialize';

/**
 * How long after a dose was due before it counts as missed.
 *
 * Without a grace window, opening the app five minutes after 08:00 would show
 * the morning tablet as already missed -- technically true, and useless. Four
 * hours is long enough to cover a late breakfast and short enough that the
 * evening dose isn't still "pending" at bedtime.
 */
const MISSED_GRACE_MS = 4 * 60 * 60 * 1000;

/** Guards against a client asking to materialise a decade of doses. */
const MAX_RANGE_DAYS = 366;

/** MongoDB's own bulkWrite limit is higher, but batching keeps memory flat. */
const BULK_CHUNK = 500;

/**
 * Medication doses: the *did it happen* of a medicine.
 *
 * Doses are materialised from schedules the first time a day is looked at,
 * rather than generated on the fly for display. That is the whole design: a
 * dose the user never came back for still exists as a row and becomes
 * `missed`, so the absence of an action is recorded rather than inferred.
 * The `{ scheduleId, scheduledFor }` unique index makes re-opening a day
 * idempotent.
 */
@Injectable()
export class MedicationDosesService
  extends OwnedCrudService<MedicationDose, MedicationDoseRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Dose';

  constructor(
    @InjectModel(MedicationDose.name)
    protected readonly model: Model<MedicationDose>,
    @InjectModel(MedicationSchedule.name)
    private readonly schedules: Model<MedicationSchedule>,
    @InjectModel(Medicine.name) private readonly medicines: Model<Medicine>,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(medicationDoseCapabilities.day, (actor, input) =>
        this.day(actor, input),
      ),
      bindCapability(medicationDoseCapabilities.record, (actor, input) =>
        this.record(actor, input),
      ),
      bindCapability(medicationDoseCapabilities.adherence, (actor, input) =>
        this.adherence(actor, input),
      ),
      bindCapability(medicationDoseCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
    ];
  }

  /** Everything the user is meant to take on one day, with what's happened so far. */
  async day(actor: Actor, input: GetDayScheduleInput): Promise<DaySchedule> {
    const date = input.date ?? today();
    await this.materialise(actor, date, date);

    const doses = await this.loadWithMedicine(actor, {
      scheduledFor: { $gte: startOfDay(date), $lt: endOfDayExclusive(date) },
    });

    return {
      date,
      doses,
      takenCount: doses.filter((dose) => dose.status === 'taken').length,
      totalCount: doses.length,
    };
  }

  async record(
    actor: Actor,
    input: RecordDoseInput,
  ): Promise<MedicationDoseRecord> {
    const $set = stripUndefined({
      status: input.status,
      actionedAt: input.actionedAt ? new Date(input.actionedAt) : new Date(),
      notes: input.notes,
    });

    const doc = await this.model
      .findOneAndUpdate(
        this.scope(actor, { _id: this.objectId(input.doseId, 'doseId') }),
        { $set },
        { returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec();

    if (!doc) {
      throw new NotFoundError('Dose not found');
    }
    return serialize<MedicationDoseRecord>(doc);
  }

  async adherence(
    actor: Actor,
    input: GetAdherenceInput,
  ): Promise<AdherenceSummary> {
    const to = input.to ?? today();
    const from = input.from ?? addDays(to, -29);
    if (from > to) {
      throw new ConflictError('"from" must not be after "to"');
    }
    assertRangeSize(from, to);

    await this.materialise(actor, from, to);

    const match: Record<string, unknown> = {
      userId: actor.userId,
      scheduledFor: { $gte: startOfDay(from), $lt: endOfDayExclusive(to) },
    };
    if (input.medicineId) {
      match.medicineId = this.objectId(input.medicineId, 'medicineId');
    }

    const rows = await this.model
      .aggregate<{
        _id: { medicineId: Types.ObjectId; status: string };
        count: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: { medicineId: '$medicineId', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const totals = { taken: 0, skipped: 0, missed: 0, pending: 0 };
    const perMedicineCounts = new Map<string, typeof totals>();

    for (const row of rows) {
      const status = row._id.status as keyof typeof totals;
      if (!(status in totals)) {
        continue;
      }
      totals[status] += row.count;

      const key = row._id.medicineId.toHexString();
      const bucket = perMedicineCounts.get(key) ?? {
        taken: 0,
        skipped: 0,
        missed: 0,
        pending: 0,
      };
      bucket[status] += row.count;
      perMedicineCounts.set(key, bucket);
    }

    const names = await this.medicineNames(actor, [
      ...perMedicineCounts.keys(),
    ]);

    return {
      from,
      to,
      ...totals,
      adherenceRate: rate(totals),
      perMedicine: [...perMedicineCounts.entries()]
        .map(([medicineId, counts]) => ({
          medicineId,
          medicineName: names.get(medicineId) ?? 'Unknown medicine',
          taken: counts.taken,
          missed: counts.missed,
          skipped: counts.skipped,
          adherenceRate: rate(counts),
        }))
        .sort((a, b) => a.medicineName.localeCompare(b.medicineName)),
    };
  }

  /** The raw dose log. Does not materialise -- it reports what exists. */
  async list(
    actor: Actor,
    input: ListDosesInput,
  ): Promise<ListResult<MedicationDoseRecord>> {
    const filter: QueryFilter<MedicationDose> = {};
    if (input.medicineId) {
      filter.medicineId = this.objectId(input.medicineId, 'medicineId');
    }
    if (input.status) {
      filter.status = input.status;
    }
    if (input.from || input.to) {
      filter.scheduledFor = {
        ...(input.from ? { $gte: startOfDay(input.from) } : {}),
        ...(input.to ? { $lt: endOfDayExclusive(input.to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        sort: { scheduledFor: -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  /**
   * Create the dose rows implied by the user's active schedules across a date
   * range, then age any that are now overdue.
   *
   * `$setOnInsert` never touches an existing row, so a dose the user already
   * marked taken survives a schedule change untouched.
   */
  private async materialise(
    actor: Actor,
    from: string,
    to: string,
  ): Promise<void> {
    assertRangeSize(from, to);

    const schedules = await this.schedules
      .find({
        userId: actor.userId,
        active: true,
        startsOn: { $lte: to },
        $or: [{ endsOn: null }, { endsOn: { $gte: from } }],
      })
      .lean()
      .exec();

    const operations: AnyBulkWriteOperation<MedicationDose>[] = [];

    for (let date = from; date <= to; date = addDays(date, 1)) {
      const weekday = dayOfWeek(date);
      for (const schedule of schedules) {
        if (date < schedule.startsOn) {
          continue;
        }
        if (schedule.endsOn && date > schedule.endsOn) {
          continue;
        }
        if (
          schedule.daysOfWeek.length > 0 &&
          !schedule.daysOfWeek.includes(weekday)
        ) {
          continue;
        }
        for (const time of schedule.timesOfDay) {
          operations.push({
            updateOne: {
              // scheduleId, scheduledFor and userId come from these equality
              // conditions on insert, so they are not repeated in $setOnInsert
              // where they would conflict.
              filter: {
                userId: actor.userId,
                scheduleId: schedule._id,
                scheduledFor: atTimeOfDay(date, time),
              },
              update: {
                $setOnInsert: {
                  medicineId: schedule.medicineId,
                  status: 'pending',
                  actionedAt: null,
                  doseAmount: schedule.doseAmount,
                  doseUnit: schedule.doseUnit,
                  notes: null,
                },
              },
              upsert: true,
            },
          });
        }
      }
    }

    for (let i = 0; i < operations.length; i += BULK_CHUNK) {
      await this.model.bulkWrite(operations.slice(i, i + BULK_CHUNK), {
        ordered: false,
      });
    }

    await this.markMissed(actor, from, to);
  }

  private async markMissed(
    actor: Actor,
    from: string,
    to: string,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - MISSED_GRACE_MS);
    const rangeStart = startOfDay(from);
    const rangeEnd = endOfDayExclusive(to);
    const upper = cutoff < rangeEnd ? cutoff : rangeEnd;

    if (upper <= rangeStart) {
      return;
    }

    await this.model
      .updateMany(
        this.scope(actor, {
          status: 'pending',
          scheduledFor: { $gte: rangeStart, $lt: upper },
        }),
        { $set: { status: 'missed' } },
      )
      .exec();
  }

  private async loadWithMedicine(
    actor: Actor,
    filter: QueryFilter<MedicationDose>,
  ): Promise<MedicationDoseWithMedicine[]> {
    const docs = await this.model
      .find(this.scope(actor, filter))
      .sort({ scheduledFor: 1 })
      .lean()
      .exec();
    const doses = serializeAll<MedicationDoseRecord>(docs);

    // Scoped by hand rather than through `this.scope`, which is typed for the
    // dose collection, not this one.
    const medicines = await this.medicines
      .find({
        userId: actor.userId,
        _id: {
          $in: [...new Set(doses.map((dose) => dose.medicineId))].map(
            toObjectId,
          ),
        },
      })
      .lean()
      .exec();

    const byId = new Map(
      medicines.map((medicine) => [String(medicine._id), medicine]),
    );

    return doses.map((dose) => {
      const medicine = byId.get(dose.medicineId);
      return {
        ...dose,
        // A dose can outlive its medicine only if a delete raced this read;
        // showing the row without a name beats dropping it from the day.
        medicineName: medicine?.name ?? 'Unknown medicine',
        medicineStrength: medicine?.strength ?? null,
      };
    });
  }

  private async medicineNames(
    actor: Actor,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }
    const medicines = await this.medicines
      .find({ userId: actor.userId, _id: { $in: ids.map(toObjectId) } })
      .lean()
      .exec();
    return new Map(
      medicines.map((medicine) => [String(medicine._id), medicine.name]),
    );
  }
}

/** Taken as a share of doses that are no longer pending. */
function rate(counts: {
  taken: number;
  skipped: number;
  missed: number;
}): number | null {
  const settled = counts.taken + counts.skipped + counts.missed;
  return settled === 0 ? null : counts.taken / settled;
}

function assertRangeSize(from: string, to: string): void {
  const days = Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
  if (days > MAX_RANGE_DAYS) {
    throw new InvalidInputError(
      `Date range must be ${MAX_RANGE_DAYS} days or fewer`,
      [{ path: 'from', message: `Range spans ${days} days` }],
    );
  }
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
