import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  REQUIRED_BASELINE_FIELDS,
  preventionCapabilities,
} from '@repo/contracts';
import type {
  Actor,
  BmiBand,
  CheckStatus,
  CompleteCheckInput,
  HealthSnapshot,
  ListCheckHistoryInput,
  ListResult,
  PreventiveCheck,
  PreventiveCheckLog as PreventiveCheckLogRecord,
  PreventivePlan,
  Profile as ProfileRecord,
  RiskFlag,
} from '@repo/contracts';
import type { Model, QueryFilter } from 'mongoose';

import { bindCapability } from '../../capabilities/capability.types';
import type {
  CapabilityBinding,
  CapabilityProvider,
} from '../../capabilities/capability.types';
import { addMonths, daysBetween, today, yearsSince } from '../../common/dates';
import { OwnedCrudService } from '../../database/owned-crud.service';
import { Condition } from '../../database/schemas/condition.schema';
import { PreventiveCheckLog } from '../../database/schemas/preventive-check-log.schema';
import { ProfileService } from '../profile/profile.service';
import { CHECK_RULES, type PreventionContext } from './catalogue';

/** How far ahead a check starts warning that it is coming. */
const DUE_SOON_DAYS = 60;

/** Urgent first: an overdue screening is the whole point of the plan. */
const STATUS_ORDER: Record<CheckStatus, number> = {
  overdue: 0,
  due: 1,
  due_soon: 2,
  up_to_date: 3,
};

/**
 * Preventive care.
 *
 * The plan is derived on every read and never stored -- see the note in
 * `@repo/contracts/prevention`. Only completions are written down, which
 * means a plan cannot go stale: record a new condition or change a habit and
 * the next read already reflects it, with nothing to migrate.
 */
@Injectable()
export class PreventionService
  extends OwnedCrudService<PreventiveCheckLog, PreventiveCheckLogRecord>
  implements CapabilityProvider
{
  protected readonly entityName = 'Preventive check';

  constructor(
    @InjectModel(PreventiveCheckLog.name)
    protected readonly model: Model<PreventiveCheckLog>,
    @InjectModel(Condition.name) private readonly conditions: Model<Condition>,
    private readonly profiles: ProfileService,
  ) {
    super();
  }

  capabilities(): CapabilityBinding[] {
    return [
      bindCapability(preventionCapabilities.snapshot, (actor) =>
        this.snapshot(actor),
      ),
      bindCapability(preventionCapabilities.plan, (actor) => this.plan(actor)),
      bindCapability(preventionCapabilities.complete, (actor, input) =>
        this.complete(actor, input),
      ),
      bindCapability(preventionCapabilities.history, (actor, input) =>
        this.history(actor, input),
      ),
    ];
  }

  async snapshot(actor: Actor): Promise<HealthSnapshot> {
    const profile = await this.profiles.get(actor);
    return buildSnapshot(profile);
  }

  /**
   * The personalised plan: which checks apply, when each is next due, and how
   * urgent it is right now.
   */
  async plan(actor: Actor): Promise<PreventivePlan> {
    const profile = await this.profiles.get(actor);
    const snapshot = buildSnapshot(profile);

    // Conditions steer the plan -- diabetes adds an eye exam and tightens the
    // sugar interval, so they are read alongside the baseline.
    const conditionDocs = await this.conditions
      .find({ userId: actor.userId, status: { $ne: 'resolved' } })
      .lean()
      .exec();

    const context: PreventionContext = {
      age: snapshot.age,
      sexAtBirth: profile.sexAtBirth,
      bmi: snapshot.bmi,
      tobaccoUse: profile.tobaccoUse,
      alcoholUse: profile.alcoholUse,
      activityLevel: profile.activityLevel,
      familyHistory: profile.familyHistory,
      conditions: conditionDocs.map((condition) =>
        condition.name.toLowerCase(),
      ),
    };

    const lastCompleted = await this.lastCompletedByCheck(actor);
    const now = today();

    const checks: PreventiveCheck[] = [];
    for (const rule of CHECK_RULES) {
      const appliesBecause = rule.applies(context);
      if (!appliesBecause) {
        continue;
      }

      const everyMonths = rule.everyMonths(context);
      const last = lastCompleted.get(rule.key) ?? null;
      // Never done means due now, not overdue -- nothing has been missed yet.
      const dueOn = last ? addMonths(last, everyMonths) : now;

      checks.push({
        key: rule.key,
        title: rule.title,
        why: rule.why,
        appliesBecause,
        everyMonths,
        status: statusFor(now, dueOn, last),
        dueOn,
        lastCompletedOn: last,
      });
    }

    checks.sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.dueOn.localeCompare(b.dueOn),
    );

    return {
      generatedOn: now,
      snapshot,
      checks,
      overdueCount: checks.filter((check) => check.status === 'overdue').length,
      dueCount: checks.filter((check) => check.status === 'due').length,
    };
  }

  complete(
    actor: Actor,
    input: CompleteCheckInput,
  ): Promise<PreventiveCheckLogRecord> {
    return this.createOwned(actor, {
      checkKey: input.checkKey,
      completedOn: input.completedOn ?? today(),
      note: input.note ?? null,
      measurementId: input.measurementId
        ? this.objectId(input.measurementId, 'measurementId')
        : null,
      recordedAt: new Date(),
    });
  }

  async history(
    actor: Actor,
    input: ListCheckHistoryInput,
  ): Promise<ListResult<PreventiveCheckLogRecord>> {
    const filter: QueryFilter<PreventiveCheckLog> = {};
    if (input.checkKey) {
      filter.checkKey = input.checkKey;
    }
    const [items, total] = await Promise.all([
      this.listOwned(actor, {
        filter,
        sort: { completedOn: -1 },
        limit: input.limit,
        offset: input.offset,
      }),
      this.countOwned(actor, filter),
    ]);
    return { items, total, limit: input.limit, offset: input.offset };
  }

  /** The most recent completion date for each check, in one pass. */
  private async lastCompletedByCheck(
    actor: Actor,
  ): Promise<Map<string, string>> {
    const rows = await this.model
      .aggregate<{ _id: string; completedOn: string }>([
        { $match: { userId: actor.userId } },
        { $sort: { completedOn: -1 } },
        {
          $group: { _id: '$checkKey', completedOn: { $first: '$completedOn' } },
        },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id, row.completedOn]));
  }
}

function statusFor(
  now: string,
  dueOn: string,
  lastCompletedOn: string | null,
): CheckStatus {
  if (!lastCompletedOn) {
    return 'due';
  }
  const days = daysBetween(now, dueOn);
  if (days < 0) {
    return 'overdue';
  }
  return days <= DUE_SOON_DAYS ? 'due_soon' : 'up_to_date';
}

export function buildSnapshot(profile: ProfileRecord): HealthSnapshot {
  const age = profile.dateOfBirth ? yearsSince(profile.dateOfBirth) : null;
  const bmi = computeBmi(profile.heightCm, profile.weightKg);

  const missing = REQUIRED_BASELINE_FIELDS.filter((field) => {
    const value = profile[field];
    return value === null || value === undefined;
  });

  return {
    age,
    bmi,
    bmiBand: bmi === null ? null : bandFor(bmi),
    baselineComplete: missing.length === 0,
    missingBaselineFields: [...missing],
    riskFlags: riskFlagsFor(profile, age, bmi),
  };
}

function computeBmi(
  heightCm: number | null,
  weightKg: number | null,
): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) {
    return null;
  }
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/**
 * Asian-Indian BMI cut-offs, which are lower than the international ones:
 * risk of diabetes and heart disease rises at a lower body mass in South
 * Asian populations, so the standard 25/30 bands would under-flag it.
 */
function bandFor(bmi: number): BmiBand {
  if (bmi < 18.5) {
    return 'underweight';
  }
  if (bmi < 23) {
    return 'healthy';
  }
  return bmi < 27.5 ? 'overweight' : 'obese';
}

const FAMILY_HISTORY_LABELS: Record<string, string> = {
  diabetes: 'diabetes',
  hypertension: 'high blood pressure',
  heart_disease: 'heart disease',
  stroke: 'stroke',
  cancer: 'cancer',
  kidney_disease: 'kidney disease',
  thyroid: 'thyroid problems',
  tuberculosis: 'tuberculosis',
  mental_health: 'mental health conditions',
};

/**
 * The things about this person that change what they should watch for.
 * Surfaced to the user, not just used to filter rules -- naming the reason is
 * what turns a schedule into awareness.
 */
function riskFlagsFor(
  profile: ProfileRecord,
  age: number | null,
  bmi: number | null,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (bmi !== null && bmi >= 23) {
    flags.push({
      key: 'bmi',
      label:
        bmi >= 27.5
          ? 'Weight is high for your height'
          : 'Weight is above the healthy range',
      detail: `Your BMI is ${bmi}. For South Asian bodies the healthy range tops out around 23.`,
    });
  }

  if (profile.tobaccoUse === 'daily' || profile.tobaccoUse === 'occasional') {
    flags.push({
      key: 'tobacco',
      label: 'You use tobacco',
      detail:
        'The single biggest thing you could change. It affects the mouth, lungs and heart.',
    });
  }

  if (profile.alcoholUse === 'regular') {
    flags.push({
      key: 'alcohol',
      label: 'You drink regularly',
      detail: 'Regular drinking affects the liver, blood pressure and sleep.',
    });
  }

  if (profile.activityLevel === 'sedentary') {
    flags.push({
      key: 'activity',
      label: 'You are mostly inactive',
      detail:
        'Even a half-hour walk most days lowers blood sugar and blood pressure.',
    });
  }

  if (profile.familyHistory.length > 0) {
    const named = profile.familyHistory
      .map((item) => FAMILY_HISTORY_LABELS[item] ?? item)
      .join(', ');
    flags.push({
      key: 'family',
      label: 'Family history',
      detail: `${named} in your close family. It means screening earlier, not that you will get it.`,
    });
  }

  if (age !== null && age >= 45) {
    flags.push({
      key: 'age',
      label: 'Age 45 or above',
      detail: 'Some checks start or become more frequent from this age.',
    });
  }

  return flags;
}
