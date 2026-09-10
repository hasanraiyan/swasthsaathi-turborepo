import { z } from 'zod';

import {
  byIdSchema,
  capability,
  dateOnlySchema,
  dayOfWeekSchema,
  idSchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
  timeOfDaySchema,
} from './common';

export const DOSE_TIMING = [
  'anytime',
  'before_food',
  'after_food',
  'with_food',
  'empty_stomach',
  'bedtime',
] as const;
export type DoseTiming = (typeof DOSE_TIMING)[number];

/**
 * When and how much of a medicine to take.
 *
 * A medicine can have more than one schedule -- a tapering course, or a
 * different dose morning and night. `timesOfDay` is stored as wall-clock
 * strings rather than instants because "8 in the morning" should stay 8 in
 * the morning when the user travels.
 */
export const medicationScheduleSchema = z.object({
  ...recordMetaShape,
  medicineId: idSchema,
  doseAmount: z.number().positive(),
  doseUnit: z.string().max(30),
  timesOfDay: z.array(timeOfDaySchema).min(1),
  /** Empty means every day. */
  daysOfWeek: z.array(dayOfWeekSchema),
  timing: z.enum(DOSE_TIMING),
  startsOn: dateOnlySchema,
  endsOn: dateOnlySchema.nullable(),
  remindersEnabled: z.boolean(),
  active: z.boolean(),
  notes: notesSchema.nullable(),
});
export type MedicationSchedule = z.infer<typeof medicationScheduleSchema>;

export const createMedicationScheduleSchema = z.object({
  medicineId: idSchema.describe('The medicine this schedule is for'),
  doseAmount: z.number().positive().default(1).describe('How many units per dose, e.g. 1 or 0.5'),
  doseUnit: z.string().max(30).default('tablet').describe('Unit of the dose, e.g. "tablet", "ml"'),
  timesOfDay: z
    .array(timeOfDaySchema)
    .min(1)
    .max(12)
    .describe('24-hour times to take it, e.g. ["08:00", "20:00"]'),
  daysOfWeek: z
    .array(dayOfWeekSchema)
    .max(7)
    .default([])
    .describe('Days it applies to, Sunday = 0. Empty means every day.'),
  timing: z.enum(DOSE_TIMING).default('anytime'),
  startsOn: dateOnlySchema.optional().describe('First day of the course; defaults to today'),
  endsOn: dateOnlySchema.nullish().describe('Last day of the course; omit for ongoing'),
  remindersEnabled: z.boolean().default(true),
  notes: notesSchema.nullish(),
});
export type CreateMedicationScheduleInput = z.infer<typeof createMedicationScheduleSchema>;

export const updateMedicationScheduleSchema = createMedicationScheduleSchema
  .omit({ medicineId: true })
  .partial()
  .extend(byIdSchema.shape)
  .extend({ active: z.boolean().optional() });
export type UpdateMedicationScheduleInput = z.infer<typeof updateMedicationScheduleSchema>;

export const listMedicationSchedulesSchema = paginationSchema.extend({
  medicineId: idSchema.optional(),
  activeOnly: z.coerce.boolean().default(true),
});
export type ListMedicationSchedulesInput = z.infer<typeof listMedicationSchedulesSchema>;

export const medicationScheduleCapabilities = {
  list: capability({
    name: 'medicationSchedules.list',
    description: 'List medication schedules, optionally for one medicine only.',
    kind: 'read',
    input: listMedicationSchedulesSchema,
  }),
  create: capability({
    name: 'medicationSchedules.create',
    description:
      'Set up when and how much of a medicine to take. This is what generates the daily dose list and reminders.',
    kind: 'write',
    input: createMedicationScheduleSchema,
  }),
  update: capability({
    name: 'medicationSchedules.update',
    description: 'Change the timing, dose or end date of a medication schedule.',
    kind: 'write',
    input: updateMedicationScheduleSchema,
  }),
  remove: capability({
    name: 'medicationSchedules.delete',
    description:
      'Delete a medication schedule. Doses already logged against it are kept for the adherence history.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
