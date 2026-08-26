import { CHECK_RULES, type PreventionContext } from './catalogue';

/**
 * Unit tests for the prevention catalogue.
 *
 * These test the rules directly with hand-built contexts — no database, no
 * Nest. The rules determine which preventive checks apply to whom, and each
 * case below describes a real scenario that matters for this product.
 */

function baseCtx(overrides: Partial<PreventionContext> = {}): PreventionContext {
  return {
    age: null,
    sexAtBirth: null,
    bmi: null,
    tobaccoUse: null,
    alcoholUse: null,
    activityLevel: null,
    familyHistory: [],
    conditions: [],
    ...overrides,
  };
}

function applicableChecks(ctx: PreventionContext): string[] {
  return CHECK_RULES.filter((rule) => rule.applies(ctx) !== null).map(
    (rule) => rule.key,
  );
}

function getRule(key: string) {
  return CHECK_RULES.find((r) => r.key === key)!;
}

describe('catalogue', () => {
  describe('age and sex basics', () => {
    it('a 20-year-old man gets blood pressure, weight, dental, general check-up', () => {
      const ctx = baseCtx({
        age: 20,
        sexAtBirth: 'male',
      });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('blood_pressure');
      expect(checks).toContain('weight_check');
      expect(checks).toContain('dental_check');
      expect(checks).toContain('general_checkup');
    });

    it('a 20-year-old man does NOT get cervical screening or anaemia', () => {
      const ctx = baseCtx({
        age: 20,
        sexAtBirth: 'male',
      });
      const checks = applicableChecks(ctx);
      expect(checks).not.toContain('cervical_cancer_screening');
      expect(checks).not.toContain('haemoglobin');
    });

    it('a 30-year-old woman gets anaemia screening', () => {
      const ctx = baseCtx({
        age: 30,
        sexAtBirth: 'female',
      });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('haemoglobin');
    });

    it('a 55-year-old woman does NOT get anaemia (outside 15-49 window)', () => {
      const ctx = baseCtx({
        age: 55,
        sexAtBirth: 'female',
      });
      const checks = applicableChecks(ctx);
      expect(checks).not.toContain('haemoglobin');
    });
  });

  describe('cervical cancer screening', () => {
    it('a woman of 40 gets cervical screening', () => {
      const ctx = baseCtx({ age: 40, sexAtBirth: 'female' });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('cervical_cancer_screening');
    });

    it('a woman of 70 does NOT get cervical screening (30-65 range)', () => {
      const ctx = baseCtx({ age: 70, sexAtBirth: 'female' });
      const checks = applicableChecks(ctx);
      expect(checks).not.toContain('cervical_cancer_screening');
    });

    it('a man of any age does NOT get cervical screening', () => {
      const ctx = baseCtx({ age: 45, sexAtBirth: 'male' });
      const checks = applicableChecks(ctx);
      expect(checks).not.toContain('cervical_cancer_screening');
    });
  });

  describe('tobacco use', () => {
    it('tobacco daily adds oral cancer screening', () => {
      const ctx = baseCtx({ tobaccoUse: 'daily' });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('oral_cancer_screening');
      expect(checks).toContain('tobacco_cessation');
    });

    it('tobacco former still adds oral cancer screening at longer interval', () => {
      const ctx = baseCtx({ tobaccoUse: 'former' });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('oral_cancer_screening');
      // Former users get 24-month interval (usesTobacco is false for 'former')
      expect(getRule('oral_cancer_screening').everyMonths(ctx)).toBe(24);
    });

    it('tobacco never does NOT add oral cancer screening', () => {
      const ctx = baseCtx({ tobaccoUse: 'never' });
      const checks = applicableChecks(ctx);
      expect(checks).not.toContain('oral_cancer_screening');
      expect(checks).not.toContain('tobacco_cessation');
    });
  });

  describe('conditions on record', () => {
    it('diabetes adds diabetic eye exam and tightens blood glucose to 3 months', () => {
      const ctx = baseCtx({ conditions: ['type 2 diabetes'] });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('diabetic_eye_exam');
      expect(getRule('blood_glucose').everyMonths(ctx)).toBe(3);
    });

    it('hypertension tightens blood pressure to 3 months', () => {
      const ctx = baseCtx({ conditions: ['hypertension'] });
      expect(getRule('blood_pressure').everyMonths(ctx)).toBe(3);
    });

    it('diabetes adds lipid profile earlier', () => {
      const ctx = baseCtx({ conditions: ['diabetes'] });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('lipid_profile');
    });
  });

  describe('family history', () => {
    it('family history of diabetes brings blood glucose forward even at 25', () => {
      const ctx = baseCtx({
        age: 25,
        familyHistory: ['diabetes'],
      });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('blood_glucose');
    });

    it('family history of hypertension adds blood pressure check', () => {
      const ctx = baseCtx({
        age: 20,
        familyHistory: ['hypertension'],
      });
      const checks = applicableChecks(ctx);
      expect(checks).toContain('blood_pressure');
    });
  });

  describe('applies return values', () => {
    it('every rule returns either null or a non-empty string', () => {
      const ctx = baseCtx({
        age: 45,
        sexAtBirth: 'female',
        bmi: 26,
        tobaccoUse: 'daily',
        alcoholUse: 'regular',
        activityLevel: 'sedentary',
        familyHistory: ['diabetes', 'heart_disease'],
        conditions: ['hypertension'],
      });

      for (const rule of CHECK_RULES) {
        const result = rule.applies(ctx);
        if (result !== null) {
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('null baseline', () => {
    it('with null age and null sex, nothing throws', () => {
      const ctx = baseCtx();
      expect(() => applicableChecks(ctx)).not.toThrow();
      // Should still get some universal checks
      const checks = applicableChecks(ctx);
      expect(checks).toContain('dental_check');
    });
  });
});
