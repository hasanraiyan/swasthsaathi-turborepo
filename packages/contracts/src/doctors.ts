import { z } from 'zod';

import {
  byIdSchema,
  capability,
  notesSchema,
  paginationSchema,
  recordMetaShape,
} from './common';

/**
 * A doctor or clinician the user sees.
 *
 * Kept deliberately simple -- this is the user's own address book, not a
 * provider directory. Appointments and prescriptions reference it so the
 * timeline can say who was involved.
 */
export const doctorSchema = z.object({
  ...recordMetaShape,
  name: z.string().min(1).max(200),
  specialty: z.string().max(120).nullable(),
  hospital: z.string().max(200).nullable(),
  phone: z.string().max(40).nullable(),
  email: z.string().max(200).nullable(),
  notes: notesSchema.nullable(),
});
export type Doctor = z.infer<typeof doctorSchema>;

export const createDoctorSchema = z.object({
  name: z.string().min(1).max(200).describe('The doctor\'s name, e.g. "Dr. Meera Nair"'),
  specialty: z.string().max(120).nullish().describe('e.g. "Cardiologist", "General Physician"'),
  hospital: z.string().max(200).nullish().describe('Clinic or hospital they practise at'),
  phone: z.string().max(40).nullish(),
  email: z.email().max(200).nullish(),
  notes: notesSchema.nullish(),
});
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

export const updateDoctorSchema = createDoctorSchema.partial().extend(byIdSchema.shape);
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

export const listDoctorsSchema = paginationSchema.extend({
  search: z.string().max(200).optional().describe('Match against name, specialty or hospital'),
});
export type ListDoctorsInput = z.infer<typeof listDoctorsSchema>;

export const doctorCapabilities = {
  list: capability({
    name: 'doctors.list',
    description: 'List the doctors the user has saved, optionally filtered by a search term.',
    kind: 'read',
    input: listDoctorsSchema,
  }),
  get: capability({
    name: 'doctors.get',
    description: 'Read one saved doctor by id.',
    kind: 'read',
    input: byIdSchema,
  }),
  create: capability({
    name: 'doctors.create',
    description: 'Save a new doctor to the user\'s list.',
    kind: 'write',
    input: createDoctorSchema,
  }),
  update: capability({
    name: 'doctors.update',
    description: 'Update a saved doctor\'s contact details or specialty.',
    kind: 'write',
    input: updateDoctorSchema,
  }),
  remove: capability({
    name: 'doctors.delete',
    description:
      'Remove a doctor from the list. Appointments and prescriptions that referenced them are kept, unlinked.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
