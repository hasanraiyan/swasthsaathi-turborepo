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

export const DOSE_STATUS = ['pending', 'taken', 'skipped', 'missed'] as const;
export type DoseStatus = (typeof DOSE_STATUS)[number];

/**
 * One dose that was due at a particular moment, and what happened to it.
 *
 * Rows are materialised from the schedule when a day is first looked at, so
 * a dose the user never opened the app for can still turn into `missed`
 * rather than silently disappearing. That is the whole point of adherence:
 * the absence of an action is itself the signal.
 */
export const medicationDoseSchema = z.object({
  ...recordMetaShape,
  scheduleId: idSchema,
  medicineId: idSchema,
  scheduledFor: timestampSchema,
  status: z.enum(DOSE_STATUS),
  actionedAt: timestampSchema.nullable(),
  doseAmount: z.number().positive(),
  doseUnit: z.string().max(30),
  notes: notesSchema.nullable(),
});
export type MedicationDose = z.infer<typeof medicationDoseSchema>;

/** A dose row joined with the medicine it belongs to -- what a day view needs. */
export const medicationDoseWithMedicineSchema = medicationDoseSchema.extend({
  medicineName: z.string(),
  medicineStrength: z.string().nullable(),
});
export type MedicationDoseWithMedicine = z.infer<typeof medicationDoseWithMedicineSchema>;

export const dayScheduleSchema = z.object({
  date: dateOnlySchema,
  doses: z.array(medicationDoseWithMedicineSchema),
  takenCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
});
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

export const getDayScheduleSchema = z.object({
  date: dateOnlySchema.optional().describe('Day to look at as YYYY-MM-DD; defaults to today'),
});
export type GetDayScheduleInput = z.infer<typeof getDayScheduleSchema>;

export const recordDoseSchema = z.object({
  doseId: idSchema.describe('Id of the scheduled dose, from medicationDoses.day'),
  status: z.enum(['taken', 'skipped']).describe('Whether the dose was taken or deliberately skipped'),
  actionedAt: timestampSchema
    .optional()
    .describe('When it was actually taken; defaults to the current time'),
  notes: notesSchema.nullish(),
});
export type RecordDoseInput = z.infer<typeof recordDoseSchema>;

export const adherenceSummarySchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
  taken: z.number().int().min(0),
  skipped: z.number().int().min(0),
  missed: z.number().int().min(0),
  pending: z.number().int().min(0),
  /** Taken as a share of doses that are no longer pending. Null when there were none. */
  adherenceRate: z.number().min(0).max(1).nullable(),
  perMedicine: z.array(
    z.object({
      medicineId: idSchema,
      medicineName: z.string(),
      taken: z.number().int().min(0),
      missed: z.number().int().min(0),
      skipped: z.number().int().min(0),
      adherenceRate: z.number().min(0).max(1).nullable(),
    }),
  ),
});
export type AdherenceSummary = z.infer<typeof adherenceSummarySchema>;

export const getAdherenceSchema = z.object({
  from: dateOnlySchema.optional().describe('Start of the window; defaults to 30 days ago'),
  to: dateOnlySchema.optional().describe('End of the window, inclusive; defaults to today'),
  medicineId: idSchema.optional(),
});
export type GetAdherenceInput = z.infer<typeof getAdherenceSchema>;

export const listDosesSchema = paginationSchema.extend({
  medicineId: idSchema.optional(),
  status: z.enum(DOSE_STATUS).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type ListDosesInput = z.infer<typeof listDosesSchema>;

export const medicationDoseCapabilities = {
  day: capability({
    name: 'medicationDoses.day',
    description:
      "Get the user's medicine doses for a given day, each with its status, plus how many have been taken so far.",
    kind: 'read',
    input: getDayScheduleSchema,
  }),
  record: capability({
    name: 'medicationDoses.record',
    description: 'Mark a scheduled dose as taken or skipped.',
    kind: 'write',
    input: recordDoseSchema,
  }),
  adherence: capability({
    name: 'medicationDoses.adherence',
    description:
      'Summarise how consistently the user has taken their medicines over a date range, overall and per medicine.',
    kind: 'read',
    input: getAdherenceSchema,
  }),
  list: capability({
    name: 'medicationDoses.list',
    description: 'List individual dose records, filtered by medicine, status or date range.',
    kind: 'read',
    input: listDosesSchema,
  }),
} as const;
