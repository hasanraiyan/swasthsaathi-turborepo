import type {
  ActivityLevel,
  AlcoholUse,
  FamilyHistoryItem,
  PreventiveCheckKey,
  SexAtBirth,
  TobaccoUse,
} from '@repo/contracts';

/**
 * What Swasthya Saathi knows about staying well.
 *
 * This table is the preventive product. Each rule says what a check is for in
 * plain language, who it applies to, and how often -- and the `applies`
 * function returns the *reason* rather than a boolean, so the plan can always
 * tell the user why something is on their list. A schedule nobody understands
 * gets ignored; a reason is what turns it into awareness.
 *
 * Weighted towards what actually kills and disables people in India:
 * undiagnosed diabetes and hypertension, anaemia in women of reproductive
 * age, tobacco-driven oral cancer, and cervical cancer.
 *
 * Not medical advice and not a substitute for a doctor -- these are the
 * widely published general-population intervals, and every one of them is a
 * prompt to go and get checked, never a diagnosis.
 */

export interface PreventionContext {
  age: number | null;
  sexAtBirth: SexAtBirth | null;
  bmi: number | null;
  tobaccoUse: TobaccoUse | null;
  alcoholUse: AlcoholUse | null;
  activityLevel: ActivityLevel | null;
  familyHistory: FamilyHistoryItem[];
  /** Lower-cased names of the conditions on record. */
  conditions: string[];
}

export interface CheckRule {
  key: PreventiveCheckKey;
  title: string;
  /** Why this check exists at all. Shown to the user. */
  why: string;
  /** The reason it applies to this person, or null if it does not. */
  applies: (ctx: PreventionContext) => string | null;
  everyMonths: (ctx: PreventionContext) => number;
}

/** Does any condition on record mention one of these words? */
function hasCondition(ctx: PreventionContext, ...terms: string[]): boolean {
  return ctx.conditions.some((name) =>
    terms.some((term) => name.includes(term)),
  );
}

function isDiabetic(ctx: PreventionContext): boolean {
  return hasCondition(ctx, 'diabet', 'sugar');
}

function isHypertensive(ctx: PreventionContext): boolean {
  return hasCondition(ctx, 'hypertension', 'blood pressure', 'bp');
}

function usesTobacco(ctx: PreventionContext): boolean {
  return ctx.tobaccoUse === 'daily' || ctx.tobaccoUse === 'occasional';
}

function atLeast(age: number | null, years: number): boolean {
  return age !== null && age >= years;
}

export const CHECK_RULES: CheckRule[] = [
  {
    key: 'blood_pressure',
    title: 'Blood pressure check',
    why: 'High blood pressure usually causes no symptoms at all. A reading is the only way to find it before it damages the heart, kidneys or eyes.',
    applies: (ctx) => {
      if (isHypertensive(ctx)) {
        return 'You are being treated for blood pressure';
      }
      if (!atLeast(ctx.age, 18)) {
        return null;
      }
      if (ctx.familyHistory.includes('hypertension')) {
        return 'Blood pressure runs in your family';
      }
      return 'Recommended for every adult';
    },
    everyMonths: (ctx) => (isHypertensive(ctx) ? 3 : 12),
  },
  {
    key: 'blood_glucose',
    title: 'Blood sugar test',
    why: 'India has one of the largest numbers of people living with diabetes, and it often runs silently for years before it is found.',
    applies: (ctx) => {
      if (isDiabetic(ctx)) {
        return 'You are being treated for diabetes';
      }
      if (ctx.familyHistory.includes('diabetes')) {
        return 'Diabetes runs in your family';
      }
      if (ctx.bmi !== null && ctx.bmi >= 25) {
        return 'Your BMI is above the healthy range';
      }
      if (atLeast(ctx.age, 30)) {
        return 'Recommended from age 30 onwards in India';
      }
      return null;
    },
    everyMonths: (ctx) => (isDiabetic(ctx) ? 3 : 12),
  },
  {
    key: 'haemoglobin',
    title: 'Haemoglobin test',
    why: 'Anaemia affects a very large share of Indian women and is easy to miss -- the tiredness gets blamed on everything else.',
    applies: (ctx) => {
      if (ctx.sexAtBirth !== 'female' || ctx.age === null) {
        return null;
      }
      return ctx.age >= 15 && ctx.age <= 49
        ? 'Recommended for women of reproductive age'
        : null;
    },
    everyMonths: () => 12,
  },
  {
    key: 'weight_check',
    title: 'Weigh yourself',
    why: 'A single weight says little. The trend across months is what shows a problem forming, early enough to do something about it.',
    applies: (ctx) => (atLeast(ctx.age, 18) ? 'Useful for everyone' : null),
    everyMonths: () => 3,
  },
  {
    key: 'lipid_profile',
    title: 'Cholesterol test',
    why: 'Cholesterol builds up quietly for years before it causes a heart attack or a stroke. Finding it early makes it very treatable.',
    applies: (ctx) => {
      if (isDiabetic(ctx)) {
        return 'Diabetes raises heart risk';
      }
      if (
        ctx.familyHistory.includes('heart_disease') ||
        ctx.familyHistory.includes('stroke')
      ) {
        return 'Heart disease runs in your family';
      }
      if (usesTobacco(ctx)) {
        return 'Tobacco raises heart risk';
      }
      return atLeast(ctx.age, 40) ? 'Recommended from age 40 onwards' : null;
    },
    everyMonths: (ctx) => (isDiabetic(ctx) || isHypertensive(ctx) ? 12 : 24),
  },
  {
    key: 'dental_check',
    title: 'Dental check-up',
    why: 'Gum disease is linked to heart disease and makes diabetes harder to control. It is painless until it is advanced.',
    applies: () => 'Recommended for everyone',
    everyMonths: () => 12,
  },
  {
    key: 'eye_check',
    title: 'Eye test',
    why: 'Glaucoma and cataract build slowly, and by the time sight is clearly affected some of the damage cannot be undone.',
    applies: (ctx) =>
      atLeast(ctx.age, 40) ? 'Recommended from age 40 onwards' : null,
    everyMonths: () => 24,
  },
  {
    key: 'diabetic_eye_exam',
    title: 'Diabetic eye examination',
    why: 'Diabetes can damage the retina long before vision changes. Caught early, that damage can usually be stopped.',
    applies: (ctx) =>
      isDiabetic(ctx) ? 'You are being treated for diabetes' : null,
    everyMonths: () => 12,
  },
  {
    key: 'oral_cancer_screening',
    title: 'Mouth check for early signs',
    why: 'India has among the highest rates of oral cancer in the world, and chewed tobacco is the main cause. Found early it is very treatable.',
    applies: (ctx) => {
      if (usesTobacco(ctx)) {
        return 'You currently use tobacco';
      }
      return ctx.tobaccoUse === 'former'
        ? 'You used tobacco in the past'
        : null;
    },
    everyMonths: (ctx) => (usesTobacco(ctx) ? 12 : 24),
  },
  {
    key: 'cervical_cancer_screening',
    title: 'Cervical screening',
    why: 'Cervical cancer is one of the most common cancers among Indian women, and one of the most preventable when found early.',
    applies: (ctx) => {
      if (ctx.sexAtBirth !== 'female' || ctx.age === null) {
        return null;
      }
      return ctx.age >= 30 && ctx.age <= 65
        ? 'Recommended for women aged 30 to 65'
        : null;
    },
    everyMonths: () => 36,
  },
  {
    key: 'tobacco_cessation',
    title: 'Tobacco check-in',
    why: 'Stopping at any age adds years back. Most people who succeed have tried more than once, so a regular check-in matters more than willpower.',
    applies: (ctx) => (usesTobacco(ctx) ? 'You currently use tobacco' : null),
    everyMonths: () => 3,
  },
  {
    key: 'general_checkup',
    title: 'General health check-up',
    why: 'A routine look at the whole picture catches the things no single test is looking for.',
    applies: (ctx) =>
      atLeast(ctx.age, 18) ? 'Recommended for every adult' : null,
    everyMonths: (ctx) => (atLeast(ctx.age, 50) ? 12 : 24),
  },
];
