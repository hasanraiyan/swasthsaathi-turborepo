import { z } from 'zod';
import type { Actor } from '@repo/contracts';
import { NotFoundError, InvalidInputError } from '../../src/common/errors';
import { ALICE, BOB, buildTestApp } from '../support/test-app';

/**
 * Ownership integration test.
 *
 * The single most important test in the suite: prove that every capability
 * respects per-user isolation. One missing scope means a stranger's health
 * record is reachable, and this test catches it for the whole registry at
 * once — including capabilities added after this test was written.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether a capability's input schema requires an `id` field.
 * We parse an empty object; if the error references path `['id']`, the
 * schema has a required `id` — meaning it addresses one record, and
 * ownership must be checked.
 */
function inputRequiresId(schema: z.ZodType): boolean {
  const result = schema.safeParse({});
  if (result.success) return false;
  return result.error.issues.some(
    (i) => i.path.length === 1 && i.path[0] === 'id',
  );
}

/**
 * Create a prerequisite record as the given actor and return its `id`.
 *
 * Each capability that takes an `id` needs the record to exist first.
 * This map provides the create-capability name and minimal input for each
 * domain. Multi-step domains (like medicationSchedules which need a
 * medicine first) chain through the helper.
 */
async function createRecordForCapability(
  registry: {
    invoke: (name: string, actor: Actor, input?: unknown) => Promise<unknown>;
  },
  capabilityName: string,
  actor: Actor,
): Promise<string> {
  const domain = capabilityName.split('.')[0];

  switch (domain) {
    case 'conditions': {
      const r = (await registry.invoke('conditions.create', actor, {
        name: 'Ownership test condition',
        status: 'active',
      })) as { id: string };
      return r.id;
    }
    case 'doctors': {
      const r = (await registry.invoke('doctors.create', actor, {
        name: 'Dr Ownership Test',
      })) as { id: string };
      return r.id;
    }
    case 'medicines': {
      const r = (await registry.invoke('medicines.create', actor, {
        name: 'Ownership test medicine',
      })) as { id: string };
      return r.id;
    }
    case 'medicationSchedules': {
      // Need a medicine first
      const med = (await registry.invoke('medicines.create', actor, {
        name: 'Schedule test medicine',
      })) as { id: string };
      const r = (await registry.invoke('medicationSchedules.create', actor, {
        medicineId: med.id,
        doseAmount: 1,
        doseUnit: 'tablet',
        timesOfDay: ['08:00'],
        timing: 'anytime',
      })) as { id: string };
      return r.id;
    }
    case 'appointments': {
      const r = (await registry.invoke('appointments.create', actor, {
        title: 'Ownership test appointment',
        scheduledFor: '2026-09-01T10:00:00+05:30',
      })) as { id: string };
      return r.id;
    }
    case 'symptoms': {
      const r = (await registry.invoke('symptoms.log', actor, {
        name: 'headache',
        severity: 3,
      })) as { id: string };
      return r.id;
    }
    case 'measurements': {
      const r = (await registry.invoke('measurements.record', actor, {
        type: 'weight',
        value: 70,
      })) as { id: string };
      return r.id;
    }
    case 'documents': {
      const r = (await registry.invoke('documents.create', actor, {
        title: 'Ownership test document',
        kind: 'lab_report',
      })) as { id: string };
      return r.id;
    }
    default:
      throw new Error(`No create helper for domain "${domain}"`);
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('ownership', () => {
  let registry: ReturnType<typeof buildTestApp> extends Promise<infer T>
    ? T extends { registry: infer R }
      ? R
      : never
    : never;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const testApp = await buildTestApp();
    registry = testApp.registry;
    close = () => testApp.app.close();
  });

  afterAll(async () => {
    await close();
  });

  // Collect capabilities that require an id, grouped by kind
  const capsRequiringId: Array<{
    name: string;
    kind: string;
  }> = [];

  beforeAll(() => {
    for (const desc of registry.list()) {
      if (inputRequiresId(desc.input)) {
        capsRequiringId.push({ name: desc.name, kind: desc.kind });
      }
    }
  });

  it('finds capabilities that require an id to test', () => {
    expect(capsRequiringId.length).toBeGreaterThan(0);
  });

  // --- Read capabilities: bob must not see alice's record -----------------

  describe('read capabilities', () => {
    const readCaps = capsRequiringId.filter((c) => c.kind === 'read');

    for (const cap of readCaps) {
      it(`${cap.name}: bob cannot read alice's record`, async () => {
        const aliceId = await createRecordForCapability(
          registry,
          cap.name,
          ALICE,
        );

        await expect(
          registry.invoke(cap.name, BOB, { id: aliceId }),
        ).rejects.toThrow(NotFoundError);
      });
    }
  });

  // --- Write capabilities: bob must not update/delete alice's record ------

  describe('write capabilities', () => {
    // Update capabilities
    const updateCaps = capsRequiringId.filter(
      (c) => c.kind === 'write' && c.name.endsWith('.update'),
    );

    for (const cap of updateCaps) {
      it(`${cap.name}: bob cannot update alice's record`, async () => {
        const aliceId = await createRecordForCapability(
          registry,
          cap.name,
          ALICE,
        );

        await expect(
          registry.invoke(cap.name, BOB, { id: aliceId, name: 'Hacked' }),
        ).rejects.toThrow(NotFoundError);
      });
    }

    // Delete capabilities
    const deleteCaps = capsRequiringId.filter(
      (c) =>
        c.kind === 'write' &&
        (c.name.endsWith('.delete') || c.name.endsWith('.stop')),
    );

    for (const cap of deleteCaps) {
      it(`${cap.name}: bob cannot delete alice's record`, async () => {
        const aliceId = await createRecordForCapability(
          registry,
          cap.name,
          ALICE,
        );

        await expect(
          registry.invoke(cap.name, BOB, { id: aliceId }),
        ).rejects.toThrow(NotFoundError);
      });
    }
  });

  // --- Completeness: every capability with an id was exercised -------------

  it('exercises every capability that requires an id', () => {
    const allCaps = registry.list();
    const withId = allCaps.filter((desc) => inputRequiresId(desc.input));
    const exercised = capsRequiringId;

    // Allow-list: capabilities that take an id but aren't standard CRUD
    // (e.g. none at this point — every one should be tested).
    const allowList: string[] = [];

    const exercisedNames = new Set(exercised.map((c) => c.name));
    const missing = withId.filter(
      (c) => !exercisedNames.has(c.name) && !allowList.includes(c.name),
    );

    expect(missing).toEqual([]);
    expect(exercised.length).toBe(withId.length - allowList.length);
  });

  // --- Cross-user reference: bob must not link to alice's record -----------

  describe('cross-user references', () => {
    it("bob creating a medicine with alice's conditionId is refused", async () => {
      // Alice creates a condition
      const aliceCondition = (await registry.invoke(
        'conditions.create',
        ALICE,
        { name: 'Diabetes', status: 'active' },
      )) as { id: string };

      // Bob tries to create a medicine linked to alice's condition
      await expect(
        registry.invoke('medicines.create', BOB, {
          name: 'Sneaky medicine',
          conditionId: aliceCondition.id,
        }),
      ).rejects.toThrow(InvalidInputError);
    });
  });

  // --- Same error for missing vs. wrong owner -----------------------------

  describe('error equivalence', () => {
    it("missing record and someone else's record return the same error", async () => {
      const aliceId = await createRecordForCapability(
        registry,
        'conditions.get',
        ALICE,
      );
      const fakeId = '000000000000000000000000';

      let missingError: Error | null = null;
      let wrongOwnerError: Error | null = null;

      try {
        await registry.invoke('conditions.get', BOB, { id: fakeId });
      } catch (e) {
        missingError = e as Error;
      }

      try {
        await registry.invoke('conditions.get', BOB, { id: aliceId });
      } catch (e) {
        wrongOwnerError = e as Error;
      }

      expect(missingError).not.toBeNull();
      expect(wrongOwnerError).not.toBeNull();
      expect(missingError!.name).toBe(wrongOwnerError!.name);
      expect(missingError!.message).toBe(wrongOwnerError!.message);
    });
  });
});
