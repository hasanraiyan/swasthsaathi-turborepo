# @repo/sdk

Type-safe TypeScript SDK for the **Swasthya Saathi (स्वास्थ साथी)** API, Health Records Engine, and Persona AI Integration.

## Features

- **Full Type-Safety**: Built directly on `@repo/contracts` with shared Zod schemas.
- **Isomorphic**: Runs seamlessly in Node.js, Next.js, React Native / Expo, and standard browsers.
- **Clerk Authentication**: Accepts a dynamic token getter (`getAuthToken: () => Promise<string>`) to automatically inject fresh Clerk JWT session tokens into requests.
- **Rich Domain Coverage**:
  - `profile`: Demographics, blood group, emergency contacts.
  - `medicines`: Prescriptions, active/stopped courses.
  - `medicationSchedules`: Intake timings and reminders.
  - `medicationDoses`: Daily dose tracking, home screen timeline, and adherence metrics.
  - `appointments`: Scheduled consultations and visits.
  - `conditions`: Diagnosed medical conditions.
  - `doctors`: Care team directory.
  - `documents`: Diagnostic reports and lab tests.
  - `measurements`: Vitals (BP, blood sugar, weight, SpO2, heart rate) and metric trends.
  - `prevention`: Preventive screenings, vaccines, and wellness goals.
  - `symptoms`: Symptom logs and severity tracking.
  - `capabilities`: LLM tool registry inspection and execution.
  - `persona`: AI conversation threads and real-time voice sessions.
- **Clear Error Handling**: Custom `SwasthyaApiError` exposing status codes, validation issues, and friendly `userMessage` text.

---

## Installation

Within the monorepo:

```json
{
  "dependencies": {
    "@repo/sdk": "workspace:*"
  }
}
```

---

## Quick Start

```typescript
import { createSwasthyaClient } from '@repo/sdk';

const client = createSwasthyaClient({
  baseUrl: 'https://api.swasthsaathi.hasanraiyan.me/api',
  getAuthToken: async () => {
    // E.g., from Clerk:
    return await clerk.session?.getToken();
  },
});

// 1. Fetch user health profile
const profile = await client.profile.get();
console.log('Welcome,', profile.fullName);

// 2. Fetch today's medicines and dose checklist
const today = await client.medicationDoses.day();
console.log('Doses due today:', today.due);

// 3. Log a dose as taken
await client.medicationDoses.record('dose_123', {
  status: 'taken',
  takenAt: new Date().toISOString(),
});

// 4. Log vital measurement (e.g. Blood Pressure)
const bp = await client.measurements.record({
  type: 'blood_pressure',
  values: { systolic: 120, diastolic: 80 },
  unit: 'mmHg',
  context: 'resting morning reading',
});

// 5. Connect to SwasthSaathi via Persona AI
const thread = await client.persona.threads.create();
console.log('New thread ID:', thread._id);

// 6. Mint ticket for real-time voice session
const voiceSession = await client.persona.voice.createSession({
  threadId: thread._id,
});
console.log('Connect WebSocket to:', voiceSession.wsUrl);
```

---

## OpenAPI Specification

The OpenAPI 3.0 specification file is exported directly at:
- `packages/sdk/openapi.json`
- `/api/docs` (Interactive Swagger UI)
- `/api/docs-json` (Raw JSON)
- `/api/docs-yaml` (Raw YAML)
