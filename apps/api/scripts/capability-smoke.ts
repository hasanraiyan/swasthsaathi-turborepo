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
import { Types } from 'mongoose';

import { AppModule } from '../src/app.module';
import { CapabilityRegistry } from '../src/capabilities/capability-registry.service';

const actor: Actor = { userId: 'user_smoke_test' };
const today = new Date().toISOString().slice(0, 10);

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

let failures = 0;

function expect(what: string, ok: boolean): void {
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`);
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

  // --- preventive care ----------------------------------------------------
  // A 46-year-old woman who uses tobacco daily, is sedentary, has a raised
  // BMI and diabetes on record: enough to exercise age, sex, body, habit,
  // family-history and condition-driven rules at once.
  await registry.invoke('profile.update', actor, {
    fullName: 'Smoke Test',
    dateOfBirth: '1980-05-10',
    sexAtBirth: 'female',
    heightCm: 158,
    weightKg: 68,
    tobaccoUse: 'daily',
    alcoholUse: 'never',
    activityLevel: 'sedentary',
    familyHistory: ['diabetes', 'heart_disease'],
  });

  const snapshot = (await registry.invoke('prevention.snapshot', actor)) as {
    age: number;
    bmi: number;
    bmiBand: string;
    baselineComplete: boolean;
    riskFlags: { key: string }[];
  };
  show('prevention.snapshot', snapshot);
  expect('baseline is complete', snapshot.baselineComplete === true);
  expect('BMI banded on Asian-Indian cut-offs', snapshot.bmiBand === 'overweight');
  expect(
    'risk flags name tobacco, activity and family history',
    ['tobacco', 'activity', 'family', 'bmi', 'age'].every((key) =>
      snapshot.riskFlags.some((flag) => flag.key === key),
    ),
  );

  const plan = (await registry.invoke('prevention.plan', actor)) as {
    checks: { key: string; status: string; everyMonths: number; appliesBecause: string }[];
    dueCount: number;
  };
  console.log('\n=== prevention.plan ===');
  for (const check of plan.checks) {
    console.log(
      `  ${check.status.padEnd(11)} ${check.key.padEnd(26)} every ${String(check.everyMonths).padStart(2)}mo  (${check.appliesBecause})`,
    );
  }

  const keys = plan.checks.map((check) => check.key);
  expect('sex-specific screening applies', keys.includes('cervical_cancer_screening'));
  expect('anaemia screening applies to a woman of 46', keys.includes('haemoglobin'));
  expect('tobacco drives oral cancer screening', keys.includes('oral_cancer_screening'));
  expect('a condition on record adds its own check', keys.includes('diabetic_eye_exam'));
  expect(
    'diabetes tightens the sugar interval to 3 months',
    plan.checks.find((check) => check.key === 'blood_glucose')?.everyMonths === 3,
  );
  expect('nothing done yet, so everything is due', plan.dueCount === plan.checks.length);

  await registry.invoke('prevention.complete', actor, {
    checkKey: 'blood_pressure',
    note: '128/82',
  });

  const replanned = (await registry.invoke('prevention.plan', actor)) as {
    checks: { key: string; status: string; dueOn: string; lastCompletedOn: string | null }[];
  };
  const bp = replanned.checks.find((check) => check.key === 'blood_pressure');
  show('blood pressure after completing it', bp);
  expect('completing a check moves it off the due list', bp?.status === 'up_to_date');
  expect('and schedules the next one a year out', bp?.dueOn.startsWith(`${new Date().getFullYear() + 1}`) === true);

  // A man gets a different plan from the same engine.
  const man: Actor = { userId: 'user_smoke_male' };
  await registry.invoke('profile.update', man, {
    dateOfBirth: '1995-01-01',
    sexAtBirth: 'male',
    heightCm: 175,
    weightKg: 70,
    tobaccoUse: 'never',
    alcoholUse: 'never',
    activityLevel: 'active',
    familyHistory: [],
  });
  const youngPlan = (await registry.invoke('prevention.plan', man)) as {
    checks: { key: string }[];
  };
  const youngKeys = youngPlan.checks.map((check) => check.key);
  console.log(`\nhealthy 31-year-old man gets: ${youngKeys.join(', ')}`);
  expect('no cervical screening for a man', !youngKeys.includes('cervical_cancer_screening'));
  expect('no tobacco checks for a non-user', !youngKeys.includes('oral_cancer_screening'));
  expect('but still has preventive checks to do', youngKeys.length >= 4);

  // A profile written before the baseline fields existed comes back with
  // those keys missing, not empty -- Mongoose applies defaults on insert and
  // never to documents already in the collection. Inserted through the raw
  // driver so it is exactly the shape every pre-existing user's document has.
  await connection.collection('profiles').insertOne({
    userId: 'user_legacy',
    fullName: 'Written before the baseline existed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const legacy: Actor = { userId: 'user_legacy' };
  const legacyPlan = (await registry.invoke('prevention.plan', legacy)) as {
    checks: unknown[];
    snapshot: { baselineComplete: boolean };
  };
  expect(
    'a profile predating the baseline fields still produces a plan',
    Array.isArray(legacyPlan.checks) && legacyPlan.snapshot.baselineComplete === false,
  );

  const legacyProfile = (await registry.invoke('profile.get', legacy)) as {
    allergies: unknown;
    familyHistory: unknown;
  };
  expect(
    'and comes back with the array fields its contract promises',
    Array.isArray(legacyProfile.allergies) && Array.isArray(legacyProfile.familyHistory),
  );

  // Same hazard on a different collection: a schedule written before
  // `daysOfWeek` existed would break dose materialisation on read.
  const legacyMedicine = (await registry.invoke('medicines.create', legacy, {
    name: 'Legacy tablet',
  })) as { id: string };
  await connection.collection('medication_schedules').insertOne({
    userId: legacy.userId,
    medicineId: new Types.ObjectId(legacyMedicine.id),
    doseAmount: 1,
    doseUnit: 'tablet',
    timesOfDay: ['09:00'],
    startsOn: today,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const legacyDay = (await registry.invoke('medicationDoses.day', legacy)) as {
    doses: unknown[];
  };
  expect(
    'a schedule predating daysOfWeek still materialises its doses',
    legacyDay.doses.length === 1,
  );

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

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
