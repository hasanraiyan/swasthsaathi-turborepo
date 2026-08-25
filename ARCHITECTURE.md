# Architecture

Swasthya Saathi is built so that the product works completely without AI, and
so that an AI agent can later be added as one more caller of the same code
rather than a second implementation of it.

## The shape

```
packages/contracts          Zod schemas, types, capability descriptors
        |                   (the single source of truth)
        v
apps/api
  database/                 Mongoose models, ownership-scoped CRUD
        v
  modules/<domain>/         Services = capabilities. All business logic.
        |                        |
        v                        v
  controllers (REST)      CapabilityRegistry
        |                        |
        v                        v
apps/mobile               future MCP / agent tools
```

The rule that makes this work: **a capability never knows how it was called.**

## Capabilities

A capability is one thing the product can do — `medicines.create`,
`medicationDoses.day`, `conditions.list`. Each has two halves:

**The descriptor** lives in `packages/contracts`. It names the capability,
describes it in plain language, marks it `read` or `write`, and carries a Zod
schema for its input.

```ts
// packages/contracts/src/medicines.ts
export const medicineCapabilities = {
  stop: capability({
    name: 'medicines.stop',
    description:
      'Mark a medicine as stopped from a given date. Its schedules are ' +
      'deactivated but the dose history is kept.',
    kind: 'write',
    input: stopMedicineSchema,
  }),
  // ...
};
```

**The handler** is a method on a domain service in `apps/api`. The service
declares which descriptors it implements:

```ts
// apps/api/src/modules/medicines/medicines.service.ts
capabilities(): CapabilityBinding[] {
  return [
    bindCapability(medicineCapabilities.stop, (actor, input) => this.stop(actor, input)),
    // ...
  ];
}
```

`CapabilityRegistry` finds every service implementing `capabilities()` at
startup (via Nest's `DiscoveryService` — nothing is registered by hand) and
offers two operations over the whole catalogue:

- `describe()` — every capability as a JSON Schema tool definition. This is
  already the exact shape an MCP `tools/list` response needs.
- `invoke(name, actor, input)` — validate against the descriptor's schema, then
  call the handler.

Both are exposed for inspection at `GET /api/capabilities` and
`POST /api/capabilities/:name/invoke`. The mobile app does not use them; they
exist so the capability surface is visible while the product is built, and so
the agent layer has a working reference.

## Three rules that keep the agent path open

**1. Business logic lives in services, never controllers.**
A controller parses, calls one service method, and returns. An agent can call
the service; it cannot call an HTTP handler.

**2. `actor` is always an explicit parameter.**

```ts
async stop(actor: Actor, input: StopMedicineInput): Promise<Medicine>
```

Not `this.request.user`, not `AsyncLocalStorage`. A service that reaches into
request context is uncallable from a job or a tool. `CurrentActor` reads it off
the request in the controller and passes it in.

**3. Errors are domain errors, not HTTP errors.**
Services throw `NotFoundError` / `InvalidInputError` / `ConflictError` from
`common/errors.ts`. `DomainExceptionFilter` maps them to status codes at the
HTTP edge. An agent catches the class directly and never sees a 404.

## Data ownership

Every collection carries `userId`, and `OwnedCrudService.scope()` narrows every
query to the acting user. This is the only thing standing between one person's
health record and another's, so it lives in one place rather than being
re-typed in ten services where a single omission would go unnoticed.

`ReferenceValidator` closes the matching hole on writes: when a client sends a
`conditionId`, it verifies that condition belongs to *them* before the link is
stored. Without it, a user could attach their medicine to a stranger's
condition and read it back through the joined view.

A 404 is returned whether a record is missing or owned by someone else — a
different response would confirm that another user's id exists.

## Medicines, in three parts

The flagship domain is split deliberately:

| Model | Answers | Why separate |
| --- | --- | --- |
| `Medicine` | *What* — the drug, strength, purpose | Survives pausing and restarting |
| `MedicationSchedule` | *When* — times, days, dose | A medicine can have several |
| `MedicationDose` | *Did it happen* | Editing a schedule must not rewrite history |

Doses are **materialised** from schedules the first time a day is opened, not
generated on the fly for display. That's the whole design: a dose the user
never came back for still exists as a row and ages into `missed`, so the
absence of an action is recorded rather than inferred. A unique index on
`{ scheduleId, scheduledFor }` makes re-opening a day idempotent.

`medicines.stop` and `medicines.delete` are different operations on purpose.
Stopping is the everyday action and keeps the dose history — which is what
makes an adherence record worth showing a doctor. Deleting is for a mistaken
entry and takes the history with it.

## Dates

Calendar dates (`startsOn`, `dateOfBirth`, `diagnosedOn`) are stored as
`YYYY-MM-DD` **strings**, not `Date`s, so a date of birth cannot drift across a
timezone boundary. Schedule times are wall-clock `HH:MM` strings, so "8 in the
morning" stays 8 in the morning when the user travels. Only genuine instants
(`scheduledFor`, `measuredAt`, `startedAt`) are stored as dates.

## Adding a capability

1. Add the schemas and a descriptor to `packages/contracts/src/<domain>.ts`.
2. Add the method to the domain service, taking `(actor, input)`.
3. Bind it in that service's `capabilities()`.
4. Add a REST route if the app needs one.

The registry picks it up automatically, and it becomes an agent tool for free
whenever that layer is built.

## What is deliberately not here

- **The AI agent.** By design. The product must work without it.
- **File upload for documents.** `HealthDocument` records metadata and a
  `storageKey`; nothing mints that key yet.
- **Reminders/notifications.** `remindersEnabled` is stored but no scheduler
  reads it.
- **Automated tests.** `pnpm --filter api run smoke` drives the whole capability
  layer against a throwaway database, including the ownership checks, but it is
  a script, not a test suite.
