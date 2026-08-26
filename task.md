# Task: a real test suite for the API

The backend works. Almost none of it is tested.

What exists today is `scripts/capability-smoke.ts` — one script, 17 assertions,
run by hand against a live database. It has caught real bugs and should stay,
but it is not a suite: it cannot run in CI, it tests one happy path per
feature, and a failure halfway through skips everything after it.

This task replaces that with a suite. Below is what to build, in what order,
and what each layer is for. Follow it as written; where it says *exactly*
which case to cover, that case exists because the bug it describes has
already happened once in this codebase.

---

## Principles

**1. The security boundary is per-user isolation, so test it everywhere.**
Every collection is scoped by `userId` through `OwnedCrudService.scope()`. One
missing scope leaks a stranger's health record. This is the single most
important thing the suite proves, and it must be proven for *every*
capability, not a sample.

**2. Test through the capability registry, not the controllers.**
`registry.invoke(name, actor, input)` is the one path the REST API, the agent
and any future tool client all share. A test written against it covers all
three. A test written against a controller covers one.

**3. Never call a live model.** Not in unit tests, not in integration, not in
CI. It is slow, non-deterministic, and costs money per run. The agent is
tested with a stubbed model that returns scripted responses. `check-model.mjs`
stays a manual tool for a human choosing a model, and is not part of the
suite.

**4. A test that cannot fail is worse than no test.** For each regression case
below, first confirm it fails with the fix reverted. A green suite that would
stay green through the bug proves nothing, and this has already been a
problem here.

**5. Assert on behaviour, not on wording.** `expect(status).toBe('overdue')`,
never `expect(message).toBe('Blood pressure check')`. Prompts and copy will
change; the rules will not.

---

## Infrastructure to set up first

Nothing below can be written until this is in place.

### Add `mongodb-memory-server` as a dev dependency

Integration tests must not need a database to be running, or CI cannot run
them, and two developers cannot run them at once without clobbering each
other. `mongodb-memory-server` starts a real MongoDB per test run.

It downloads a MongoDB binary on first use. Cache it in CI.

### Three jest projects, not one

`apps/api/package.json` currently has one jest config with `rootDir: src`.
Replace it with three, so the fast ones can run on every save and the slow
ones only when needed:

| project | pattern | database | roughly |
| --- | --- | --- | --- |
| `unit` | `src/**/*.spec.ts` | none | under a second |
| `integration` | `test/integration/**/*.spec.ts` | in-memory | seconds |
| `e2e` | `test/e2e/**/*.e2e-spec.ts` | in-memory | seconds |

Scripts: `test` runs all three, `test:unit` for the inner loop.

### A test module builder

`test/support/test-app.ts` should export a helper that builds the Nest app
against the in-memory database with `ClerkAuthGuard` overridden by a stub
that reads `x-test-user` and puts it on `request.auth`. Every integration and
e2e test uses it. Two actors — call them `alice` and `bob` — should be
available as constants, because most of what needs proving is that one cannot
see the other's data.

### Delete the scaffold tests

`src/app.controller.spec.ts` and `test/app.e2e-spec.ts` test that
`getHello()` returns `'Hello World!'`. They are Nest's template. Remove them
rather than leaving them to imply coverage that does not exist.

---

## Layer 1 — unit tests

Pure functions, no database, no Nest. These are the cheapest tests in the
suite and should stay under a second in total.

### `src/common/dates.spec.ts`

- `addMonths` clamps to a shorter month: 31 Jan + 1 month is 28 Feb, not
  3 March. **This is why the function exists** — the naive version silently
  moves a screening due date into the wrong month.
- `addMonths` crosses a year boundary correctly.
- `yearsSince` returns 45 the day before a 46th birthday and 46 on the day.
  Off-by-one here changes which screenings a person is offered.
- `daysBetween` is negative when the target is in the past.
- `atTimeOfDay` combines a `YYYY-MM-DD` with `HH:MM` in local time.
- `toDateOnly` never shifts a date across a timezone boundary.

### `src/database/serialize.spec.ts`

- `_id` becomes `id`, as a hex string, not an ObjectId.
- Nested ObjectIds convert too.
- `Date` becomes an ISO string.
- `__v` is dropped.
- `undefined` becomes `null`.
- An array of documents converts elementwise.

### `src/database/schemas/fill-defaults-on-read.spec.ts`

Build a throwaway schema with an array field and a defaulted field, apply the
plugin, and assert that a document read back *without* those keys comes out
with them. **Regression:** a profile written before `familyHistory` existed
came back missing the key, and `riskFlags` threw on `.length` of `undefined`.

### `src/modules/prevention/catalogue.spec.ts`

Call the rules directly with hand-built contexts. No database.

- A 20-year-old man gets blood pressure, weight, dental, general check-up —
  and *not* cervical screening or anaemia.
- A 30-year-old woman gets anaemia screening; a 55-year-old woman does not
  (the 15–49 window).
- A woman of 40 gets cervical screening; one of 70 does not (30–65).
- Tobacco use adds oral cancer screening; `former` still does, at a longer
  interval; `never` does not.
- A diabetes condition adds the diabetic eye exam and tightens blood glucose
  to 3 months.
- Family history of diabetes brings blood glucose forward even at 25.
- Every rule's `applies` returns either `null` or a **non-empty string**. The
  string is shown to the user as the reason; an empty one is a silent bug.
- With a null age and null sex — an untouched baseline — nothing throws.

### `src/modules/prevention/prevention.service.spec.ts` (the pure part)

`buildSnapshot` is exported and takes a plain profile, so test it directly:

- BMI uses **Asian-Indian cut-offs**: 23 is `overweight`, not `healthy`.
  A test asserting the international 25 boundary would enshrine the bug this
  was written to avoid.
- BMI is null when height or weight is missing, and does not divide by zero.
- `baselineComplete` is false while any required field is null, true when all
  seven are present.
- Risk flags appear for raised BMI, tobacco, regular alcohol, sedentary
  living, family history and age 45+.

### `src/modules/agent/llm/tool-adapter.spec.ts`

- `toToolName('medicines.create')` is `'medicines__create'`.
- `fromToolName` round-trips every one of the 53 registered capability names
  back to itself. **Regression:** OpenAI rejects `.` in a function name, and
  nothing validates this client-side — a bad mapping fails at the API, mid
  conversation.

### `src/modules/agent/memory/memory-files.store.spec.ts`

- `normalizeMemoryKey` adds a leading slash and collapses duplicates.
- It **throws** on `..`, `~`, and a null byte. The agent chooses these paths
  itself; traversal must be refused here, not trusted.

### `src/modules/agent/run-limiter.service.spec.ts`

- Allows up to the limit, refuses the next.
- `retryInMinutes` is at least 1 and never negative.
- Entries older than the window stop counting (inject a clock or set the
  limit low; do not `setTimeout` for an hour).
- Two users do not share a window.

---

## Layer 2 — integration tests

Real services, real Mongo (in memory), driven through
`registry.invoke`. This is where most of the value is.

### `test/integration/ownership.spec.ts` — the important one

Write this **first**, and write it as a loop over the registry rather than
by hand:

```
for each capability where kind === 'read' and input includes an id:
  alice creates the record
  bob invokes the capability with alice's id
  expect NotFoundError
```

Then the same for writes, and for delete. Add a completeness assertion: the
number of capabilities exercised equals the number registered, minus an
explicit allow-list of ones that take no id. **If someone adds a capability
and forgets to scope it, this test must fail.** That is the whole point.

Also here:

- A cross-user reference is refused: bob creating a medicine with alice's
  `conditionId` gets `InvalidInputError`, not a silently linked record.
- A missing record and someone else's record return the **same** error. A
  different response would confirm another user's id exists.

### `test/integration/medicines.spec.ts`

- Creating a medicine, adding a schedule, then reading the day materialises
  one dose per time in `timesOfDay`.
- Reading the same day twice does not duplicate doses. **Regression:** this
  is what the `{ scheduleId, scheduledFor }` unique index is for.
- A dose whose time passed more than the grace window ago becomes `missed`;
  one inside the window stays `pending`.
- Recording a dose as taken moves it out of the pending set and into the
  adherence numbers.
- `medicines.stop` deactivates schedules, deletes *future pending* doses, and
  **keeps** past ones. Assert the history survives — that is the difference
  between stop and delete.
- `medicines.delete` removes the medicine, its schedules and its doses.
- A schedule ending before it starts is refused.
- Adherence over a window counts taken, missed and skipped, and the rate
  excludes pending.

### `test/integration/prevention.spec.ts`

- The plan for a complete baseline contains the checks the catalogue tests
  predict — this time end to end, with conditions read from the database.
- Completing a check moves it from `due` to `up_to_date` and sets the next
  due date one interval out.
- An overdue check sorts above a due one, which sorts above `due_soon`.
- Changing the profile changes the plan on the **next read**, with no
  migration. Set tobacco to `daily`, read again, assert oral cancer screening
  appeared. The plan is derived, and this proves it.
- A brand-new profile with nothing filled in still returns a plan and
  `baselineComplete: false`, and does not throw.

### `test/integration/measurements.spec.ts`

- Blood pressure without a diastolic value is refused.
- Recording without a unit fills in the type's default.
- Changing a reading's type without a unit updates the unit too — otherwise a
  weight ends up labelled `mmHg`.
- `measurements.trend` computes average, min and max over the window only.

### `test/integration/agent-sessions.spec.ts`

- Creating a session, running nothing, and listing shows it at the top.
- Deleting a session **also clears its checkpoints**. Assert the graph state
  is gone, not just the record. **Regression:** `forgetThread` existed for a
  while and was never called, so deleting a conversation left every message
  on disk.
- Clearing all sessions clears all their checkpoints.
- Bob cannot read, retitle or delete alice's session.

### `test/integration/memory.spec.ts`

- Writing the same key twice replaces rather than duplicates.
- Memory written by alice is invisible to bob, through both the capability
  and the `BaseStore` used by the agent.
- Deleting a key that does not exist is a `NotFoundError`.

---

## Layer 3 — e2e tests

HTTP through the real Nest app. Thin on purpose: the behaviour is already
covered above, so these check the transport.

### `test/e2e/auth.e2e-spec.ts`

- Every route except `GET /api` returns 401 without a token. Enumerate the
  router rather than listing paths by hand, so a new unguarded route fails
  this test.

### `test/e2e/validation.e2e-spec.ts`

- A bad body returns 400 with `issues[]` naming the offending path.
- A malformed id returns 400, not 500.
- A well-formed id that does not exist returns 404.
- `GET /api/capabilities` returns valid JSON Schema for every capability, and
  no two capabilities share a name.

### `test/e2e/agent-stream.e2e-spec.ts`

With the model stubbed:

- `POST /api/agent/run` responds `text/event-stream`.
- The frames parse as JSON and the first is `RUN_STARTED`, the last
  `RUN_FINISHED`.
- A client disconnecting mid-stream releases the per-user run lock, so the
  next request is not refused with `run_in_progress`.
- A second concurrent run for the same user is refused.
- Exceeding the hourly limit returns `RUN_ERROR` with code `rate_limited`.

---

## Layer 4 — agent tests with a stubbed model

The agent's own logic is worth testing; the model's is not.

Stub `ModelFactory` with a fake chat model that returns a scripted sequence of
chunks. Do not mock deepagents or LangGraph — test through them.

### `src/modules/agent/agui/translator.spec.ts`

Feed hand-written LangGraph events and assert the AG-UI events out:

- Text chunks produce one `TEXT_MESSAGE_START`, several
  `TEXT_MESSAGE_CONTENT`, one `TEXT_MESSAGE_END`.
- A tool call arriving **closes the open text message first**.
- Tool argument chunks arrive fragmented and with the id absent on
  continuation chunks; the translator must still attribute them to the open
  call.
- `on_tool_end` emits `TOOL_CALL_RESULT` with the right `toolCallId`.
- `present_file` additionally emits `file.presented` with the parsed path.
- `finish()` closes anything still open when a run is cut short.

### `src/modules/agent/agent.service.spec.ts` — transcript normalisation

Feed hand-built LangChain message arrays into the exported `normalizeTurns`:

- Two consecutive `AIMessage`s become **one** turn, concatenated with no
  separator. **Regression:** one agent turn is routinely several AIMessages —
  one calling a tool with no text, one answering afterwards — and without
  merging, reopening a chat split one reply into bubbles that never appeared
  live.
- A `tool` message folds onto its call as `result`, and does not appear as a
  turn of its own.
- A tool message with `status: 'error'` sets `isError`.
- System messages are dropped.

### HITL shapes

- `pendingApprovals` reads `actionRequests` — camelCase — and returns one
  entry per action with its index. **Regression:** it looked for
  `action_requests` and for a `tool_call_id` that does not exist on an
  action request, so an approval was always reported as none.
- Resuming sends `{ decisions: [{ type: 'approve' }] }`. **Regression:** it
  sent `{ decision: 'accept' }` — wrong key, wrong value, not a list.
- Decisions are positional: two pending actions plus one decision is a
  validation error, not a silent partial approval.

### Titling

- A slow title does not delay `RUN_FINISHED`. Stub a title model that takes
  longer than the grace window and assert the run finishes without it.
  **Regression:** the title was awaited before `RUN_FINISHED`, reintroducing
  exactly the delay that running it in parallel was meant to avoid.
- A title that arrives late still saves.
- A title never overwrites one the user set.

---

## What not to test

- **Mongoose, LangChain or deepagents themselves.** Not our code.
- **Prompt wording.** It will change and the test would just be a copy of it.
- **Exact latency.** Machine-dependent and flaky.
- **The catalogue's clinical correctness.** Tests prove the rules fire as
  written; whether the intervals are right is a question for a clinician, and
  a passing test must not be mistaken for that review having happened.

---

## Definition of done

- [ ] `pnpm --filter api test` runs unit, integration and e2e, needs no
      running database, and passes from a clean checkout.
- [ ] The ownership loop covers every registered capability, and fails when a
      new unscoped one is added.
- [ ] Every regression case above has been confirmed to **fail** with its fix
      reverted.
- [ ] No test calls a live model or needs an API key.
- [ ] CI runs the suite on every push, in the existing workflow, after
      type-check.
- [ ] `capability-smoke.ts` still works — it stays as a manual end-to-end
      check against a real database, which the suite deliberately is not.

## Order to build in

1. Infrastructure, then delete the scaffold tests.
2. `test/integration/ownership.spec.ts`. Highest value in the suite; do it
   before anything else.
3. Layer 1 unit tests. Fast, and they pin the arithmetic everything else
   depends on.
4. Integration for medicines and prevention — the two with real logic.
5. Agent tests with the stub.
6. E2E last: thinnest, and it depends on all the above being stable.
