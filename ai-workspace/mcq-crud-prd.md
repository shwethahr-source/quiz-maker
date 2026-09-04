Date created: 2026-09-04
Date last modified: 2026-09-04

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

Rules carried forward:

- RED first, and the RED must fail for the reason the test targets
- Mock `@/lib/db` when the subject is the service; mock `@/lib/services/mcq-service` when
  the subject is a route handler. Never touch real D1 in a unit test
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

`mcqId` and `choiceId` are UUID strings. `name` 1–120 chars, `questionText` 1–1000,
`description` 0–500 (nullable), `choiceText` 1–300.

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

Components to add (source files, not npm packages — all four confirmed present in the
registry):

```bash
npx shadcn@latest add @shadcn/dropdown-menu @shadcn/textarea @shadcn/radio-group @shadcn/alert-dialog
```

Already installed and reused: `badge` `button` `card` `field` `input` `label` `separator` `table`

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

### Phase 1: Database foundation - PLANNED

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

---

### Phase 2: MCQ service - PLANNED

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

---

### Phase 3: HTTP endpoints - PLANNED

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

---

### Phase 4: Frontend - PLANNED

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

---

### Phase 5: Verification - PLANNED

**Objective**: Suite, lint, and build all pass, and the document matches reality.

**Tasks**:
1. `npm test`, `npm run lint`, `npm run build` — record actual output
2. Walk the happy path on `npm run dev`: create → list → edit → preview → delete
3. Tick acceptance criteria; fill in Success Metrics; add troubleshooting entries
4. Report the remote-migration and deploy decisions as the user's call, and do neither

**RED is not required for Phase 5.**

**Commit**: `Close MCQ CRUD verification and refresh the PRD.`

---

## Technical Implementation Details

### Key Files

| Path | Purpose |
|---|---|
| `migrations/0002_create_mcqs.sql` | The three tables and their indexes |
| `src/lib/db.ts` | Existing `getDb()`; unchanged |
| `src/lib/services/mcq-service.ts` | All MCQ SQL |
| `src/lib/mcq-schemas.ts` | Zod bodies for create, update, and attempt |
| `src/app/api/mcqs/route.ts` | `GET` list, `POST` create |
| `src/app/api/mcqs/[id]/route.ts` | `GET`, `PUT`, `DELETE` |
| `src/app/api/mcqs/[id]/attempts/route.ts` | `POST` attempt |
| `src/components/mcq-table.tsx` | Table, ellipsis menu, delete confirm |
| `src/components/mcq-form.tsx` | Shared create/edit form |
| `src/components/mcq-preview.tsx` | Answer and grade |
| `src/app/mcqs/page.tsx` | Question bank (replaces the stub) |
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
- Migrations are `--local` by default. `--remote` and `npm run deploy` only when asked
- `position` is assigned from array order on save; the UI never sends it
- The four shadcn components are copied source files. Ask before adding a real npm dependency
- Restart `npm run dev` after any `wrangler.jsonc` change

---

## Acceptance Criteria

- [ ] `migrations/0002_create_mcqs.sql` creates `mcqs`, `mcq_choices`, `mcq_attempts` and applies locally
- [ ] `mcq_choices.mcq_id` and `mcq_attempts.mcq_id` are foreign keys to `mcqs (id)`
- [ ] `mcq_attempts.choice_id` is a foreign key to `mcq_choices (id)`
- [ ] `mcq_attempts.user_id` is nullable and accepts `NULL`
- [ ] A question saves with 2 choices and with 6 choices
- [ ] A question with 1 choice is rejected with 400
- [ ] A question with 7 choices is rejected with 400
- [ ] A question with zero or two correct choices is rejected with 400
- [ ] `GET /api/mcqs` returns every question with a `choiceCount`
- [ ] `GET /api/mcqs/[id]` returns choices ordered by `position`
- [ ] `PUT /api/mcqs/[id]` replaces the choice set and bumps `updated_at`
- [ ] `DELETE /api/mcqs/[id]` removes the question, its choices, and its attempts
- [ ] Any endpoint returns 404 for an unknown question id
- [ ] `POST /api/mcqs/[id]/attempts` stores the selected choice and server-derived correctness
- [ ] An attempt naming a choice from another question is rejected with 404
- [ ] Route handlers reach D1 only through `mcq-service`
- [ ] `/mcqs` lists questions in a shadcn `Table` with name, description, and an actions column
- [ ] The actions column is a three-vertical-ellipses menu offering Edit, Preview, and Delete
- [ ] Delete asks for confirmation before it calls the API
- [ ] The Create button opens `/mcqs/new`
- [ ] The form shows 2 choice rows by default and allows up to 6
- [ ] Save persists and returns to `/mcqs`; Cancel returns without saving
- [ ] Edit loads the existing question and its choices
- [ ] Preview records an attempt and reports correct or incorrect
- [ ] Preview does not reveal the correct answer before submission
- [ ] Log out still works from `/mcqs`
- [ ] Sessions, tokens, cookies, and social login were not introduced
- [ ] Phases 1–4 were test-first (RED then GREEN)
- [ ] Each phase was committed and pushed separately
- [ ] `npm test` is green and exceeds the 32-test baseline
- [ ] `npm run lint` and `npm run build` pass

---

## Success Metrics

| Metric | Target | How Measured | Status |
|--------|--------|--------------|--------|
| Unit tests | Green, above the 32-test baseline | `npm test` | Pending |
| CRUD happy path | Create → list → edit → preview → delete with no error | Local walkthrough on `npm run dev` | Pending |
| Answer key never shipped early | Correct choice absent from preview markup pre-submit | `McqPreview` test | Pending |
| Choice-set rule | 1, 7, zero-correct, and two-correct all rejected | Schema + route tests | Pending |
| Service boundary | No `getDb` import outside `src/lib/` | Grep during Phase 5 | Pending |
| Phase discipline | 6 commits, one per phase, each pushed | `git log --oneline origin/feature/mcq-crud` | Pending |

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
- No new environment variables, so `.dev.vars.example` is unchanged

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
**Cause**: Migration 0002 was written but never applied locally.
**Solution**: `npx wrangler d1 migrations apply quizmaker --local`, then restart `npm run dev`.
**Code Reference**: `migrations/0002_create_mcqs.sql`

### `npx shadcn add` writes no files
**Problem**: The command exits cleanly but no component appears.
**Cause**: The `@shadcn/` namespace was omitted, or the component has no Base UI equivalent.
**Solution**: Use `npx shadcn@latest add @shadcn/dropdown-menu`. In PowerShell, quote the
argument — `'@shadcn/dropdown-menu'` — or the shell expands `@shadcn` as a variable.
**Code Reference**: `.cursor/rules/shadcn.mdc`

### `is_correct` behaves as truthy when it should be false
**Problem**: Every choice looks correct.
**Cause**: SQLite returns `0`/`1`, and `0` was read as a boolean without conversion.
**Solution**: Convert at the service boundary with `row.is_correct === 1`.
**Code Reference**: `src/lib/services/mcq-service.ts`

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
9. Local migrations only. `--remote` and deploy are the user's call
10. Ask before adding an npm dependency
11. Update phase markers and acceptance criteria as work lands; cite code as `filepath:line-number`
12. Working directory is the repo root, `quiz-maker/`

---

## Current Status

**Last Updated**: 2026-09-04
**Current Phase**: Phase 0 - PRD
**Status**: COMPLETED — Phase 1 not started
**Branch**: `feature/mcq-crud` → `origin/feature/mcq-crud`, based on unmerged
`feature/register-login-logout`
**Baseline suite**: 10 files / 32 tests passing, inherited from Sprint 1
**Next Steps**: Phase 1. Write `src/lib/db/mcqs-schema.test.ts` and confirm RED, then create
and locally apply `migrations/0002_create_mcqs.sql`, then commit and push as one phase
