import { z } from 'zod';

import {
  capability,
  dateOnlySchema,
  idSchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
  timestampSchema,
} from './common';

/**
 * Preventive care: the part of Swasthya Saathi that works before anything is
 * wrong.
 *
 * The design principle here is that a plan is **derived, never stored**. What
 * gets written down is only what the user actually did -- a completed check.
 * Everything else (which checks apply, when each is next due, how urgent it
 * is) is computed from the health baseline, the conditions on record and
 * those completions. That way a plan can never go stale: change your weight
 * or record a new condition and the next read reflects it, with no rows to
 * migrate and nothing to clean up.
 */

export const PREVENTIVE_CHECK = [
  'blood_pressure',
  'blood_glucose',
  'haemoglobin',
  'weight_check',
  'lipid_profile',
  'dental_check',
  'eye_check',
  'diabetic_eye_exam',
  'oral_cancer_screening',
  'cervical_cancer_screening',
  'tobacco_cessation',
  'general_checkup',
] as const;
export type PreventiveCheckKey = (typeof PREVENTIVE_CHECK)[number];

/** How a check stands right now, relative to when it was last done. */
export const CHECK_STATUS = ['overdue', 'due', 'due_soon', 'up_to_date'] as const;
export type CheckStatus = (typeof CHECK_STATUS)[number];

export const BMI_BAND = ['underweight', 'healthy', 'overweight', 'obese'] as const;
export type BmiBand = (typeof BMI_BAND)[number];

/**
 * Something about this person that changes what they should be screened for.
 *
 * Shown to the user, not just used internally -- naming the reason is what
 * turns a schedule into awareness.
 */
export const riskFlagSchema = z.object({
  key: z.string(),
  label: z.string(),
  detail: z.string(),
});
export type RiskFlag = z.infer<typeof riskFlagSchema>;

/** The derived read of who this person is, health-wise. */
export const healthSnapshotSchema = z.object({
  age: z.number().int().nullable(),
  bmi: z.number().nullable(),
  bmiBand: z.enum(BMI_BAND).nullable(),
  baselineComplete: z.boolean(),
  /** Field names still needed before the plan can be personalised. */
  missingBaselineFields: z.array(z.string()),
  riskFlags: z.array(riskFlagSchema),
});
export type HealthSnapshot = z.infer<typeof healthSnapshotSchema>;

export const preventiveCheckSchema = z.object({
  key: z.enum(PREVENTIVE_CHECK),
  title: z.string(),
  /** Plain-language reason this check exists at all. The awareness surface. */
  why: z.string(),
  /** Why it applies to *this* person, e.g. "You are 45 or older". */
  appliesBecause: z.string(),
  everyMonths: z.number().int().positive(),
  status: z.enum(CHECK_STATUS),
  dueOn: dateOnlySchema,
  lastCompletedOn: dateOnlySchema.nullable(),
});
export type PreventiveCheck = z.infer<typeof preventiveCheckSchema>;

export const preventivePlanSchema = z.object({
  generatedOn: dateOnlySchema,
  snapshot: healthSnapshotSchema,
  checks: z.array(preventiveCheckSchema),
  overdueCount: z.number().int().min(0),
  dueCount: z.number().int().min(0),
});
export type PreventivePlan = z.infer<typeof preventivePlanSchema>;

/** The only thing actually written down: a check the user completed. */
export const preventiveCheckLogSchema = z.object({
  ...recordMetaShape,
  checkKey: z.enum(PREVENTIVE_CHECK),
  completedOn: dateOnlySchema,
  note: notesSchema.nullable(),
  /** Set when the check was satisfied by a reading the user recorded. */
  measurementId: idSchema.nullable(),
  recordedAt: timestampSchema,
});
export type PreventiveCheckLog = z.infer<typeof preventiveCheckLogSchema>;

export const completeCheckSchema = z.object({
  checkKey: z.enum(PREVENTIVE_CHECK).describe('Which check was done'),
  completedOn: dateOnlySchema.optional().describe('Day it was done; defaults to today'),
  note: notesSchema.nullish().describe('What the result was, in the user\'s own words'),
  measurementId: idSchema.nullish().describe('Reading that satisfied this check, if any'),
});
export type CompleteCheckInput = z.infer<typeof completeCheckSchema>;

export const listCheckHistorySchema = paginationSchema.extend({
  checkKey: z.enum(PREVENTIVE_CHECK).optional(),
});
export type ListCheckHistoryInput = z.infer<typeof listCheckHistorySchema>;

export const preventionCapabilities = {
  snapshot: capability({
    name: 'prevention.snapshot',
    description:
      "Read the derived health snapshot: age, BMI and band, whether the health baseline is complete, and the risk factors that change what this person should be screened for.",
    kind: 'read',
    input: z.object({}),
  }),
  plan: capability({
    name: 'prevention.plan',
    description:
      "Get the user's personalised preventive care plan -- which screenings and checks apply to them, when each is next due, and which are overdue. Derived from their baseline, conditions and past completions.",
    kind: 'read',
    input: z.object({}),
  }),
  complete: capability({
    name: 'prevention.complete',
    description:
      'Record that a preventive check has been done. This is what pushes its next due date forward.',
    kind: 'write',
    input: completeCheckSchema,
  }),
  history: capability({
    name: 'prevention.history',
    description: 'List preventive checks the user has completed, newest first.',
    kind: 'read',
    input: listCheckHistorySchema,
  }),
} as const;
