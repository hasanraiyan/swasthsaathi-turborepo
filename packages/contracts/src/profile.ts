import { z } from 'zod';

import { capability, dateOnlySchema, notesSchema, recordMetaShape } from './common';

export const SEX_AT_BIRTH = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export const BLOOD_GROUP = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export type SexAtBirth = (typeof SEX_AT_BIRTH)[number];
export type BloodGroup = (typeof BLOOD_GROUP)[number];

/**
 * The person using the app. One profile per Clerk user.
 *
 * Name and email stay in Clerk -- this holds only the health context that
 * every other capability reads from (age for dosing context, allergies for
 * medicine safety, emergency contact for appointments).
 */
export const profileSchema = z.object({
  ...recordMetaShape,
  fullName: z.string().max(200).nullable(),
  dateOfBirth: dateOnlySchema.nullable(),
  sexAtBirth: z.enum(SEX_AT_BIRTH).nullable(),
  bloodGroup: z.enum(BLOOD_GROUP).nullable(),
  heightCm: z.number().positive().max(300).nullable(),
  weightKg: z.number().positive().max(700).nullable(),
  allergies: z.array(z.string().min(1).max(120)),
  emergencyContactName: z.string().max(200).nullable(),
  emergencyContactPhone: z.string().max(40).nullable(),
  notes: notesSchema.nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().max(200).nullish().describe('The name the user goes by'),
  dateOfBirth: dateOnlySchema.nullish().describe('Date of birth as YYYY-MM-DD'),
  sexAtBirth: z.enum(SEX_AT_BIRTH).nullish(),
  bloodGroup: z.enum(BLOOD_GROUP).nullish(),
  heightCm: z.number().positive().max(300).nullish(),
  weightKg: z.number().positive().max(700).nullish(),
  allergies: z
    .array(z.string().min(1).max(120))
    .max(50)
    .optional()
    .describe('Known allergies, e.g. ["penicillin", "peanuts"]'),
  emergencyContactName: z.string().max(200).nullish(),
  emergencyContactPhone: z.string().max(40).nullish(),
  notes: notesSchema.nullish(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileCapabilities = {
  get: capability({
    name: 'profile.get',
    description:
      "Read the signed-in user's health profile: age, blood group, height, weight, allergies and emergency contact.",
    kind: 'read',
    input: z.object({}),
  }),
  update: capability({
    name: 'profile.update',
    description:
      "Update fields on the user's health profile. Only the fields provided are changed.",
    kind: 'write',
    input: updateProfileSchema,
  }),
} as const;
