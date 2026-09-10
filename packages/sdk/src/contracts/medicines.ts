import { z } from 'zod';

import {
  byIdSchema,
  capability,
  dateOnlySchema,
  idSchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
} from './common';
import { medicationScheduleSchema } from './medication-schedules';

export const MEDICINE_FORM = [
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'drops',
  'inhaler',
  'topical',
  'powder',
  'other',
] as const;

export const MEDICINE_STATUS = ['active', 'paused', 'stopped'] as const;

export type MedicineForm = (typeof MEDICINE_FORM)[number];
export type MedicineStatus = (typeof MEDICINE_STATUS)[number];

/**
 * A medicine the user has been prescribed or takes on their own.
 *
 * This is the *what*: the drug, its strength, why it is being taken and
 * whether it is still current. The *when* lives in medication schedules, and
 * the *did it happen* lives in dose logs. Keeping the three apart is what
 * lets a medicine be paused without losing its history.
 */
export const medicineSchema = z.object({
  ...recordMetaShape,
  name: z.string().min(1).max(200),
  form: z.enum(MEDICINE_FORM),
  strength: z.string().max(60).nullable(),
  purpose: z.string().max(300).nullable(),
  conditionId: idSchema.nullable(),
  prescribedByDoctorId: idSchema.nullable(),
  status: z.enum(MEDICINE_STATUS),
  startedOn: dateOnlySchema.nullable(),
  endedOn: dateOnlySchema.nullable(),
  stoppedReason: z.string().max(300).nullable(),
  notes: notesSchema.nullable(),
});
export type Medicine = z.infer<typeof medicineSchema>;

/** A medicine together with the schedules that say when to take it. */
export const medicineWithSchedulesSchema = medicineSchema.extend({
  schedules: z.array(medicationScheduleSchema),
});
export type MedicineWithSchedules = z.infer<typeof medicineWithSchedulesSchema>;

export const createMedicineSchema = z.object({
  name: z.string().min(1).max(200).describe('Medicine name as written on the strip or prescription'),
  form: z.enum(MEDICINE_FORM).default('tablet'),
  strength: z
    .string()
    .max(60)
    .nullish()
    .describe('Strength per unit as printed, e.g. "500 mg" or "5 ml"'),
  purpose: z
    .string()
    .max(300)
    .nullish()
    .describe('Why the user takes it, in their own words, e.g. "for blood pressure"'),
  conditionId: idSchema.nullish().describe('Id of the condition this medicine treats, if known'),
  prescribedByDoctorId: idSchema.nullish(),
  status: z.enum(MEDICINE_STATUS).default('active'),
  startedOn: dateOnlySchema.nullish(),
  endedOn: dateOnlySchema.nullish(),
  notes: notesSchema.nullish(),
});
export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;

export const updateMedicineSchema = createMedicineSchema.partial().extend(byIdSchema.shape);
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;

export const listMedicinesSchema = paginationSchema.extend({
  status: z.enum(MEDICINE_STATUS).optional(),
  conditionId: idSchema.optional().describe('Only medicines linked to this condition'),
  search: z.string().max(200).optional().describe('Match against name or purpose'),
});
export type ListMedicinesInput = z.infer<typeof listMedicinesSchema>;

export const stopMedicineSchema = byIdSchema.extend({
  endedOn: dateOnlySchema.optional().describe('Last day it was taken; defaults to today'),
  reason: z.string().max(300).optional(),
});
export type StopMedicineInput = z.infer<typeof stopMedicineSchema>;

export const medicineCapabilities = {
  list: capability({
    name: 'medicines.list',
    description:
      'List the medicines on record for the user. Filter by status (active, paused, stopped), by the condition they treat, or by a search term.',
    kind: 'read',
    input: listMedicinesSchema,
  }),
  get: capability({
    name: 'medicines.get',
    description: 'Read one medicine by id, including its schedules.',
    kind: 'read',
    input: byIdSchema,
  }),
  create: capability({
    name: 'medicines.create',
    description:
      'Add a medicine to the user\'s record. Does not set up reminders -- add a medication schedule for that.',
    kind: 'write',
    input: createMedicineSchema,
  }),
  update: capability({
    name: 'medicines.update',
    description: 'Change details of a medicine, such as its strength or the condition it treats.',
    kind: 'write',
    input: updateMedicineSchema,
  }),
  stop: capability({
    name: 'medicines.stop',
    description:
      'Mark a medicine as stopped from a given date. Its schedules are deactivated but the dose history is kept.',
    kind: 'write',
    input: stopMedicineSchema,
  }),
  remove: capability({
    name: 'medicines.delete',
    description:
      'Permanently remove a medicine and all of its schedules and dose history. Prefer medicines.stop to keep the history.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
