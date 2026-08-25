# Swasthya Saathi

An AI-powered personal health companion. **The AI is not built yet, and that's
deliberate** — the product works end to end without it, exposing clean reusable
capabilities that will later become agent tools. See [ARCHITECTURE.md](./ARCHITECTURE.md).

> Your doctor treats your condition. Swasthya Saathi helps you manage and stay
> on top of your health journey.

## What's inside

| Package | What it is |
| --- | --- |
| `apps/api` | [NestJS](https://nestjs.com/) + MongoDB (Mongoose). 46 capabilities, 50 REST routes |
| `apps/mobile` | [Expo](https://expo.dev/) / React Native, Expo Router, Clerk auth |
| `packages/contracts` | Zod schemas, shared types, capability descriptors — the source of truth |
| `packages/eslint-config`, `packages/typescript-config` | Shared config |

## Features

- **Medicines** — what you take, why, and its strength; schedules for when;
  a daily dose list with taken/skipped/missed, and a 30-day adherence summary
- **Conditions** — what you're being treated for, linked to the medicines,
  symptoms and documents that go with it
- **Doctors** and **appointments**, including what the doctor said afterwards
- **Symptoms** — episodes with severity, so a pattern builds over time
- **Readings** — blood pressure, blood sugar, weight and other vitals, with trends
- **Documents** — lab reports and prescriptions (metadata; upload not wired yet)
- **Profile** — age, blood group, allergies, emergency contact

## Getting started

```sh
pnpm install
```

### 1. Configure the API

```sh
cp apps/api/.env.example apps/api/.env
```

Fill in:
- `MONGODB_URI` — e.g. `mongodb://127.0.0.1:27017/swasthsaathi`
- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from
  [dashboard.clerk.com](https://dashboard.clerk.com) → API keys

### 2. Configure the mobile app

`apps/mobile/.env.local` needs:

```ini
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

`EXPO_PUBLIC_API_URL` is optional — without it the app talks to port 3000 on
whichever machine is running Metro, which is what you want on a device or
emulator.

**The Clerk secret key must never appear in the mobile app.**

### 3. Run

```sh
pnpm dev                      # api + mobile together
pnpm --filter api dev
pnpm --filter mobile dev
```

The mobile app needs a **development build** (`pnpm --filter mobile android`),
not Expo Go, because of the Clerk and secure-store native modules.

## Checks

```sh
pnpm lint
pnpm check-types
pnpm build

# Drives every capability against a throwaway database, ownership checks included
MONGODB_URI=mongodb://127.0.0.1:27017/swasthsaathi_smoke pnpm --filter api run smoke
```

## Releases

`.github/workflows/mobile-android-release.yml` builds a signed Android APK/AAB
on manual dispatch (Actions → Build Android Release → Run workflow). Signing
activates when `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` are set as repository secrets;
without them the build is unsigned and useful only for testing.
