/**
 * Core healthcare domain enums and constants used across Swasthya Saathi API.
 */

export const BLOOD_GROUP = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUP)[number];

export const SEX_AT_BIRTH = ['male', 'female', 'other'] as const;
export type SexAtBirth = (typeof SEX_AT_BIRTH)[number];

export const TOBACCO_USE = ['never', 'former', 'current'] as const;
export type TobaccoUse = (typeof TOBACCO_USE)[number];

export const ALCOHOL_USE = ['never', 'occasional', 'regular', 'heavy'] as const;
export type AlcoholUse = (typeof ALCOHOL_USE)[number];

export const ACTIVITY_LEVEL = ['sedentary', 'light', 'moderate', 'active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVEL)[number];

export const FAMILY_HISTORY = [
  'diabetes',
  'hypertension',
  'heart_disease',
  'cancer',
  'stroke',
] as const;
export type FamilyHistoryItem = (typeof FAMILY_HISTORY)[number];

export const APPOINTMENT_STATUS = [
  'scheduled',
  'completed',
  'cancelled',
  'rescheduled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const CONDITION_STATUS = ['active', 'managed', 'resolved'] as const;
export type ConditionStatus = (typeof CONDITION_STATUS)[number];

export const CONDITION_SEVERITY = ['mild', 'moderate', 'severe'] as const;
export type ConditionSeverity = (typeof CONDITION_SEVERITY)[number];

export const DOCUMENT_KIND = [
  'lab_report',
  'prescription',
  'scan',
  'discharge_summary',
  'insurance',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KIND)[number];

export const MEASUREMENT_TYPE = [
  'blood_pressure',
  'blood_sugar',
  'heart_rate',
  'weight',
  'spo2',
  'temperature',
] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPE)[number];

export const PREVENTIVE_CHECK = [
  'blood_pressure_check',
  'blood_sugar_fasting',
  'weight_check',
  'lipid_profile',
  'dental_check',
  'eye_check',
  'diabetic_eye_exam',
  'oral_cancer_screening',
  'cervical_cancer_screening',
  'tobacco_cessation',
  'general_checkup',
] as const;
export type PreventiveCheckKey = (typeof PREVENTIVE_CHECK)[number];

export const CHECK_STATUS = ['overdue', 'due', 'due_soon', 'up_to_date'] as const;
export type CheckStatus = (typeof CHECK_STATUS)[number];

export const BMI_BAND = ['underweight', 'healthy', 'overweight', 'obese'] as const;
export type BmiBand = (typeof BMI_BAND)[number];

export const MEDICINE_STATUS = ['active', 'stopped'] as const;
export type MedicineStatus = (typeof MEDICINE_STATUS)[number];

export const DOSE_STATUS = ['taken', 'missed', 'skipped'] as const;
export type DoseStatus = (typeof DOSE_STATUS)[number];

export const MEAL_RELATION = ['before_meal', 'with_meal', 'after_meal', 'irrelevant'] as const;
export type MealRelation = (typeof MEAL_RELATION)[number];

export const DOSE_TIMING = ['morning', 'afternoon', 'evening', 'bedtime', 'as_needed'] as const;
export type DoseTiming = (typeof DOSE_TIMING)[number];

export const MEDICINE_FORM = [
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'inhaler',
  'drops',
  'ointment',
  'powder',
  'patch',
  'other',
] as const;
export type MedicineForm = (typeof MEDICINE_FORM)[number];
