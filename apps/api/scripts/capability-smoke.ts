/**
 * End-to-end check of the capability layer.
 *
 * Boots the real Nest app against a real MongoDB and drives a full medicine
 * journey through `CapabilityRegistry.invoke` -- the same path a future agent
 * tool call takes -- then asserts that one user cannot reach another's
 * records. Run it after changing a service to confirm the wiring still holds:
 *
 *   pnpm --filter api run smoke
 *
 * It drops its database when finished, so it refuses to run against anything
 * whose name doesn't end in `_smoke`.
 */
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Actor } from '@repo/contracts';
import type { Connection } from 'mongoose';

import { AppModule } from '../src/app.module';
import { CapabilityRegistry } from '../src/capabilities/capability-registry.service';

const actor: Actor = { userId: 'user_smoke_test' };

if (!/_smoke(\?|$)/.test(process.env.MONGODB_URI ?? '')) {
  console.error(
    'Refusing to run: this script drops its database at the end.\n' +
      'Point MONGODB_URI at a throwaway database whose name ends in "_smoke", e.g.\n' +
      '  MONGODB_URI=mongodb://127.0.0.1:27017/swasthsaathi_smoke',
  );
  process.exit(1);
}

function show(label: string, value: unknown): void {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2).slice(0, 900));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const registry = app.get(CapabilityRegistry);
  const connection = app.get<Connection>(getConnectionToken());

  const catalogue = registry.describe();
  console.log(`capabilities registered: ${catalogue.length}`);
  console.log(catalogue.map((c) => `  ${c.kind.padEnd(5)} ${c.name}`).join('\n'));
  show('sample tool definition', catalogue.find((c) => c.name === 'medicines.create'));

  const condition = (await registry.invoke('conditions.create', actor, {
    name: 'Type 2 Diabetes',
    status: 'active',
    diagnosedOn: '2024-03-11',
  })) as { id: string };
  show('conditions.create', condition);

  const medicine = (await registry.invoke('medicines.create', actor, {
    name: 'Metformin',
    form: 'tablet',
    strength: '500 mg',
    purpose: 'for blood sugar',
    conditionId: condition.id,
  })) as { id: string };
  show('medicines.create', medicine);

  const schedule = await registry.invoke('medicationSchedules.create', actor, {
    medicineId: medicine.id,
    doseAmount: 1,
    doseUnit: 'tablet',
    timesOfDay: ['08:00', '20:00'],
    timing: 'after_food',
  });
  show('medicationSchedules.create', schedule);

  const day = (await registry.invoke('medicationDoses.day', actor, {})) as {
    doses: Array<{ id: string; medicineName: string; status: string }>;
    takenCount: number;
    totalCount: number;
  };
  show('medicationDoses.day', day);

  const firstDose = day.doses[0];
  if (!firstDose) {
    throw new Error('materialisation produced no doses');
  }
  show(
    'medicationDoses.record',
    await registry.invoke('medicationDoses.record', actor, {
      doseId: firstDose.id,
      status: 'taken',
    }),
  );

  show('medicationDoses.adherence', await registry.invoke('medicationDoses.adherence', actor, {}));
  show('medicines.get (with schedules)', await registry.invoke('medicines.get', actor, { id: medicine.id }));

  // Ownership check: a different user must not see any of it.
  const intruder: Actor = { userId: 'user_intruder' };
  try {
    await registry.invoke('medicines.get', intruder, { id: medicine.id });
    console.log('\n!! FAIL: another user could read the medicine');
  } catch (error) {
    console.log(`\nownership enforced: ${(error as Error).name} - ${(error as Error).message}`);
  }

  // Cross-user reference must be rejected, not silently linked.
  try {
    await registry.invoke('medicines.create', intruder, {
      name: 'Sneaky',
      conditionId: condition.id,
    });
    console.log('!! FAIL: linked to another user\'s condition');
  } catch (error) {
    console.log(`cross-user link rejected: ${(error as Error).message}`);
  }

  // Validation must reject bad input the same way for a tool call.
  try {
    await registry.invoke('measurements.record', actor, { type: 'blood_pressure', value: 140 });
    console.log('!! FAIL: accepted blood pressure without diastolic');
  } catch (error) {
    console.log(`domain rule enforced: ${(error as Error).message}`);
  }

  show('medicines.stop', await registry.invoke('medicines.stop', actor, { id: medicine.id, reason: 'course finished' }));

  await connection.db?.dropDatabase();
  console.log('\nsmoke database dropped');
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
