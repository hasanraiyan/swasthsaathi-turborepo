import { z } from 'zod';

import { capability, dateOnlySchema, notesSchema, recordMetaShape } from './common';

export const SEX_AT_BIRTH = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export const BLOOD_GROUP = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/**
 * The health baseline: the handful of facts that decide which preventive
 * checks a person actually needs.
 *
 * Nothing in the product can be preventive without these -- a screening
 * schedule is a function of age, sex, body, habits and family history, and
 * with none of them recorded every user would get the same generic list.
 */
export const TOBACCO_USE = ['never', 'former', 'occasional', 'daily'] as const;
export const ALCOHOL_USE = ['never', 'occasional', 'regular'] as const;
export const ACTIVITY_LEVEL = ['sedentary', 'light', 'moderate', 'active'] as const;

/** Conditions in a close blood relative that change what to screen for. */
export const FAMILY_HISTORY = [
  'diabetes',
  'hypertension',
  'heart_disease',
  'stroke',
  'cancer',
  'kidney_disease',
  'thyroid',
  'tuberculosis',
  'mental_health',
] as const;

export type SexAtBirth = (typeof SEX_AT_BIRTH)[number];
export type BloodGroup = (typeof BLOOD_GROUP)[number];
export type TobaccoUse = (typeof TOBACCO_USE)[number];
export type AlcoholUse = (typeof ALCOHOL_USE)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVEL)[number];
export type FamilyHistoryItem = (typeof FAMILY_HISTORY)[number];

/**
 * What the baseline needs before a preventive plan can be personalised.
 * Family history is deliberately not required -- "none that I know of" is a
 * legitimate answer and an empty list already says it.
 */
export const REQUIRED_BASELINE_FIELDS = [
  'dateOfBirth',
  'sexAtBirth',
  'heightCm',
  'weightKg',
  'tobaccoUse',
  'alcoholUse',
  'activityLevel',
] as const;

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
  tobaccoUse: z.enum(TOBACCO_USE).nullable(),
  alcoholUse: z.enum(ALCOHOL_USE).nullable(),
  activityLevel: z.enum(ACTIVITY_LEVEL).nullable(),
  familyHistory: z.array(z.enum(FAMILY_HISTORY)),
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
  tobaccoUse: z
    .enum(TOBACCO_USE)
    .nullish()
    .describe('Includes cigarettes, bidi, gutkha, khaini and paan masala'),
  alcoholUse: z.enum(ALCOHOL_USE).nullish(),
  activityLevel: z
    .enum(ACTIVITY_LEVEL)
    .nullish()
    .describe('Rough level of physical activity in a normal week'),
  familyHistory: z
    .array(z.enum(FAMILY_HISTORY))
    .max(20)
    .optional()
    .describe('Conditions in a parent, sibling or child'),
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
