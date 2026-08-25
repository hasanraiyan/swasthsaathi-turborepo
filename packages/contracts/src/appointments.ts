import { z } from 'zod';

import {
  byIdSchema,
  capability,
  idSchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
  timestampSchema,
} from './common';

export const APPOINTMENT_STATUS = ['scheduled', 'completed', 'cancelled', 'missed'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

/**
 * A visit to a doctor, lab or clinic.
 *
 * `outcome` is filled in afterwards and is where the doctor's instructions
 * land -- the thing users most often forget between visits, and the reason
 * an appointment is worth modelling separately from a calendar entry.
 */
export const appointmentSchema = z.object({
  ...recordMetaShape,
  title: z.string().min(1).max(200),
  doctorId: idSchema.nullable(),
  conditionId: idSchema.nullable(),
  scheduledFor: timestampSchema,
  durationMinutes: z.number().int().positive().nullable(),
  location: z.string().max(300).nullable(),
  reason: z.string().max(500).nullable(),
  status: z.enum(APPOINTMENT_STATUS),
  outcome: notesSchema.nullable(),
  followUpOfId: idSchema.nullable(),
  notes: notesSchema.nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const createAppointmentSchema = z.object({
  title: z.string().min(1).max(200).describe('Short label, e.g. "Cardiology follow-up"'),
  doctorId: idSchema.nullish(),
  conditionId: idSchema.nullish(),
  scheduledFor: timestampSchema.describe('Date and time of the appointment, with timezone offset'),
  durationMinutes: z.number().int().positive().max(1440).nullish(),
  location: z.string().max(300).nullish(),
  reason: z.string().max(500).nullish().describe('Why the user is going'),
  status: z.enum(APPOINTMENT_STATUS).default('scheduled'),
  followUpOfId: idSchema.nullish().describe('Id of the earlier appointment this follows up on'),
  notes: notesSchema.nullish(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = createAppointmentSchema
  .partial()
  .extend(byIdSchema.shape)
  .extend({ outcome: notesSchema.nullish() });
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const listAppointmentsSchema = paginationSchema.extend({
  status: z.enum(APPOINTMENT_STATUS).optional(),
  doctorId: idSchema.optional(),
  conditionId: idSchema.optional(),
  upcomingOnly: z.coerce
    .boolean()
    .optional()
    .describe('Only appointments scheduled in the future'),
});
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>;

export const appointmentCapabilities = {
  list: capability({
    name: 'appointments.list',
    description:
      'List the user\'s appointments, newest first. Filter to upcoming ones, or to a doctor or condition.',
    kind: 'read',
    input: listAppointmentsSchema,
  }),
  get: capability({
    name: 'appointments.get',
    description: 'Read one appointment by id.',
    kind: 'read',
    input: byIdSchema,
  }),
  create: capability({
    name: 'appointments.create',
    description: 'Schedule a new appointment.',
    kind: 'write',
    input: createAppointmentSchema,
  }),
  update: capability({
    name: 'appointments.update',
    description:
      'Change an appointment, or complete it by setting its status and recording what the doctor said in `outcome`.',
    kind: 'write',
    input: updateAppointmentSchema,
  }),
  remove: capability({
    name: 'appointments.delete',
    description: 'Remove an appointment from the record.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
