import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  MEASUREMENT_DEFAULT_UNIT,
  measurementCapabilities,
} from '@repo/contracts';
import type {
  Actor,
  ById,
  CreateMeasurementInput,
  DeleteResult,
  GetMeasurementTrendInput,
  ListMeasurementsInput,
  ListResult,
  Measurement as MeasurementRecord,
  MeasurementTrend,
  UpdateMeasurementInput,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import {
  addDays,
  endOfDayExclusive,
  startOfDay,
  today,
} from '../../common/dates';
import { InvalidInputError } from '../../common/errors';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { Measurement } from '../../database/schemas/measurement.schema';
import { serialize } from '../../database/serialize';

/** Vital sign readings, and the trends that make a series of them useful. */
@Injectable()
export class MeasurementsService
  extends OwnedCrudService<Measurement, MeasurementRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Measurement';

  constructor(
    @InjectModel(Measurement.name) protected readonly model: Model<Measurement>,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(measurementCapabilities.list, (actor, input) =>
        this.list(actor, input),
      ),
      bindCapability(measurementCapabilities.record, (actor, input) =>
        this.record(actor, input),
      ),
      bindCapability(measurementCapabilities.update, (actor, input) =>
        this.update(actor, input),
      ),
      bindCapability(measurementCapabilities.remove, (actor, input) =>
        this.remove(actor, input),
      ),
      bindCapability(measurementCapabilities.trend, (actor, input) =>
        this.trend(actor, input),
      ),
    ];
  }

  async list(
    actor: Actor,
    input: ListMeasurementsInput,
  ): Promise<ListResult<MeasurementRecord>> {
    const filter = this.rangeFilter(input.type, input.from, input.to);
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        sort: { measuredAt: -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  record(
    actor: Actor,
    input: CreateMeasurementInput,
  ): Promise<MeasurementRecord> {
    assertReadingIsComplete(input.type, input.valueSecondary ?? null);
    return this.createOwned(actor, {
      ...input,
      unit: input.unit ?? MEASUREMENT_DEFAULT_UNIT[input.type],
      measuredAt: input.measuredAt ? new Date(input.measuredAt) : new Date(),
    });
  }

  async update(
    actor: Actor,
    { id, ...patch }: UpdateMeasurementInput,
  ): Promise<MeasurementRecord> {
    const current = await this.getOwned(actor, id);
    const type = patch.type ?? current.type;
    const secondary =
      patch.valueSecondary === undefined
        ? current.valueSecondary
        : (patch.valueSecondary ?? null);
    assertReadingIsComplete(type, secondary);

    return this.updateOwned(actor, id, {
      ...patch,
      // Changing the type without a new unit would leave "mmHg" on a weight.
      ...(patch.type && !patch.unit
        ? { unit: MEASUREMENT_DEFAULT_UNIT[patch.type] }
        : {}),
      ...(patch.measuredAt ? { measuredAt: new Date(patch.measuredAt) } : {}),
    });
  }

  remove(actor: Actor, { id }: ById): Promise<DeleteResult> {
    return this.deleteOwned(actor, id);
  }

  async trend(
    actor: Actor,
    input: GetMeasurementTrendInput,
  ): Promise<MeasurementTrend> {
    const to = input.to ?? today();
    const from = input.from ?? addDays(to, -29);
    const filter = this.rangeFilter(input.type, from, to);

    const [rows, latestDoc] = await Promise.all([
      this.model
        .aggregate<{
          count: number;
          average: number | null;
          averageSecondary: number | null;
          min: number | null;
          max: number | null;
        }>([
          { $match: this.scope(actor, filter) },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              average: { $avg: '$value' },
              averageSecondary: { $avg: '$valueSecondary' },
              min: { $min: '$value' },
              max: { $max: '$value' },
            },
          },
        ])
        .exec(),
      this.model
        .findOne(this.scope(actor, filter))
        .sort({ measuredAt: -1 })
        .lean()
        .exec(),
    ]);

    const summary = rows[0];
    return {
      type: input.type,
      unit: MEASUREMENT_DEFAULT_UNIT[input.type],
      count: summary?.count ?? 0,
      latest: latestDoc ? serialize<MeasurementRecord>(latestDoc) : null,
      average: summary?.average ?? null,
      averageSecondary: summary?.averageSecondary ?? null,
      min: summary?.min ?? null,
      max: summary?.max ?? null,
    };
  }

  private rangeFilter(
    type: MeasurementRecord['type'] | undefined,
    from: string | undefined,
    to: string | undefined,
  ): QueryFilter<Measurement> {
    const filter: QueryFilter<Measurement> = {};
    if (type) {
      filter.type = type;
    }
    if (from || to) {
      filter.measuredAt = {
        ...(from ? { $gte: startOfDay(from) } : {}),
        ...(to ? { $lt: endOfDayExclusive(to) } : {}),
      };
    }
    return filter;
  }
}

/**
 * Blood pressure is the one reading that is meaningless as a single number --
 * a systolic of 140 says nothing without its diastolic.
 */
function assertReadingIsComplete(
  type: MeasurementRecord['type'],
  valueSecondary: number | null,
): void {
  if (type === 'blood_pressure' && valueSecondary === null) {
    throw new InvalidInputError('Blood pressure needs both numbers', [
      {
        path: 'valueSecondary',
        message: 'Provide the diastolic (lower) number',
      },
    ]);
  }
}
