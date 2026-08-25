import { z } from 'zod';

import {
  byIdSchema,
  capability,
  dateOnlySchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
  timestampSchema,
} from './common';

export const MEASUREMENT_TYPE = [
  'blood_pressure',
  'blood_glucose',
  'weight',
  'heart_rate',
  'temperature',
  'oxygen_saturation',
  'respiratory_rate',
] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPE)[number];

/**
 * Default unit per measurement type, used when the caller omits one.
 * Metric and °C throughout -- the app's first audience is Indian households.
 */
export const MEASUREMENT_DEFAULT_UNIT: Record<MeasurementType, string> = {
  blood_pressure: 'mmHg',
  blood_glucose: 'mg/dL',
  weight: 'kg',
  heart_rate: 'bpm',
  temperature: '°C',
  oxygen_saturation: '%',
  respiratory_rate: 'breaths/min',
};

/**
 * A vital sign reading.
 *
 * Blood pressure is the reason for `valueSecondary`: 120/80 is one reading,
 * not two, and splitting it into separate rows would make it impossible to
 * chart or to hand to a doctor as a pair.
 */
export const measurementSchema = z.object({
  ...recordMetaShape,
  type: z.enum(MEASUREMENT_TYPE),
  value: z.number(),
  valueSecondary: z.number().nullable(),
  unit: z.string().max(20),
  measuredAt: timestampSchema,
  notes: notesSchema.nullable(),
});
export type Measurement = z.infer<typeof measurementSchema>;

export const createMeasurementSchema = z.object({
  type: z.enum(MEASUREMENT_TYPE),
  value: z
    .number()
    .describe('The reading. For blood pressure this is the systolic (upper) number.'),
  valueSecondary: z
    .number()
    .nullish()
    .describe('Only for blood pressure: the diastolic (lower) number.'),
  unit: z.string().max(20).optional().describe('Defaults to the standard unit for the type'),
  measuredAt: timestampSchema.optional().describe('When it was taken; defaults to now'),
  notes: notesSchema.nullish(),
});
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;

export const updateMeasurementSchema = createMeasurementSchema.partial().extend(byIdSchema.shape);
export type UpdateMeasurementInput = z.infer<typeof updateMeasurementSchema>;

export const listMeasurementsSchema = paginationSchema.extend({
  type: z.enum(MEASUREMENT_TYPE).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type ListMeasurementsInput = z.infer<typeof listMeasurementsSchema>;

export const measurementTrendSchema = z.object({
  type: z.enum(MEASUREMENT_TYPE),
  unit: z.string(),
  count: z.number().int().min(0),
  latest: measurementSchema.nullable(),
  average: z.number().nullable(),
  averageSecondary: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
});
export type MeasurementTrend = z.infer<typeof measurementTrendSchema>;

export const getMeasurementTrendSchema = z.object({
  type: z.enum(MEASUREMENT_TYPE),
  from: dateOnlySchema.optional().describe('Defaults to 30 days ago'),
  to: dateOnlySchema.optional().describe('Defaults to today'),
});
export type GetMeasurementTrendInput = z.infer<typeof getMeasurementTrendSchema>;

export const measurementCapabilities = {
  list: capability({
    name: 'measurements.list',
    description:
      'List vital sign readings, newest first. Filter by type (blood pressure, blood glucose, weight and so on) or date range.',
    kind: 'read',
    input: listMeasurementsSchema,
  }),
  record: capability({
    name: 'measurements.record',
    description:
      'Record a vital sign reading such as blood pressure, blood sugar, weight or temperature.',
    kind: 'write',
    input: createMeasurementSchema,
  }),
  update: capability({
    name: 'measurements.update',
    description: 'Correct a previously recorded reading.',
    kind: 'write',
    input: updateMeasurementSchema,
  }),
  remove: capability({
    name: 'measurements.delete',
    description: 'Delete a reading.',
    kind: 'write',
    input: byIdSchema,
  }),
  trend: capability({
    name: 'measurements.trend',
    description:
      'Summarise one kind of reading over a date range: latest value, average, minimum and maximum.',
    kind: 'read',
    input: getMeasurementTrendSchema,
  }),
} as const;
