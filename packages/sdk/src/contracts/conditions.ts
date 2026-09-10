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

export const CONDITION_STATUS = ['active', 'monitoring', 'resolved'] as const;
export const CONDITION_SEVERITY = ['mild', 'moderate', 'severe'] as const;

export type ConditionStatus = (typeof CONDITION_STATUS)[number];
export type ConditionSeverity = (typeof CONDITION_SEVERITY)[number];

/**
 * A health condition the user is living with or being treated for.
 *
 * Conditions are the spine of the health journey: medicines, symptoms and
 * appointments all optionally hang off one, which is what lets the app (and
 * later the agent) answer "what am I taking this for?".
 */
export const conditionSchema = z.object({
  ...recordMetaShape,
  name: z.string().min(1).max(200),
  status: z.enum(CONDITION_STATUS),
  severity: z.enum(CONDITION_SEVERITY).nullable(),
  diagnosedOn: dateOnlySchema.nullable(),
  resolvedOn: dateOnlySchema.nullable(),
  diagnosedByDoctorId: idSchema.nullable(),
  notes: notesSchema.nullable(),
});
export type Condition = z.infer<typeof conditionSchema>;

export const createConditionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .describe('Name of the condition, e.g. "Type 2 Diabetes" or "Hypertension"'),
  status: z.enum(CONDITION_STATUS).default('active'),
  severity: z.enum(CONDITION_SEVERITY).nullish(),
  diagnosedOn: dateOnlySchema.nullish().describe('When it was diagnosed, as YYYY-MM-DD'),
  resolvedOn: dateOnlySchema.nullish(),
  diagnosedByDoctorId: idSchema.nullish().describe('Id of the doctor who diagnosed it, if known'),
  notes: notesSchema.nullish(),
});
export type CreateConditionInput = z.infer<typeof createConditionSchema>;

export const updateConditionSchema = createConditionSchema.partial().extend(byIdSchema.shape);
export type UpdateConditionInput = z.infer<typeof updateConditionSchema>;

export const listConditionsSchema = paginationSchema.extend({
  status: z.enum(CONDITION_STATUS).optional().describe('Only return conditions in this state'),
});
export type ListConditionsInput = z.infer<typeof listConditionsSchema>;

export const conditionCapabilities = {
  list: capability({
    name: 'conditions.list',
    description:
      'List the health conditions on record for the user, optionally filtered to active, monitoring or resolved ones.',
    kind: 'read',
    input: listConditionsSchema,
  }),
  get: capability({
    name: 'conditions.get',
    description: 'Read one health condition by its id.',
    kind: 'read',
    input: byIdSchema,
  }),
  create: capability({
    name: 'conditions.create',
    description: 'Record a new health condition for the user.',
    kind: 'write',
    input: createConditionSchema,
  }),
  update: capability({
    name: 'conditions.update',
    description: 'Change details of an existing condition, such as marking it resolved.',
    kind: 'write',
    input: updateConditionSchema,
  }),
  remove: capability({
    name: 'conditions.delete',
    description: 'Remove a condition from the record. Medicines linked to it are kept.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
