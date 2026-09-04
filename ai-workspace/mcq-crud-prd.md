Date created: 2026-09-04
Date last modified: 2026-09-04 (production deploy)

# Multiple-Choice Question CRUD - Technical PRD

## Overview/Problem

Sprint 1 gave teachers an identity (register / login / logout) and landed them on a stub
`/mcqs` page that says the question bank is coming later. That stub is where the product
stops being useful: a teacher can log in but cannot author a single question, so the
"shared multiple-choice test bank" has no content and no reason to be revisited. This
sprint replaces the stub with real question-bank behavior — list, create, edit, preview,
and delete multiple-choice questions — and records attempts so a question can be
answered and scored.

Sprint 1's auth contract (`ai-workspace/register-login-logout_prd.md`) stays intact. This
PRD takes its "Out of Scope" item *"Multiple-choice question create / read / update /
delete (next sprint)"* and nothing else from that list.

---

## Hypothesis

We believe that giving teachers a table-driven question bank with create, edit, preview,
and delete on `/mcqs` will turn Quiz Maker from a login demo into a tool that holds real
content, without introducing sessions, roles, or AI generation in this sprint.

---

## Scope

### In Scope

- Three D1 tables via one new migration: `mcqs`, `mcq_choices`, `mcq_attempts`
- `mcqs`: id, name, description, question text, timestamps
- `mcq_choices`: id, FK to `mcqs`, choice text, correct flag, display position, timestamps
- `mcq_attempts`: id, FK to `mcqs`, FK to the selected `mcq_choices` row, nullable user FK,
  correctness, created timestamp
- A question has **at least 2 and at most 6** choices, and **exactly one** correct choice
- `src/lib/services/mcq-service.ts` — the only module that runs MCQ SQL
- HTTP endpoints for list, create, read, update, delete, and record-attempt
- Zod validation in `src/lib/mcq-schemas.ts` before any service call
- `/mcqs` becomes a shadcn `Table` of questions with a per-row actions menu
  (three vertical ellipses → Edit / Preview / Delete) and a Create button
- `/mcqs/new` and `/mcqs/[id]/edit` — one shared form with Save and Cancel
- The form renders 2 choice rows by default and can add up to 6
- `/mcqs/[id]/preview` — answer the question and see correct/incorrect; records an attempt
- Log out stays reachable from `/mcqs`
- Vitest TDD for every phase: RED then GREEN
- **Each phase ends with its own commit and push** (see Version Control Workflow)

### Out of Scope

- Quizzes / tests that group many questions
- Sessions, tokens, cookies, or a protected-route gate (still Sprint 1's boundary)
- Question ownership enforcement — any logged-in teacher can edit any question
- Roles (admin vs teacher), sharing rules, or per-teacher filtering
- AI-generated questions or TEKS alignment
- Images, rich text, code blocks, or LaTeX in questions and choices
- Multi-select ("choose all that apply"), true/false, or free-text question types
- Attempt history UI, analytics, scoring dashboards, or leaderboards
- Pagination, sorting, or search on the question list
- Reordering choices by drag and drop
- Soft delete, archive, or undo

### Cut

- **Cascade-only deletes** — D1 foreign-key enforcement depends on PRAGMA state, so the
  service deletes children explicitly in a batch instead of trusting `ON DELETE CASCADE`
- **A separate `is_correct` answer table** — a boolean on `mcq_choices` is enough for one
  correct answer, and a second table would need the same single-correct guard anyway
- **`react-hook-form`** — Sprint 1 built forms on shadcn `field` with plain state; adding
  a form library here would fork the convention for no gain. `.cursor/rules/shadcn.mdc`
  also says ask first
- **Storing the correct answer in the client bundle for preview** — preview posts the
  choice to the server and the server decides correctness, so the answer key is not
  shipped to the browser
- **Editing choices through their own endpoints** — choices are always saved with their
  parent question, so `PUT /api/mcqs/[id]` replaces the choice set in one transaction
- **`first()` for lookups** — `.cursor/rules/d1.mdc` requires `all()` + `results[0]`

---

## Decisions taken without explicit confirmation

These were defaulted so work could start. Each is cheap to reverse; flagging them here
rather than burying them in code.

| # | Ambiguity | Decision | Reversal cost |
|---|---|---|---|
| 1 | Sprint 1 was never merged to `main` | Branched `feature/mcq-crud` off `origin/feature/register-login-logout` so Sprint 1 code is present. `main` still holds only the starter commit | Low — rebase onto `main` after Sprint 1 merges |
| 2 | The MCQ table was specified as id / name / description only, with no field for the prompt a student reads | Added `question_text NOT NULL`. `name` is a short title for the list, `description` is optional teacher notes | Low — drop the column in a follow-up migration |
| 3 | Attempts should record who attempted, but no session exists to identify the user | `user_id` is nullable and written as `NULL` this sprint. Column and FK exist so sessions can populate it later | None — additive |
| 4 | Single vs multiple correct answers | Exactly one correct choice, enforced in Zod and in the service. Implied by "the choice the user selected" being singular | Medium — attempts and preview assume one selection |
| 5 | A stashed `package-lock.json` edit on `main` blocked the branch checkout | Stashed, not discarded: `stash@{0}` "main package-lock.json before mcq-crud branch" | None — `git stash pop` on `main` |

---

## Version Control Workflow

**Every phase is committed and pushed on its own.** A phase is not done until its commit
is on `origin/feature/mcq-crud`.

Branch: `feature/mcq-crud`, tracking `origin/feature/mcq-crud`, based on
`origin/feature/register-login-logout` (Sprint 1, still unmerged).

Per phase, in order:

1. Write the failing tests, run them, confirm **RED** for the intended reason
2. Implement until **GREEN**
3. `npm test` — the whole suite, not just the new file
4. Update this PRD: phase status marker, acceptance criteria, and any troubleshooting entry
5. Stage the phase's files and commit
6. `git push`

```bash
npm test
git add <phase files> ai-workspace/mcq-crud-prd.md
git commit -m "<phase message>"
git push
```

Rules:

- One phase per commit. Do not batch two phases into one commit
- Never commit with a failing suite. If a phase cannot go green, stop and report instead
  of committing broken work or deleting the test
- Commit message says what the phase delivered, not which files moved
- The PRD status update ships **in the same commit** as the phase, so history and document
  never disagree
- `git push` only. Never force-push, and never push to `main`
- `npm run lint` and `npm run build` run in Phase 5; a phase commit does not require them
- Generated files stay out of deliberate staging: `package-lock.json` only when a
  dependency actually changed, never `cloudflare-env.d.ts` or `next-env.d.ts` by hand

Planned commits:

| Phase | Commit message |
|---|---|
| 0 | Add the MCQ CRUD technical PRD for sprint 2. |
| 1 | Add the MCQ, choices, and attempts D1 schema. |
| 2 | Add an MCQ service that persists questions with their choices. |
| 3 | Add MCQ CRUD and attempt HTTP endpoints. |
| 4 | Replace the MCQ stub with a question bank table, editor, and preview. |
| 5 | Close MCQ CRUD verification and refresh the PRD. |

---

## Testing Approach (TDD with Vitest)

Already installed from Sprint 1. Harness: `vitest.config.ts` — jsdom, `globals: true`,
`@vitejs/plugin-react`, `vite-tsconfig-paths` for `@/`. Follow
`.cursor/skills/testing/SKILL.md`.

```bash
npm test          # vitest run
npm run test:watch
```

Baseline entering this sprint: **10 files / 32 tests passing.**

### Service tests run real SQL (change from Sprint 1)

Sprint 1 tested `user-service` against a hand-written in-memory D1 that parsed SQL with
regexes. That works for single-table CRUD but does not scale to this sprint, which needs a
`LEFT JOIN`, `GROUP BY`, `COUNT(*)`, `ORDER BY position`, and `batch()`. A hand-written
parser can report success while the production SQL is wrong, because the parser and SQLite
disagree — the test then proves nothing.

Instead, `src/test-support/memory-d1.ts` is a thin D1-shaped facade over the **built-in**
`node:sqlite` module, seeded by executing the real files in `migrations/`. Service tests
mock `@/lib/db` and hand back one of these, so the service runs its actual SQL against a
real SQLite engine with `PRAGMA foreign_keys = ON`.

- This is **not** a new npm dependency. `node:sqlite` ships with Node (runtime here is
  v24.20.0, where it is stable) and is typed by the pinned `@types/node`
- This is **not** the Workers runtime and does not pretend to be. It stands in for the D1
  binding only. Real Workers behavior would need `@cloudflare/vitest-pool-workers`, which
  Sprint 1 cut and this sprint also declines
- The facade rejects any bound value D1 itself would reject, so a service binding a boolean
  or an object fails in tests rather than passing and breaking in production
- Test support lives in `src/test-support/` and must never be imported by application code

Sprint 1's `user-service.test.ts` keeps its original fake. It is green and rewriting it is
not this sprint's job.

Rules carried forward:

- RED first, and the RED must fail for the reason the test targets
- Mock `@/lib/db` when the subject is the service; mock `@/lib/services/mcq-service` when
  the subject is a route handler. Never touch the real Cloudflare D1 binding in a unit test
- `vi.clearAllMocks()` in `beforeEach`; every test passes alone
- Query UI by role and accessible name; drive it with `userEvent`
- Do not render Server Components in Testing Library
- No hollow tests. Cover the failure paths: fewer than 2 choices, more than 6, zero
  correct, two correct, missing question, and a choice that belongs to another question

---

## Technical Requirements

### Database Schema

Cloudflare D1 (SQLite), binding `DB`, database `quizmaker`. New migration
`migrations/0002_create_mcqs.sql`, applied `--local` only.

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  question_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs (id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs (id) ON DELETE CASCADE,
  choice_id TEXT NOT NULL REFERENCES mcq_choices (id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);
CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
```

Notes:

- `is_correct` is SQLite `INTEGER` 0/1; the service maps it to a TypeScript `boolean`
- `position` is 0-based and defines choice display order, so editing does not reshuffle
- `user_id` is nullable on purpose — see decision 3
- Like Sprint 1, the service generates `id` with `crypto.randomUUID()` and sets timestamps
  in JS rather than relying on the column defaults
- Constraints that SQLite cannot express (2–6 choices, exactly one correct) are enforced in
  Zod **and** re-checked in the service, because the service is also callable from tests

```bash
npx wrangler d1 migrations create quizmaker create_mcqs
npx wrangler d1 migrations apply quizmaker --local
# --remote only if the user explicitly asks
```

### API Endpoints

JSON in, JSON out. Handlers validate with Zod, then call the service. **No handler imports
`getDb` or writes SQL** — the Sprint 1 rule holds.

`name` 1–120 chars, `questionText` 1–1000, `description` 0–500 (nullable), `choiceText`
1–300. Ids are validated only as non-empty strings, not as UUIDs: the service issues
`crypto.randomUUID()` values, but a format check would turn "unknown id" into a 400 when
404 is the honest answer.

Validation errors return the first Zod issue message, so the form can show something
specific ("Exactly one choice must be marked correct") rather than a generic failure.

#### GET /api/mcqs — `src/app/api/mcqs/route.ts`

Lists questions for the table. Choices are not included; the list only needs a count.

- 200: `{ "mcqs": [{ "id", "name", "description", "questionText", "choiceCount", "createdAt", "updatedAt" }] }`
- 500: `{ "error": "Server error" }`

#### POST /api/mcqs — `src/app/api/mcqs/route.ts`

**Request Body:**

```json
{
  "name": "Photosynthesis basics",
  "description": "Unit 3 warm-up",
  "questionText": "Which gas do plants absorb during photosynthesis?",
  "choices": [
    { "choiceText": "Carbon dioxide", "isCorrect": true },
    { "choiceText": "Oxygen", "isCorrect": false }
  ]
}
```

- 201: `{ "mcq": <McqWithChoices> }`
- 400: validation failed — fewer than 2 choices, more than 6, not exactly one `isCorrect`,
  blank `name` / `questionText` / `choiceText`
- 500: unexpected error (logged server-side)

Choice `position` is assigned from array order; the client does not send it.

#### GET /api/mcqs/[id] — `src/app/api/mcqs/[id]/route.ts`

- 200: `{ "mcq": <McqWithChoices> }` — choices ordered by `position`
- 404: `{ "error": "Question not found" }`

For preview, `isCorrect` is **not** stripped from this response, because `/mcqs/[id]/edit`
needs it. The preview page therefore does not call this endpoint for grading — it posts the
selection and lets the server decide. See Cut.

#### PUT /api/mcqs/[id] — `src/app/api/mcqs/[id]/route.ts`

Same body as POST. Replaces the choice set wholesale: existing choices are deleted and
re-inserted from the payload in one `db.batch()`.

- 200: `{ "mcq": <McqWithChoices> }`
- 400: validation failed
- 404: `{ "error": "Question not found" }`

Replacing choices deletes their attempts too, since `mcq_attempts.choice_id` would
otherwise dangle. This is called out in Risks.

#### DELETE /api/mcqs/[id] — `src/app/api/mcqs/[id]/route.ts`

- 200: `{ "ok": true }`
- 404: `{ "error": "Question not found" }`

Deletes attempts, then choices, then the question, in one batch.

#### POST /api/mcqs/[id]/attempts — `src/app/api/mcqs/[id]/attempts/route.ts`

**Request Body:**

```json
{ "choiceId": "0f9c..." }
```

- 201: `{ "attempt": { "id", "mcqId", "choiceId", "isCorrect", "createdAt" }, "correctChoiceId": "..." }`
- 400: `choiceId` missing or malformed
- 404: `{ "error": "Question not found" }`, or `{ "error": "Choice does not belong to this question" }`
  when `choiceId` exists but under a different `mcq_id`

The server reads `is_correct` from the stored choice. A client cannot report its own score.
`user_id` is written as `NULL` this sprint.

### User Interface Requirements

shadcn on Base UI, `base-nova`, Tailwind theme tokens only — no hard-coded colors.
`/mcqs` keeps the Sprint 1 page shell so the sprint does not silently restyle the app.

Components added (source files, not npm packages):

```bash
npx shadcn@latest add '@shadcn/dropdown-menu' '@shadcn/textarea' '@shadcn/radio-group'
```

`alert-dialog` was planned but **not** installed — see Phase 4 deviation 1. The delete
confirmation uses the existing `dialog`.

Already installed and reused: `badge` `button` `card` `dialog` `field` `input` `label`
`separator` `table`

#### Question bank (`/mcqs`)

- Heading, plus a **Create question** button → `/mcqs/new`
- shadcn `Table`: columns **Name**, **Description**, **Choices**, **Created**, **Actions**
- `Description` renders `—` when null; long values truncate rather than wrap the row
- `Actions` is a `DropdownMenu` triggered by an icon button showing `MoreVertical`
  (three vertical ellipses), with an accessible name of `Open actions` so tests and
  screen readers can find it. Items: **Edit**, **Preview**, **Delete**
- Delete opens an `AlertDialog` confirm; it does not delete on the first click
- Empty state: a row explaining the bank is empty, with the Create button still available
- **Log out** remains on this page, unchanged from Sprint 1

#### Create / edit question (`/mcqs/new`, `/mcqs/[id]/edit`)

One `McqForm` component for both routes; `/mcqs/[id]/edit` seeds it from `GET /api/mcqs/[id]`.

- Fields: `name` (Input), `description` (Textarea, optional), `questionText` (Textarea)
- Choices: **2 rows shown by default**, **6 maximum**
  - Each row: choice text Input + a `RadioGroup` radio marking it correct + Remove
  - **Add choice** is disabled at 6; **Remove** is hidden or disabled at 2
  - Exactly one radio can be selected, which is how "exactly one correct" is enforced in
    the UI
- **Save** → POST (new) or PUT (edit), then navigate to `/mcqs`
- **Cancel** → back to `/mcqs` without saving
- Validation errors surface through `FieldError`; the form stays put and does not navigate
- Save is disabled while the request is in flight

#### Preview question (`/mcqs/[id]/preview`)

- Shows `name`, `questionText`, and the choices as a `RadioGroup` in `position` order
- **Submit answer** → `POST /api/mcqs/[id]/attempts`, which records the attempt
- Result shows correct or incorrect, and identifies the correct choice from the response
- **Back to questions** → `/mcqs`
- The correct answer is never rendered before submission

---

## Implementation Phases

### Phase 0: PRD - COMPLETED

**Objective**: Record this document and the phase-wise commit convention.

**Tasks**:
1. Branch `feature/mcq-crud` off Sprint 1 and push it
2. Confirm the inherited suite is green (10 files / 32 tests)
3. Confirm `dropdown-menu`, `textarea`, `radio-group`, `alert-dialog` exist in the registry
4. Write `ai-workspace/mcq-crud-prd.md`

**Deliverables**: this file; branch published; baseline recorded.

**Commit**: `Add the MCQ CRUD technical PRD for sprint 2.`

---

### Phase 1: Database foundation - COMPLETED

**Objective**: Three tables exist locally, with the shape later phases rely on.

**Tasks**:
1. RED — `src/lib/db/mcqs-schema.test.ts` asserts, by reading
   `migrations/0002_create_mcqs.sql`, that all three tables, both FKs to `mcqs`, the
   nullable `user_id`, and the indexes are declared. Fails first because the file is absent
2. GREEN — create the migration via `wrangler d1 migrations create`
3. `npx wrangler d1 migrations apply quizmaker --local`
4. `npm run cf-typegen` if the binding surface changed

**Deliverables**: `migrations/0002_create_mcqs.sql`, `src/lib/db/mcqs-schema.test.ts`.

**Commit**: `Add the MCQ, choices, and attempts D1 schema.`

**Result (2026-09-04):**

| Step | Outcome |
|---|---|
| RED | 9 tests failed with `No MCQ migration found in migrations/` — the intended reason |
| GREEN | `migrations/0002_create_mcqs.sql` written; the 9 tests pass |
| Local apply | `migrations apply quizmaker --local` — 0001 and 0002 both ✅ |
| Tables verified | `sqlite_master` lists `mcqs`, `mcq_choices`, `mcq_attempts`, `users` |
| Full suite | **41 passed / 11 files**, up from the 32 / 10 baseline |

`cf-typegen` was not needed: no `wrangler.jsonc` binding changed, only the schema behind
the existing `DB` binding. The remote database was **not** touched.

---

### Phase 2: MCQ service - COMPLETED

**Objective**: One module owns every MCQ SQL statement.

**Tasks**:
1. RED — `src/lib/services/mcq-service.test.ts` against a mocked `@/lib/db`, covering
   create with choices, list with `choiceCount`, get-with-choices ordered by `position`,
   update replacing choices, delete cascading in a batch, record-attempt deriving
   correctness server-side, and the guard rejecting a `choiceId` from another question
2. GREEN — `src/lib/services/mcq-service.ts` exporting `Mcq`, `McqChoice`,
   `McqWithChoices`, `McqListItem`, `McqAttempt`, `McqNotFoundError`,
   `ChoiceNotInMcqError`, `InvalidChoiceSetError`
3. Numbered placeholders only; `all()` + `results[0]`; `db.batch()` for multi-statement writes

**Deliverables**: service + tests.

**Commit**: `Add an MCQ service that persists questions with their choices.`

**Result (2026-09-04):**

| Step | Outcome |
|---|---|
| RED | `Failed to resolve import "@/lib/services/mcq-service"` — the intended reason |
| GREEN | 28 service tests pass against real SQLite running the real migrations |
| Full suite | **69 passed / 12 files** (was 41 / 11 after Phase 1) |
| `npm run lint` | passed (exit 0) |

Two corrections made during the phase, both worth knowing:

1. The first draft of the facade only supported `prepare().bind().all()`. Real D1 also
   allows `prepare().all()` with no parameters, which `listMcqs` uses. Three tests failed;
   the **facade** was wrong, not the service, so the facade was fixed.
2. An ambient `node:sqlite` declaration was added and then deleted: the pinned
   `@types/node` already ships `node_modules/@types/node/sqlite.d.ts`. The real types are
   stricter (`SQLInputValue`), which is what produced the bound-value guard described above.

**Inherited, pre-existing:** `npx tsc --noEmit` reports 10 errors in Sprint 1's
`src/app/api/auth/{login,logout,register}/route.test.ts` (untyped `await response.json()`
and a `POST(request)` called with an argument). They arrived with the branch, are untouched
by this sprint, and are logged in Troubleshooting. Phase 5 must confirm whether
`npm run build` tolerates them.

---

### Phase 3: HTTP endpoints - COMPLETED

**Objective**: The six routes above, validated and mapped to correct status codes.

**Tasks**:
1. RED — route tests mocking `@/lib/services/mcq-service`, asserting 200/201 bodies, 400 on
   each validation failure, 404 for a missing question and for a foreign `choiceId`, and
   500 on an unexpected throw
2. GREEN — `src/lib/mcq-schemas.ts` (Zod, including the 2–6 and exactly-one-correct refinements)
   and the three route files
3. Confirm no handler imports `getDb`

**Deliverables**: `src/lib/mcq-schemas.ts`, `src/app/api/mcqs/route.ts`,
`src/app/api/mcqs/[id]/route.ts`, `src/app/api/mcqs/[id]/attempts/route.ts`, plus tests.

**Commit**: `Add MCQ CRUD and attempt HTTP endpoints.`

**Result (2026-09-04):**

| Step | Outcome |
|---|---|
| RED | `Failed to resolve import "./route"` for all three route files — the intended reason |
| GREEN | 31 route tests pass across the three files |
| Full suite | **100 passed / 15 files** (was 69 / 12 after Phase 2) |
| `npm run lint` | passed (exit 0) |
| Typecheck | no errors in this sprint's files |
| Service boundary | every route test asserts `getDb` was never called |

`readJson` was extracted to `src/lib/read-json.ts` rather than copied a third time. Sprint 1
has its own inline copies in the auth routes; those were left alone.

Attempts deliberately drop two fields a client might send. `isCorrect` is ignored because
correctness is read from storage, and `userId` is ignored because there is no session to
verify it against. Both have a test asserting the field never reaches the service.

---

### Phase 4: Frontend - COMPLETED

**Objective**: `/mcqs` becomes the question bank; the stub is gone.

**Tasks**:
1. Add the four shadcn components
2. RED — tests for `McqTable` (rows render, ellipsis menu opens, Edit/Preview/Delete
   present, delete confirms before calling the API), `McqForm` (2 rows by default, cannot
   exceed 6, cannot drop below 2, posts the expected body, surfaces a 400), and
   `McqPreview` (answer key hidden pre-submit, posts the choice, renders the verdict)
3. GREEN — `src/components/mcq-table.tsx`, `mcq-form.tsx`, `mcq-preview.tsx`; routes
   `/mcqs`, `/mcqs/new`, `/mcqs/[id]/edit`, `/mcqs/[id]/preview`
4. Delete `McqStub` and `src/components/mcq-stub.test.tsx`; keep Log out on `/mcqs`

**Deliverables**: components, four routes, tests; stub removed.

**Commit**: `Replace the MCQ stub with a question bank table, editor, and preview.`

**Result (2026-09-04):**

| Step | Outcome |
|---|---|
| RED | `Failed to resolve import` for each of `mcq-table`, `mcq-form`, `mcq-preview`, `mcq-bank` |
| GREEN | 31 component tests: table 9, form 9, preview 7, bank 6 |
| Full suite | **129 passed / 18 files** (was 100 / 15 after Phase 3) |
| `npm run lint` | passed (exit 0) |
| `npm run build` | passed — `/mcqs`, `/mcqs/new`, `/mcqs/[id]/edit`, `/mcqs/[id]/preview`, `/api/mcqs*` all present |
| Stub | `McqStub` and its test deleted; Log out preserved in `McqBank` |

#### Deviations from the plan, and why

1. **`alert-dialog` was not installed.** The `shadcn add` run stalled on an interactive
   "`button.tsx` already exists, overwrite?" prompt that `--yes` does not cover. Overwriting
   `button.tsx` would have rewritten a design-system file Sprint 1's forms depend on, so the
   process was stopped. The delete confirmation uses the **already-installed `dialog`**
   instead. `AlertDialog` is the more semantic choice for a confirm and can be swapped in
   later; `Dialog` is functionally equivalent here and cost nothing.
2. **shadcn 4.21.0 generated a broken import.** The three components it did write came out
   with `import { cn } from "cn"` and it added a real npm package named `cn` to
   `package.json`, even though `components.json` correctly aliases `"utils": "@/lib/utils"`.
   The imports were repointed at `@/lib/utils` and the `cn` package was uninstalled, so
   `package.json` is byte-identical to before. **This was a CLI bug, not a deliberate
   dependency choice** — no new runtime dependency was added this sprint.
3. **A fourth component, `McqBank`, was added.** The plan listed three. Pages are Server
   Components that read through the service directly, which is what
   `.cursor/rules/nextjs.mdc` asks for, so something client-side had to own the Create
   button, the delete request, `router.refresh()`, and Log out. `McqTable` stayed
   presentational, which is why it takes an `onDelete` callback.
4. **The preview page strips `isCorrect` server-side.** `GET /api/mcqs/[id]` still returns it
   because the editor needs it, but the preview page maps choices down to `{ id, choiceText }`
   before rendering, so the answer key is not in the browser payload at all.
5. **A duplicated accessible name was found and fixed.** Wrapping `RadioGroupItem` in a
   `FieldLabel` *and* giving it an `aria-label` produced the name
   `"Carbon dioxide Carbon dioxide"`, because Base UI also wires `aria-labelledby`. The
   redundant `aria-label` was removed. The form's radios keep theirs, since they are not
   wrapped in a label.

---

### Phase 5: Verification - COMPLETED

**Objective**: Suite, lint, and build all pass, and the document matches reality.

**Tasks**:
1. `npm test`, `npm run lint`, `npm run build` — record actual output
2. Walk the happy path on `npm run dev`: create → list → edit → preview → delete
3. Tick acceptance criteria; fill in Success Metrics; add troubleshooting entries
4. Report the remote-migration and deploy decisions as the user's call, and do neither

**RED is not required for Phase 5.**

**Commit**: `Close MCQ CRUD verification and refresh the PRD.`

**Result (2026-09-04):**

| Check | Result |
|---|---|
| `npm test` | **129 passed / 18 files**, exit 0 |
| `npm run lint` | passed, exit 0 |
| `npm run build` | passed, exit 0; all 4 pages and 3 API routes emitted |
| `npx tsc --noEmit` | no errors in this sprint's files; 10 inherited auth-test errors remain |
| Service boundary | `getDb` appears only in `src/lib/db.ts`, the two services, and test mocks |

#### End-to-end run against the real local D1

Driven through the running dev server, not mocks, so this exercised the real SQL, the real
binding, and the real route handlers. Every row created was deleted afterwards, and
`SELECT COUNT(*)` on all three tables returned 0 at the end.

| # | Check | Result |
|---|---|---|
| 1 | Create with 2 choices | 201, positions `0,1`, correct flags `True,False` |
| 2 | List | row present, `choiceCount` 2 — the `LEFT JOIN` + `GROUP BY` works on real D1 |
| 3 | Get by id | 200, choices in order |
| 4 | Attempt on the wrong choice | `isCorrect` False, `userId` null, `correctChoiceId` matches |
| 5 | Attempt sending `isCorrect: true` on a wrong choice | still False — the claim is ignored |
| 6 | Update to 3 choices, null description | `createdAt` preserved, `updatedAt` changed |
| 7 | Delete | `ok: true` |
| 8 | Get / delete a deleted question | 404 / 404 |
| 9 | Create with 1 choice / 7 choices / two correct / zero correct | 400 on all four |
| 10 | Attempt naming a foreign choice | 404 |
| 11 | `/mcqs` and `/mcqs/new` | 200 |
| 12 | Preview page HTML | renders both choices, contains **no** `isCorrect` — the answer key is not shipped |
| 13 | Edit page HTML | contains `isCorrect`, which the editor legitimately needs |
| 14 | All three tables after cleanup | 0 rows each; delete removed choices and attempts |

**Not verified by me:** the browser click-through. The endpoints, page renders, and
component behavior are covered, but nobody has driven the real UI with a mouse. Worth ten
minutes before this is called done.

**One environment fix was needed.** The dev server that was already running had been started
while the repo was on `main`, whose `wrangler.jsonc` has no D1 binding, so every write failed
with `D1 binding DB is not available`. Restarting `npm run dev` on this branch fixed it. This
is the inherited Sprint 1 trap, now confirmed to bite on branch switches too.

---

## Technical Implementation Details

### Key Files

| Path | Purpose |
|---|---|
| `migrations/0002_create_mcqs.sql` | The three tables and their indexes |
| `src/lib/db.ts` | Existing `getDb()`; unchanged |
| `src/lib/services/mcq-service.ts` | All MCQ SQL; exports `MIN_CHOICES` / `MAX_CHOICES` |
| `src/test-support/memory-d1.ts` | Test-only D1 facade over `node:sqlite`; never import from app code |
| `src/lib/mcq-schemas.ts` | Zod bodies for create, update, and attempt |
| `src/lib/read-json.ts` | Shared body parser that turns malformed JSON into a 400, not a 500 |
| `src/app/api/mcqs/route.ts` | `GET` list, `POST` create |
| `src/app/api/mcqs/[id]/route.ts` | `GET`, `PUT`, `DELETE` |
| `src/app/api/mcqs/[id]/attempts/route.ts` | `POST` attempt |
| `src/components/mcq-bank.tsx` | Client shell: create, delete, refresh, log out |
| `src/components/mcq-table.tsx` | Presentational table, ellipsis menu, delete confirm |
| `src/components/mcq-form.tsx` | Shared create/edit form |
| `src/components/mcq-preview.tsx` | Answer and grade |
| `src/app/mcqs/page.tsx` | Question bank (replaces the stub); Server Component |
| `wrangler.jsonc` | Worker `quizmaker`, D1 `DB`, OpenNext `ASSETS` + `WORKER_SELF_REFERENCE` |
| `src/app/mcqs/new/page.tsx` | Create |
| `src/app/mcqs/[id]/edit/page.tsx` | Edit |
| `src/app/mcqs/[id]/preview/page.tsx` | Preview |

### Implementation Patterns

**Multi-statement writes go through `db.batch()`**, so a half-saved question cannot
survive a mid-write failure:

```ts
const db = await getDb();
await db.batch([
  db.prepare("DELETE FROM mcq_attempts WHERE mcq_id = ?1").bind(id),
  db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id),
  db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id),
]);
```

Children are deleted explicitly rather than relying on `ON DELETE CASCADE`; see Cut.

**Correctness is decided by the server**, never accepted from the client:

```ts
const choice = await findChoiceInMcq(mcqId, choiceId);
if (!choice) throw new ChoiceNotInMcqError();
const isCorrect = choice.isCorrect;
```

**SQLite integers map to booleans at the service boundary**, so nothing above the service
sees a `0` or `1`:

```ts
function toChoice(row: McqChoiceRow): McqChoice {
  return {
    id: row.id,
    mcqId: row.mcq_id,
    choiceText: row.choice_text,
    isCorrect: row.is_correct === 1,
    position: row.position,
  };
}
```

**The choice-set rule lives in Zod and is re-checked in the service:**

```ts
export const choiceSetSchema = z
  .array(choiceInputSchema)
  .min(2, "A question needs at least 2 choices")
  .max(6, "A question can have at most 6 choices")
  .refine(
    (choices) => choices.filter((choice) => choice.isCorrect).length === 1,
    "Exactly one choice must be marked correct",
  );
```

**Lookups follow Sprint 1**: numbered placeholders, `all()` then `results[0]`, one
`findRowBy`-style helper rather than inline SQL at each call site.

### Important Notes

- Run npm and wrangler from the repo root (`quiz-maker/`)
- `/mcqs` is still **not** route-protected; there is no session. Anyone reaching the URL can
  edit the bank. That is Sprint 1's accepted boundary, not a bug to fix here
- Never import `getDb` or `mcq-service` into a `'use client'` component
- Migrations are `--local` by default. `--remote` and `npm run deploy` only when asked.
  Both were explicitly requested on 2026-09-04 and have been done (see Deployment)
- `position` is assigned from array order on save; the UI never sends it
- The four shadcn components are copied source files. Ask before adding a real npm dependency
- Restart `npm run dev` after any `wrangler.jsonc` change

---

## Acceptance Criteria

- [x] `migrations/0002_create_mcqs.sql` creates `mcqs`, `mcq_choices`, `mcq_attempts` and applies locally
- [x] `mcq_choices.mcq_id` and `mcq_attempts.mcq_id` are foreign keys to `mcqs (id)`
- [x] `mcq_attempts.choice_id` is a foreign key to `mcq_choices (id)`
- [x] `mcq_attempts.user_id` is nullable and accepts `NULL`
- [x] A question saves with 2 choices and with 6 choices
- [x] A question with 1 choice is rejected with 400
- [x] A question with 7 choices is rejected with 400
- [x] A question with zero or two correct choices is rejected with 400
- [x] `GET /api/mcqs` returns every question with a `choiceCount`
- [x] `GET /api/mcqs/[id]` returns choices ordered by `position`
- [x] `PUT /api/mcqs/[id]` replaces the choice set and bumps `updated_at`
- [x] `DELETE /api/mcqs/[id]` removes the question, its choices, and its attempts
- [x] Any endpoint returns 404 for an unknown question id
- [x] `POST /api/mcqs/[id]/attempts` stores the selected choice and server-derived correctness
- [x] An attempt naming a choice from another question is rejected with 404
- [x] Route handlers reach D1 only through `mcq-service`
- [x] `/mcqs` lists questions in a shadcn `Table` with name, description, and an actions column
- [x] The actions column is a three-vertical-ellipses menu offering Edit, Preview, and Delete
- [x] Delete asks for confirmation before it calls the API
- [x] The Create button opens `/mcqs/new`
- [x] The form shows 2 choice rows by default and allows up to 6
- [x] Save persists and returns to `/mcqs`; Cancel returns without saving
- [x] Edit loads the existing question and its choices
- [x] Preview records an attempt and reports correct or incorrect
- [x] Preview does not reveal the correct answer before submission
- [x] Log out still works from `/mcqs`
- [x] Sessions, tokens, cookies, and social login were not introduced
- [x] Phases 1–4 were test-first (RED then GREEN)
- [x] Each phase was committed and pushed separately
- [x] `npm test` is green and exceeds the 32-test baseline (129 vs 32)
- [x] `npm run lint` and `npm run build` pass

---

## Success Metrics

| Metric | Target | How Measured | Status |
|--------|--------|--------------|--------|
| Unit tests | Green, above the 32-test baseline | `npm test` | **Met** — 129 / 18 files |
| CRUD happy path | Create → list → edit → preview → delete with no error | Live API run on `npm run dev` | **Met** — all 14 checks passed |
| Answer key never shipped early | Correct choice absent from preview markup pre-submit | `McqPreview` test + live page HTML | **Met** — no `isCorrect` in preview HTML |
| Choice-set rule | 1, 7, zero-correct, and two-correct all rejected | Schema + route tests + live 400s | **Met** |
| Service boundary | No `getDb` import outside `src/lib/` | Grep during Phase 5 | **Met** |
| Phase discipline | 6 commits, one per phase, each pushed | `git log --oneline origin/feature/mcq-crud` | **Met** |
| Browser click-through | A human drives the real UI | Manual | **Not done** — needs the user |

---

## Dependencies

### External

- Cloudflare D1 `quizmaker` — `fd33905f-6013-476c-974a-79dbc6fed47a`
- Wrangler 4 — migrations and config
- Vitest 3 + Testing Library + jsdom + `vite-tsconfig-paths` + `@vitejs/plugin-react@4`
- shadcn registry — `dropdown-menu`, `textarea`, `radio-group`, `alert-dialog`

No new npm dependency is planned. If one becomes necessary, stop and ask.

### Internal

- `getDb()` from `src/lib/db.ts` (Sprint 1)
- `users` table — target of the nullable `mcq_attempts.user_id`
- Sprint 1 auth pages and `/api/auth/*` — untouched
- shadcn `table`, `button`, `card`, `field`, `input`, `label`, `badge`
- Zod 4

### Environment

- D1 binding `DB`; worker `quizmaker`; account `d0144de158bb59c054b6f7d86d340bc8`
- OpenNext self-reference: `WORKER_SELF_REFERENCE` → service `quizmaker`
- Compatibility date `2026-09-04`; flags `nodejs_compat` + `global_fetch_strictly_public`
- Live: https://quizmaker.shwetha-hr.workers.dev
- No new environment variables, so `.dev.vars.example` is unchanged

---

## Deployment

Shipped 2026-09-04 after the user asked to correct `wrangler.jsonc` and deploy everything.

### What changed in `wrangler.jsonc`

Sprint 1 already had the worker name, `account_id`, `workers_dev`, and the D1 `DB` binding.
The file was brought in line with the current OpenNext + Wrangler 4 template:

| Field | Why |
|---|---|
| `$schema` → `./node_modules/wrangler/config-schema.json` | Relative path the Wrangler schema expects |
| `compatibility_date` → `2026-09-04` | Workers guidance: keep the date current; OpenNext needs ≥ 2024-09-23 |
| `services.WORKER_SELF_REFERENCE` → `quizmaker` | Required by current OpenNext get-started for Worker self-fetch / caching |
| `observability.head_sampling_rate` → `1` | Structured logs on every request in production |
| `migrations_dir` → `./migrations` | Explicit path; same folder as before |

`main` (`.open-next/worker.js`) and `assets` (`.open-next/assets` / `ASSETS`) were left
alone — OpenNext owns those paths. R2 incremental cache and Images were **not** added;
they need extra Cloudflare resources and are not required to serve the question bank.

`npm run cf-typegen` was re-run after the config change. `cloudflare-env.d.ts` now includes
`WORKER_SELF_REFERENCE`.

### Commands that ran

```bash
npx wrangler d1 migrations apply quizmaker --remote
npm run cf-typegen
npm run deploy
```

| Step | Result |
|---|---|
| Remote migration 0002 | Applied. `mcqs`, `mcq_choices`, `mcq_attempts` exist on production D1 |
| Deploy | Worker `quizmaker`, version `d7c598a4-16f3-47d3-9c25-9e19bb6dbb52` |
| Live URL | https://quizmaker.shwetha-hr.workers.dev |
| Bindings on the Worker | `DB` (quizmaker), `WORKER_SELF_REFERENCE` (quizmaker), `ASSETS` |
| Live `/mcqs` | 200 |
| Live `/login` | 200 |
| Live `GET /api/mcqs` | 200, empty list (`count=0`) — schema is there, no questions yet |

A Wrangler warning about a duplicate `"options"` key inside `.open-next/.../handler.mjs`
is generated OpenNext output, not application source. It did not block the deploy.

---

## Risks and Mitigation

### Technical

- **Risk**: `PUT` replaces choices, so old `mcq_attempts.choice_id` values dangle.
  **Mitigation**: the update batch deletes that question's attempts. Documented here
  because it means editing a question clears its attempt history — acceptable while there
  is no attempt-history UI, and it must be revisited before analytics ship.
- **Risk**: D1 foreign-key enforcement depends on PRAGMA state, so `ON DELETE CASCADE` may
  silently not fire. **Mitigation**: delete children explicitly in a batch; do not rely on
  cascade.
- **Risk**: "Exactly one correct" cannot be expressed as a SQLite constraint.
  **Mitigation**: enforce in Zod and re-check in the service, and test both.
- **Risk**: Sprint 1 is unmerged, so this branch stacks on it and will need a rebase.
  **Mitigation**: recorded as decision 1; rebase once Sprint 1 lands on `main`.
- **Risk**: A leaked answer key would make preview pointless. **Mitigation**: grading is a
  server round-trip, and a test asserts the correct choice is absent from pre-submit markup.
- **Risk**: `next dev` is Node, not Workers. **Mitigation**: check anything
  runtime-sensitive with `npm run preview`.

### User experience

- Anyone can edit or delete any question, since there is no session or ownership. Expected
  this sprint; a real risk to flag before multiple teachers share an instance
- Editing a question silently discards its attempts (see above)
- No pagination, so a large bank produces a long page
- Delete is permanent — no undo — which is why it is behind a confirm dialog

---

## Troubleshooting Guide

Sprint 1's guide still applies (`ai-workspace/register-login-logout_prd.md`), especially
`env.DB` undefined, `@/` failing in Vitest, and anonymous SQL placeholders.

### `no such table: mcqs`
**Problem**: Endpoints 500 with a missing-table error.
**Cause**: Migration 0002 was written but never applied in that environment.
**Solution**: Local: `npx wrangler d1 migrations apply quizmaker --local`, then restart
`npm run dev`. Production: `npx wrangler d1 migrations apply quizmaker --remote` (already
done on 2026-09-04).
**Code Reference**: `migrations/0002_create_mcqs.sql`

### `npx shadcn add` writes no files
**Problem**: The command exits cleanly but no component appears.
**Cause**: The `@shadcn/` namespace was omitted, or the component has no Base UI equivalent.
**Solution**: Use `npx shadcn@latest add @shadcn/dropdown-menu`. In PowerShell, quote the
argument — `'@shadcn/dropdown-menu'` — or the shell expands `@shadcn` as a variable.
**Code Reference**: `.cursor/rules/shadcn.mdc`

### `npx shadcn add` hangs forever
**Problem**: The command prints "Updating files." and never returns.
**Cause**: It is waiting on `? The file button.tsx already exists. Would you like to
overwrite? » (y/N)`. `--yes` does not answer this prompt, and a non-interactive shell cannot.
**Solution**: Do not overwrite `button.tsx` — Sprint 1's forms depend on it. Kill the
process, then add components one at a time, or accept that shared files are already present.
Check `git status` afterwards: files written before the prompt do land.
**Code Reference**: Phase 4 deviation 1

### New shadcn components import `cn` from the wrong place
**Problem**: A generated component has `import { cn } from "cn"` and `package.json` gains a
`cn` dependency.
**Cause**: A bug in shadcn 4.21.0. It ignores the correct `"utils": "@/lib/utils"` alias in
`components.json` and resolves `cn` to an npm package instead.
**Solution**: Repoint the import at `@/lib/utils`, remove `cn` from `package.json`, and run
`npm install`. Always check `git diff package.json` after adding a component.
**Code Reference**: `components.json:17`

### A radio or checkbox has a doubled accessible name
**Problem**: `getByRole("radio", { name: "Oxygen" })` fails; the real name is
`"Oxygen Oxygen"`.
**Cause**: The control is wrapped in a `FieldLabel` *and* given an `aria-label`. Base UI also
sets `aria-labelledby` to the label, so both contribute to the name.
**Solution**: Pick one. Wrapped in a label, drop the `aria-label`; unwrapped, keep it.
**Code Reference**: `src/components/mcq-preview.tsx`

### `is_correct` behaves as truthy when it should be false
**Problem**: Every choice looks correct.
**Cause**: SQLite returns `0`/`1`, and `0` was read as a boolean without conversion.
**Solution**: Convert at the service boundary with `row.is_correct === 1`.
**Code Reference**: `src/lib/services/mcq-service.ts`

### `tsc --noEmit` reports errors in the auth route tests
**Problem**: 10 errors in `src/app/api/auth/*/route.test.ts` — `'json' is of type 'unknown'`
and `Expected 0 arguments, but got 1`.
**Cause**: Inherited from Sprint 1. `await response.json()` returns `unknown` and was used
without narrowing, and the logout test passes a request to a `POST()` that takes none.
`npm test` still passes because Vitest transpiles without type-checking.
**Solution**: Out of scope for this sprint — do not silently "fix" Sprint 1's tests here.
Type the parsed body (`as { user?: ... }`) in a follow-up, or narrow before use.
**Code Reference**: `src/app/api/auth/login/route.test.ts:61`

### PowerShell reports git output as an error
**Problem**: `git push` and `git checkout` print red `NativeCommandError` text but work.
**Cause**: Git writes progress to stderr; PowerShell renders stderr as an error record.
**Solution**: Check the exit code, not the color. Harmless.

---

## Notes for AI Agents

1. Read Overview, the decisions table, and Version Control Workflow before writing code
2. Honor Scope In/Out/Cut. Do not add sessions, quizzes, or AI generation "while you're here"
3. **Commit and push at the end of every phase**, PRD status update included in that commit
4. Never commit a red suite. If a phase will not go green, stop and report
5. TDD: RED first, and make sure it fails for the intended reason
6. Keep MCQ SQL inside `src/lib/services/mcq-service.ts`
7. Never import `getDb` or the service into a `'use client'` component
8. Numbered placeholders; `all()` + `results[0]`; `db.batch()` for multi-statement writes
9. Default is still local migrations only. `--remote` and `npm run deploy` only when asked.
   Both were done for this sprint on 2026-09-04 — see Deployment. Do not redeploy unless asked again.
10. Ask before adding an npm dependency
11. Update phase markers and acceptance criteria as work lands; cite code as `filepath:line-number`
12. Working directory is the repo root, `quiz-maker/`

---

## Current Status

**Last Updated**: 2026-09-04
**Current Phase**: Phase 5 - Verification + production deploy
**Status**: **SHIPPED.** MCQ CRUD is live at https://quizmaker.shwetha-hr.workers.dev
**Branch**: `feature/mcq-crud` → `origin/feature/mcq-crud`, based on unmerged
`feature/register-login-logout`
**Suite**: 18 files / 129 tests passing (Sprint 1 baseline was 10 / 32)
**Lint**: passing. **Build**: passing. **Typecheck**: 10 inherited errors in Sprint 1 auth
route tests, none in this sprint's files
**Migrations**: 0001 and 0002 applied `--local` and `--remote`
**Deploy**: Worker version `d7c598a4-16f3-47d3-9c25-9e19bb6dbb52`. Live `/mcqs`, `/login`,
and `GET /api/mcqs` all return 200. The production bank is empty until a teacher creates
the first question.

**Open items that do not block the live Worker:**

1. **Click through the UI on the live URL.** API and page renders are verified; a full
   browser walkthrough of create → edit → preview → delete is still worth doing.
2. **Decide the branch story.** Sprint 1 never merged, so this branch stacks on it. `main`
   still holds only the starter commit. Both branches need merging, oldest first.
3. **Confirm the defaulted decisions** in the table near the top, particularly the added
   `question_text` column and the nullable `user_id`.
4. **Accept or revisit that editing a question clears its attempts.** Fine today, wrong once
   attempt history matters.
5. **Commit the deploy config.** `wrangler.jsonc`, regenerated `cloudflare-env.d.ts`, and
   this PRD update are local until you ask for a commit.
6. **A stashed `package-lock.json`** from `main` is still in `stash@{0}` if you want it back.

**Suggested next sprint**: sessions, so `mcq_attempts.user_id` stops being null and `/mcqs`
can actually be protected; then grouping questions into quizzes.
