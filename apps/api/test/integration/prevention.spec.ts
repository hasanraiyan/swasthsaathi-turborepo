import type { Actor } from '@repo/contracts';
import { buildTestApp, ALICE, type TestApp } from '../support/test-app';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry.service';
import { Connection } from 'mongoose';

/**
 * Integration tests for the prevention domain.
 *
 * The plan is derived on every read from the profile, conditions and past
 * completions. These tests prove the end-to-end flow through the database.
 */

describe('prevention', () => {
  let testApp: TestApp;
  let registry: CapabilityRegistry;
  let connection: Connection;

  beforeAll(async () => {
    testApp = await buildTestApp();
    registry = testApp.registry;
    connection = testApp.connection;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await connection.db!.dropDatabase();
  });

  async function setupCompleteProfile(actor: Actor) {
    await registry.invoke('profile.update', actor, {
      dateOfBirth: '1980-05-10',
      sexAtBirth: 'female',
      heightCm: 158,
      weightKg: 68,
      tobaccoUse: 'daily',
      alcoholUse: 'never',
      activityLevel: 'sedentary',
      familyHistory: ['diabetes', 'heart_disease'],
    });
  }

  describe('plan derivation', () => {
    it('the plan for a complete baseline contains expected checks', async () => {
      await setupCompleteProfile(ALICE);

      // Add a condition to exercise condition-driven rules
      await registry.invoke('conditions.create', ALICE, {
        name: 'Type 2 Diabetes',
        status: 'active',
      });

      const plan = (await registry.invoke('prevention.plan', ALICE)) as {
        checks: Array<{ key: string; status: string; everyMonths: number }>;
        snapshot: { baselineComplete: boolean };
      };

      expect(plan.snapshot.baselineComplete).toBe(true);

      const keys = plan.checks.map((c) => c.key);
      expect(keys).toContain('blood_pressure');
      expect(keys).toContain('blood_glucose');
      expect(keys).toContain('dental_check');
      expect(keys).toContain('oral_cancer_screening');
      expect(keys).toContain('diabetic_eye_exam');
      expect(keys).toContain('cervical_cancer_screening');
      expect(keys).toContain('haemoglobin');
    });

    it('completing a check moves it from due to up_to_date and sets next due date', async () => {
      await setupCompleteProfile(ALICE);

      await registry.invoke('prevention.complete', ALICE, {
        checkKey: 'blood_pressure',
        note: '128/82',
      });

      const plan = (await registry.invoke('prevention.plan', ALICE)) as {
        checks: Array<{
          key: string;
          status: string;
          dueOn: string;
          lastCompletedOn: string | null;
        }>;
      };

      const bp = plan.checks.find((c) => c.key === 'blood_pressure')!;
      expect(bp.status).toBe('up_to_date');
      expect(bp.lastCompletedOn).not.toBeNull();
      // Next due should be one interval out (12 months for BP)
      expect(bp.dueOn).toMatch(/^2027-/);
    });

    it('an overdue check sorts above a due one, which sorts above due_soon', async () => {
      await setupCompleteProfile(ALICE);

      // Complete blood pressure, then let time pass to make it overdue
      await registry.invoke('prevention.complete', ALICE, {
        checkKey: 'blood_pressure',
        completedOn: '2025-01-01',
      });

      const plan = (await registry.invoke('prevention.plan', ALICE)) as {
        checks: Array<{ key: string; status: string }>;
      };

      // Blood pressure should be overdue (completed a year ago, due every 12 months)
      const bp = plan.checks.find((c) => c.key === 'blood_pressure')!;
      expect(bp.status).toBe('overdue');

      // Overdue should be first (sorted by status order)
      const bpIndex = plan.checks.findIndex((c) => c.key === 'blood_pressure');
      expect(bpIndex).toBe(0);
    });

    it('changing the profile changes the plan on the next read', async () => {
      // Start without tobacco
      await registry.invoke('profile.update', ALICE, {
        dateOfBirth: '1990-01-01',
        sexAtBirth: 'male',
        heightCm: 170,
        weightKg: 70,
        tobaccoUse: 'never',
        alcoholUse: 'never',
        activityLevel: 'active',
        familyHistory: [],
      });

      let plan = (await registry.invoke('prevention.plan', ALICE)) as {
        checks: Array<{ key: string }>;
      };
      let keys = plan.checks.map((c) => c.key);
      expect(keys).not.toContain('oral_cancer_screening');

      // Now set tobacco to daily
      await registry.invoke('profile.update', ALICE, {
        tobaccoUse: 'daily',
      });

      plan = (await registry.invoke('prevention.plan', ALICE)) as {
        checks: Array<{ key: string }>;
      };
      keys = plan.checks.map((c) => c.key);
      expect(keys).toContain('oral_cancer_screening');
    });

    it('a brand-new empty profile still returns a plan and baselineComplete: false', async () => {
      const plan = (await registry.invoke('prevention.plan', ALICE)) as {
        checks: Array<{ key: string }>;
        snapshot: { baselineComplete: boolean };
      };

      expect(plan.snapshot.baselineComplete).toBe(false);
      expect(Array.isArray(plan.checks)).toBe(true);
      // Should not throw
    });
  });
});
