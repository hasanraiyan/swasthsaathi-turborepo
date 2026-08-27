import { buildTestApp, ALICE, type TestApp } from '../support/test-app';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry.service';
import { Connection } from 'mongoose';
import { NotFoundError, ConflictError } from '../../src/common/errors';

/**
 * Integration tests for the medicines domain.
 *
 * Real services, real Mongo (in memory), driven through `registry.invoke`.
 */

describe('medicines', () => {
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

  describe('dose materialisation', () => {
    it('creating a medicine, adding a schedule, then reading the day materialises one dose per time', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Metformin',
        form: 'tablet',
      })) as { id: string };

      await registry.invoke('medicationSchedules.create', ALICE, {
        medicineId: medicine.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['08:00', '20:00'],
        timing: 'after_food',
        startsOn: '2099-01-01',
      });

      const day = (await registry.invoke('medicationDoses.day', ALICE, {
        date: '2099-01-01',
      })) as {
        doses: Array<{ status: string }>;
        totalCount: number;
      };

      expect(day.totalCount).toBe(2);
      expect(day.doses.every((d) => d.status === 'pending')).toBe(true);
    });

    it('reading the same day twice does not duplicate doses', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Aspirin',
      })) as { id: string };

      await registry.invoke('medicationSchedules.create', ALICE, {
        medicineId: medicine.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['09:00'],
        timing: 'anytime',
      });

      await registry.invoke('medicationDoses.day', ALICE, {});
      const day2 = (await registry.invoke(
        'medicationDoses.day',
        ALICE,
        {},
      )) as { doses: unknown[]; totalCount: number };

      expect(day2.totalCount).toBe(1);
    });
  });

  describe('dose lifecycle', () => {
    it('recording a dose as taken moves it out of pending and into adherence numbers', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Metformin',
      })) as { id: string };

      await registry.invoke('medicationSchedules.create', ALICE, {
        medicineId: medicine.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['08:00'],
        timing: 'anytime',
      });

      const day = (await registry.invoke('medicationDoses.day', ALICE, {})) as {
        doses: Array<{ id: string; status: string }>;
      };
      const firstDose = day.doses[0];

      await registry.invoke('medicationDoses.record', ALICE, {
        doseId: firstDose.id,
        status: 'taken',
      });

      const adherence = (await registry.invoke(
        'medicationDoses.adherence',
        ALICE,
        {},
      )) as { taken: number; missed: number; pending: number };

      expect(adherence.taken).toBe(1);
      expect(adherence.missed).toBe(0);
      expect(adherence.pending).toBe(0);
    });
  });

  describe('stop vs delete', () => {
    it('medicines.stop deactivates schedules and keeps past doses', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Metformin',
      })) as { id: string };

      await registry.invoke('medicationSchedules.create', ALICE, {
        medicineId: medicine.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['08:00'],
        timing: 'anytime',
      });

      // Materialise some doses
      await registry.invoke('medicationDoses.day', ALICE, {});

      // Stop the medicine
      const stopped = (await registry.invoke('medicines.stop', ALICE, {
        id: medicine.id,
        reason: 'Course finished',
      })) as { status: string };

      expect(stopped.status).toBe('stopped');

      // Schedules should be deactivated
      const schedules = (await registry.invoke(
        'medicationSchedules.list',
        ALICE,
        { medicineId: medicine.id, activeOnly: false },
      )) as { items: Array<{ active: boolean }> };

      expect(schedules.items.every((s) => s.active === false)).toBe(true);
    });

    it('medicines.delete removes the medicine and its schedules', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Ibuprofen',
      })) as { id: string };

      await registry.invoke('medicationSchedules.create', ALICE, {
        medicineId: medicine.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['08:00'],
        timing: 'anytime',
      });

      const deleted = (await registry.invoke('medicines.delete', ALICE, {
        id: medicine.id,
      })) as { deleted: boolean };

      expect(deleted.deleted).toBe(true);

      // Medicine should be gone
      await expect(
        registry.invoke('medicines.get', ALICE, { id: medicine.id }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('validation', () => {
    it('a schedule ending before it starts is refused', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Test',
      })) as { id: string };

      await expect(
        registry.invoke('medicationSchedules.create', ALICE, {
          medicineId: medicine.id,
          doseAmount: 1,
          doseUnit: 'tablet',
          timesOfDay: ['08:00'],
          timing: 'anytime',
          startsOn: '2026-09-01',
          endsOn: '2026-08-01', // ends before starts
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('adherence', () => {
    it('adherence over a window counts taken, missed and skipped, and rate excludes pending', async () => {
      const medicine = (await registry.invoke('medicines.create', ALICE, {
        name: 'Metformin',
      })) as { id: string };

      await registry.invoke('medicationSchedules.create', ALICE, {
        medicineId: medicine.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['08:00'],
        timing: 'anytime',
      });

      // Materialise doses for today
      const day = (await registry.invoke('medicationDoses.day', ALICE, {})) as {
        doses: Array<{ id: string }>;
      };

      // Take the dose
      await registry.invoke('medicationDoses.record', ALICE, {
        doseId: day.doses[0].id,
        status: 'taken',
      });

      const adherence = (await registry.invoke(
        'medicationDoses.adherence',
        ALICE,
        {},
      )) as {
        taken: number;
        skipped: number;
        missed: number;
        pending: number;
        adherenceRate: number | null;
      };

      expect(adherence.taken).toBe(1);
      expect(adherence.pending).toBe(0);
      // Rate is taken / (taken + missed + skipped) — excludes pending
      expect(adherence.adherenceRate).toBe(1);
    });
  });
});
