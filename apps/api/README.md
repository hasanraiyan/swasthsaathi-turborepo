# Swasthya Saathi API

NestJS + MongoDB (Mongoose). Serves the health record twice over: as REST routes
for the mobile app, and as a registry of capabilities that a future AI agent
will call. Both go through the same services — see
[../../ARCHITECTURE.md](../../ARCHITECTURE.md).

## Setup

```sh
cp .env.example .env
```

| Variable | What it's for |
| --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/swasthsaathi`, or an Atlas `mongodb+srv://` string |
| `CLERK_SECRET_KEY` | Verifies the bearer token on every request. Never ship this to the app |
| `CLERK_PUBLISHABLE_KEY` | From the same Clerk dashboard page |
| `PORT` | Defaults to 3000 |

Collections and indexes are created by Mongoose on first write — there is no
migration step.

```sh
pnpm dev          # watch mode on :3000/api
pnpm build
```

## Layout

```
src/
  auth/           Clerk guard, @CurrentActor decorator
  capabilities/   CapabilityRegistry — discovery, JSON Schema, invoke
  common/         Domain errors, HTTP filter, date helpers, validation
  database/       Mongoose schemas, ownership-scoped CRUD, reference checks
  modules/        One folder per domain: service (logic) + controller (transport)
```

## Routes

All under `/api`, all requiring `Authorization: Bearer <clerk-token>` except
`GET /api`.

| Area | Routes |
| --- | --- |
| Profile | `GET/PATCH /profile` |
| Conditions | `GET/POST /conditions`, `GET/PATCH/DELETE /conditions/:id` |
| Doctors | `GET/POST /doctors`, `GET/PATCH/DELETE /doctors/:id` |
| Medicines | `GET/POST /medicines`, `GET/PATCH/DELETE /medicines/:id`, `POST /medicines/:id/stop` |
| Schedules | `GET/POST /medication-schedules`, `PATCH/DELETE /medication-schedules/:id` |
| Doses | `GET /medication-doses`, `GET /medication-doses/day`, `GET /medication-doses/adherence`, `POST /medication-doses/:id/record` |
| Appointments | `GET/POST /appointments`, `GET/PATCH/DELETE /appointments/:id` |
| Symptoms | `GET/POST /symptoms`, `GET/PATCH/DELETE /symptoms/:id` |
| Measurements | `GET/POST /measurements`, `GET /measurements/trend`, `PATCH/DELETE /measurements/:id` |
| Documents | `GET/POST /documents`, `GET/PATCH/DELETE /documents/:id` |
| Capabilities | `GET /capabilities`, `POST /capabilities/:name/invoke` |

## Verifying

```sh
pnpm check-types
pnpm lint

# Boots the app against a throwaway database and drives every step of a
# medicine journey through the capability registry, including the checks that
# one user cannot reach another's records. Drops the database when done, so it
# refuses any URI whose database name doesn't end in "_smoke".
MONGODB_URI=mongodb://127.0.0.1:27017/swasthsaathi_smoke pnpm run smoke
```
