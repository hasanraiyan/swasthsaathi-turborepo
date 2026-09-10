import { z } from 'zod';

import {
  byIdSchema,
  capability,
  dateOnlySchema,
  idSchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
  timestampSchema,
} from './common';

/**
 * Something the user felt, logged when they felt it.
 *
 * An entry is an episode rather than a diagnosis: it has a start, an
 * optional end, and a severity the user chose. Its value is in the pattern
 * over time, which is what makes it worth showing a doctor.
 */
export const symptomEntrySchema = z.object({
  ...recordMetaShape,
  name: z.string().min(1).max(200),
  severity: z.number().int().min(1).max(10),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  conditionId: idSchema.nullable(),
  triggers: z.array(z.string().min(1).max(120)),
  notes: notesSchema.nullable(),
});
export type SymptomEntry = z.infer<typeof symptomEntrySchema>;

export const createSymptomEntrySchema = z.object({
  name: z.string().min(1).max(200).describe('What the user felt, e.g. "headache", "dizziness"'),
  severity: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe('How bad it was, 1 = barely noticeable, 10 = worst imaginable'),
  startedAt: timestampSchema.optional().describe('When it started; defaults to now'),
  endedAt: timestampSchema.nullish().describe('When it stopped; omit if ongoing'),
  conditionId: idSchema.nullish().describe('Condition this symptom relates to, if known'),
  triggers: z
    .array(z.string().min(1).max(120))
    .max(20)
    .default([])
    .describe('What the user thinks brought it on, e.g. ["skipped lunch"]'),
  notes: notesSchema.nullish(),
});
export type CreateSymptomEntryInput = z.infer<typeof createSymptomEntrySchema>;

export const updateSymptomEntrySchema = createSymptomEntrySchema.partial().extend(byIdSchema.shape);
export type UpdateSymptomEntryInput = z.infer<typeof updateSymptomEntrySchema>;

export const listSymptomEntriesSchema = paginationSchema.extend({
  name: z.string().max(200).optional().describe('Only entries for this symptom name'),
  conditionId: idSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  ongoingOnly: z.coerce.boolean().optional().describe('Only episodes that have not ended'),
});
export type ListSymptomEntriesInput = z.infer<typeof listSymptomEntriesSchema>;

export const symptomCapabilities = {
  list: capability({
    name: 'symptoms.list',
    description:
      'List logged symptom episodes, newest first. Filter by symptom name, condition, date range, or to ongoing episodes only.',
    kind: 'read',
    input: listSymptomEntriesSchema,
  }),
  get: capability({
    name: 'symptoms.get',
    description: 'Read one symptom entry by id.',
    kind: 'read',
    input: byIdSchema,
  }),
  log: capability({
    name: 'symptoms.log',
    description: 'Log a symptom the user is feeling or felt.',
    kind: 'write',
    input: createSymptomEntrySchema,
  }),
  update: capability({
    name: 'symptoms.update',
    description: 'Update a symptom entry, for example to mark when it stopped.',
    kind: 'write',
    input: updateSymptomEntrySchema,
  }),
  remove: capability({
    name: 'symptoms.delete',
    description: 'Delete a symptom entry.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
