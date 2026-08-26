import type { Actor } from '@repo/contracts';
import { buildTestApp, ALICE, type TestApp } from '../support/test-app';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry.service';
import { Connection } from 'mongoose';
import { InvalidInputError } from '../../src/common/errors';

/**
 * Integration tests for the measurements domain.
 */

describe('measurements', () => {
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

  describe('validation', () => {
    it('blood pressure without a diastolic value is refused', async () => {
      await expect(
        registry.invoke('measurements.record', ALICE, {
          type: 'blood_pressure',
          value: 140,
        }),
      ).rejects.toThrow(InvalidInputError);
    });

    it('recording without a unit fills in the type default', async () => {
      const measurement = (await registry.invoke(
        'measurements.record',
        ALICE,
        {
          type: 'weight',
          value: 70,
        },
      )) as { unit: string };

      expect(measurement.unit).toBe('kg');
    });

    it('changing a reading type without a unit updates the unit too', async () => {
      const created = (await registry.invoke(
        'measurements.record',
        ALICE,
        {
          type: 'blood_pressure',
          value: 140,
          valueSecondary: 90,
        },
      )) as { id: string; unit: string };

      expect(created.unit).toBe('mmHg');

      // Update the type to weight without specifying a unit
      const updated = (await registry.invoke(
        'measurements.update',
        ALICE,
        {
          id: created.id,
          type: 'weight',
          value: 70,
        },
      )) as { unit: string };

      expect(updated.unit).toBe('kg');
    });
  });

  describe('trend', () => {
    it('measurements.trend computes average, min and max over the window only', async () => {
      // Record several weight readings
      await registry.invoke('measurements.record', ALICE, {
        type: 'weight',
        value: 70,
      });
      await registry.invoke('measurements.record', ALICE, {
        type: 'weight',
        value: 72,
      });
      await registry.invoke('measurements.record', ALICE, {
        type: 'weight',
        value: 68,
      });

      const trend = (await registry.invoke('measurements.trend', ALICE, {
        type: 'weight',
      })) as {
        count: number;
        average: number;
        min: number;
        max: number;
      };

      expect(trend.count).toBe(3);
      expect(trend.average).toBeCloseTo(70, 0);
      expect(trend.min).toBe(68);
      expect(trend.max).toBe(72);
    });

    it('trend with no data returns count 0 and null values', async () => {
      const trend = (await registry.invoke('measurements.trend', ALICE, {
        type: 'weight',
      })) as {
        count: number;
        average: number | null;
        min: number | null;
        max: number | null;
      };

      expect(trend.count).toBe(0);
      expect(trend.average).toBeNull();
      expect(trend.min).toBeNull();
      expect(trend.max).toBeNull();
    });
  });
});
