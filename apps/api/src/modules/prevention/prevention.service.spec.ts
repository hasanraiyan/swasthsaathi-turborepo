import { buildSnapshot } from './prevention.service';
import type { Profile } from '@repo/contracts';

/**
 * Unit tests for `buildSnapshot` — the pure function that derives the health
 * snapshot from a profile. No database, no Nest.
 */

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '000000000000000000000001',
    userId: 'test_user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fullName: null,
    dateOfBirth: null,
    sexAtBirth: null,
    bloodGroup: null,
    heightCm: null,
    weightKg: null,
    allergies: [],
    tobaccoUse: null,
    alcoholUse: null,
    activityLevel: null,
    familyHistory: [],
    emergencyContactName: null,
    emergencyContactPhone: null,
    notes: null,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  describe('BMI calculation', () => {
    it('uses Asian-Indian cut-offs: BMI 23 is overweight, not healthy', () => {
      // 160cm, 59kg → BMI = 59 / (1.6^2) = 23.0
      const profile = baseProfile({ heightCm: 160, weightKg: 59 });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.bmi).toBe(23);
      expect(snapshot.bmiBand).toBe('overweight');
    });

    it('BMI under 18.5 is underweight', () => {
      const profile = baseProfile({ heightCm: 170, weightKg: 45 });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.bmiBand).toBe('underweight');
    });

    it('BMI 18.5 to 22.9 is healthy (Asian-Indian)', () => {
      const profile = baseProfile({ heightCm: 170, weightKg: 65 });
      const snapshot = buildSnapshot(profile);
      // 65 / (1.7^2) = 22.5
      expect(snapshot.bmiBand).toBe('healthy');
    });

    it('BMI >= 27.5 is obese', () => {
      const profile = baseProfile({ heightCm: 160, weightKg: 72 });
      const snapshot = buildSnapshot(profile);
      // 72 / (1.6^2) = 28.1
      expect(snapshot.bmiBand).toBe('obese');
    });
  });

  describe('BMI edge cases', () => {
    it('BMI is null when height is missing', () => {
      const profile = baseProfile({ weightKg: 70 });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.bmi).toBeNull();
      expect(snapshot.bmiBand).toBeNull();
    });

    it('BMI is null when weight is missing', () => {
      const profile = baseProfile({ heightCm: 170 });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.bmi).toBeNull();
    });

    it('BMI is null when height is zero (no divide by zero)', () => {
      const profile = baseProfile({ heightCm: 0, weightKg: 70 });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.bmi).toBeNull();
    });
  });

  describe('baselineComplete', () => {
    it('is false when required fields are null', () => {
      const profile = baseProfile();
      const snapshot = buildSnapshot(profile);
      expect(snapshot.baselineComplete).toBe(false);
    });

    it('is true when all seven required fields are present', () => {
      const profile = baseProfile({
        dateOfBirth: '1990-01-01',
        sexAtBirth: 'male',
        heightCm: 170,
        weightKg: 70,
        tobaccoUse: 'never',
        alcoholUse: 'never',
        activityLevel: 'moderate',
      });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.baselineComplete).toBe(true);
      expect(snapshot.missingBaselineFields).toHaveLength(0);
    });

    it('lists the missing fields', () => {
      const profile = baseProfile({
        dateOfBirth: '1990-01-01',
        sexAtBirth: 'male',
        // heightCm, weightKg, tobaccoUse, alcoholUse, activityLevel missing
      });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.baselineComplete).toBe(false);
      expect(snapshot.missingBaselineFields).toContain('heightCm');
      expect(snapshot.missingBaselineFields).toContain('weightKg');
      expect(snapshot.missingBaselineFields).toContain('tobaccoUse');
    });
  });

  describe('riskFlags', () => {
    it('flags raised BMI', () => {
      const profile = baseProfile({ heightCm: 160, weightKg: 59 });
      const snapshot = buildSnapshot(profile);
      const keys = snapshot.riskFlags.map((f) => f.key);
      expect(keys).toContain('bmi');
    });

    it('flags tobacco use', () => {
      const profile = baseProfile({ tobaccoUse: 'daily' });
      const snapshot = buildSnapshot(profile);
      const keys = snapshot.riskFlags.map((f) => f.key);
      expect(keys).toContain('tobacco');
    });

    it('flags regular alcohol', () => {
      const profile = baseProfile({ alcoholUse: 'regular' });
      const snapshot = buildSnapshot(profile);
      const keys = snapshot.riskFlags.map((f) => f.key);
      expect(keys).toContain('alcohol');
    });

    it('flags sedentary activity', () => {
      const profile = baseProfile({ activityLevel: 'sedentary' });
      const snapshot = buildSnapshot(profile);
      const keys = snapshot.riskFlags.map((f) => f.key);
      expect(keys).toContain('activity');
    });

    it('flags family history', () => {
      const profile = baseProfile({ familyHistory: ['diabetes'] });
      const snapshot = buildSnapshot(profile);
      const keys = snapshot.riskFlags.map((f) => f.key);
      expect(keys).toContain('family');
    });

    it('flags age 45+', () => {
      const profile = baseProfile({
        dateOfBirth: '1980-01-01',
      });
      const snapshot = buildSnapshot(profile);
      const keys = snapshot.riskFlags.map((f) => f.key);
      expect(keys).toContain('age');
    });

    it('no flags for a healthy young person', () => {
      const profile = baseProfile({
        dateOfBirth: '2000-01-01',
        heightCm: 170,
        weightKg: 65,
        tobaccoUse: 'never',
        alcoholUse: 'never',
        activityLevel: 'active',
        familyHistory: [],
      });
      const snapshot = buildSnapshot(profile);
      expect(snapshot.riskFlags).toHaveLength(0);
    });
  });

  describe('age calculation', () => {
    it('computes age from date of birth', () => {
      const profile = baseProfile({
        dateOfBirth: '1990-06-15',
      });
      const snapshot = buildSnapshot(profile);
      expect(typeof snapshot.age).toBe('number');
      expect(snapshot.age!).toBeGreaterThanOrEqual(35);
      expect(snapshot.age!).toBeLessThanOrEqual(37);
    });

    it('age is null when date of birth is missing', () => {
      const profile = baseProfile();
      const snapshot = buildSnapshot(profile);
      expect(snapshot.age).toBeNull();
    });
  });
});
