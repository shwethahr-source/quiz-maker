Date created: 2026-08-31
Date last modified: 2026-08-31

# Register, Login, and Logout - Technical PRD

## Overview/Problem

Quiz Maker is a greenfield app whose long-term purpose is a shared test bank of multiple-choice questions that multiple teachers can build together. Nothing of that collaboration works until teachers can identify themselves. Today the starter has no users, no database, and no way to register, sign in, or sign out. This phase solves only that identity gap so later sprints can attach MCQ work to a known teacher.

---

## Hypothesis

We believe that a simple register / login / logout flow, backed by a hashed-password user table, will let multiple teachers start using Quiz Maker as distinct users and reach a stub MCQ workspace, without introducing sessions, tokens, or social login in this phase.

---

## Scope

### In Scope

- Cloudflare D1 database binding for this project (none exists yet)
- A `users` table and a Wrangler migration that creates it
- User fields: primary key, first name, last name, username, email, password hash, timestamps
- Username and email are separate columns. For a given user they may be the same value (for example both `teacher@school.edu`). Across users, each username and each email must be unique
- Passwords stored only as hashes, never as plaintext
- Client-side hashing of the password before it is sent on HTTP POST for register and login
- A user service in `src/lib/services/` with create, update, delete, and the lookups those operations and auth need
- HTTP endpoints for register, login, and logout. Register and login use the user service to read and write the database
- Register and login pages with forms, validation, and error display
- After a successful register or login, navigate to a stub MCQ page
- Logout from the stub MCQ page, returning the user to login
- A stub `/mcqs` page with no question-bank behavior
- Test-driven implementation with **Vitest**: each phase starts with failing unit tests, then implementation until those tests pass. A phase is not complete until its tests are green and the phase acceptance checks hold

### Out of Scope

- Multiple-choice question create / read / update / delete
- Shared test-bank collaboration features
- Social login (Google, Microsoft, GitHub, and similar)
- Tokens (JWT, API keys, refresh tokens)
- Session management of any kind (cookies, server sessions, CSRF tokens, "remember me")
- Persisted authentication across refresh or a protected-route gate
- Password reset, email verification, account lockout, MFA
- Role-based access (admin vs teacher)
- Profile editing UI (the user service may expose update/delete; this phase does not ship screens for them)

### Cut

- Server-side password stretching (bcrypt / Argon2) - Workers-friendly stretching libraries are extra dependencies and this phase is intentionally basic. Client SHA-256 plus a stored hash is the agreed starting point
- Cookies or `localStorage` session flags used as auth - the user asked for no session management. Success is a redirect, not a persisted login
- Server Actions instead of HTTP endpoints - the product requirement is explicit register / login / logout HTTP APIs
- Sending plaintext passwords over the wire and hashing only on the server - the requirement is to hash in the browser before POST
- `@cloudflare/vitest-pool-workers` - unit tests mock D1 and `getCloudflareContext()`. A Workers test pool changes how the whole suite runs and is not needed for this phase
- Hollow tests (`expect(true).toBe(true)` or assertions that cannot fail)

---

## Testing Approach (TDD with Vitest)

This feature is built **test-first**. Vitest is the unit-testing framework (`vi` for mocks, `expect` for assertions). It is **not installed in the starter**. Propose and add it once, then use it in every phase.

### How every phase is executed

1. **RED** — Write the phase's Vitest files first. Run `npm test`. Those tests must fail for a real reason (missing module, missing table, wrong status, missing field). If they pass immediately, they are not testing the behavior.
2. **GREEN** — Implement only enough production code to make that phase's tests pass. Do not start the next phase's tests until this phase is green.
3. **Done signal** — Phase tests pass **and** the phase's acceptance checks in this PRD are met. Tests are the first signal; they do not replace the product acceptance criteria.

### Harness (set up once, at the start of Phase 1)

Propose these packages before installing:

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths
```

Then add `vitest.config.ts` (jsdom, `globals: true`, `vite-tsconfig-paths` so `@/` resolves) and scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Follow `.cursor/skills/testing/SKILL.md`:

- Colocate tests: `foo.ts` is tested by `foo.test.ts` (or `foo.test.tsx` for components)
- Assert observable behavior and failure paths, not internals
- Each test must pass in isolation. `vi.clearAllMocks()` in `beforeEach`
- Never hit a real network, real D1, or real Cloudflare runtime in unit tests
- Mock `@opennextjs/cloudflare` (`getCloudflareContext` does not work under jsdom)
- Keep D1 behind `src/lib/` so tests mock the service or a thin DB module, not a reconstructed prepared-statement chain unless that module is the subject
- Query React UI by role and accessible name. Use `userEvent`, not `fireEvent`
- Server Components are not rendered in Testing Library. Test data logic as functions; render only client components

### What we do not test in unit tests

- Real Wrangler / remote D1
- Full browser walkthroughs (those stay in Phase 5 manual checks)
- Session/cookie/token behavior (out of scope)

---

## Technical Requirements

### Database Schema

Cloudflare D1 (SQLite). Create the database with Wrangler, bind it as `DB` in `wrangler.jsonc`, then add a migration. Do not apply migrations remotely.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
```

Notes:

- `id` is a generated text UUID-style key, matching the starter D1 convention
- `UNIQUE` on `username` and `email` is required even if a single user sets both fields to the same string
- `password_hash` stores the hash produced by the client (SHA-256 hex). Never store the original password
- `updated_at` is maintained by the user service on update

### API Endpoints

All auth routes live under `src/app/api/auth/`. Request bodies are JSON. Validate every body with Zod before touching the database. Route handlers call the user service; they do not run SQL themselves.

Hashing happens in the browser. The API receives `passwordHash`, not a raw password.

#### POST /api/auth/register

Creates a user and returns the public user record (no password hash).

**Request Body:**

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "username": "ada@school.edu",
  "email": "ada@school.edu",
  "passwordHash": "64-char-sha256-hex"
}
```

`username` and `email` may be identical.

**Response:**

- Success (201):

```json
{
  "user": {
    "id": "…",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "username": "ada@school.edu",
    "email": "ada@school.edu"
  }
}
```

- Error (400): missing fields, invalid email, invalid hash format, or username/email already taken
- Error (500): unexpected server or database error

Register uses `userService.createUser`. Before insert, the service (or the handler via service lookups) must reject a duplicate username or email with 400.

#### POST /api/auth/login

Looks up the user and compares the submitted hash to the stored hash.

**Request Body:**

```json
{
  "username": "ada@school.edu",
  "passwordHash": "64-char-sha256-hex"
}
```

Login identifier is `username`. Email-as-username is allowed because those fields may be the same.

**Response:**

- Success (200): same public `user` object as register
- Error (400): missing fields or invalid hash format
- Error (401): unknown username or hash mismatch. Use one generic message such as `"Invalid username or password"` so callers cannot tell which failed
- Error (500): unexpected server or database error

Login uses the user service to load the user, then compares hashes. Do not log or return `passwordHash`.

#### POST /api/auth/logout

No session exists, so this endpoint does not clear a cookie or token. It exists so the client has a matching auth API and a single place to send users on sign-out.

**Request Body:** none required

**Response:**

- Success (200):

```json
{
  "ok": true
}
```

The client then navigates to `/login`.

### User Interface Requirements

Use existing shadcn/ui pieces (`card`, `button`, `field`, `input`, `label`) under `src/components/`. Forms are client components so they can hash with `crypto.subtle` before POST.

Shared client helper (for example `src/lib/hash-password.ts`, callable from the browser only): SHA-256 of the UTF-8 password, lowercase hex. Register and login must use the same helper.

#### Home (`/`)

- Entry point with short copy that this is Quiz Maker
- Actions: go to Register, go to Login
- No authenticated dashboard in this phase

#### Register (`/register`)

- Fields:
  - First name — required, trimmed, non-empty
  - Last name — required, trimmed, non-empty
  - Username — required, trimmed, non-empty
  - Email — required, valid email format
  - Password — required, minimum 8 characters, `type="password"`
- Username and email may be the same value; do not block that
- On submit: hash password in the browser, POST `/api/auth/register` with `passwordHash` only (never the raw password)
- On 201: navigate to `/mcqs`
- On 400/500: show the API error on the form; stay on `/register`
- Link to `/login` for existing users

#### Login (`/login`)

- Fields:
  - Username — required
  - Password — required, `type="password"`
- On submit: hash password in the browser, POST `/api/auth/login`
- On 200: navigate to `/mcqs`
- On 401/400/500: show a generic failure message; stay on `/login`
- Link to `/register` for new users

#### MCQ stub (`/mcqs`)

- Placeholder page only: title and one or two sentences that the question bank will be built here in a later sprint
- Logout control that POSTs `/api/auth/logout` then navigates to `/login`
- No question forms, lists, or APIs
- No real route protection. A visitor can open `/mcqs` directly. That is acceptable because sessions are out of scope

---

## Implementation Phases

Each phase below starts with **RED** tests. Do not write production code for a phase until its tests exist and have been run (they should fail). Then implement until **GREEN**. A phase is complete only when `npm test` is green for that phase's files **and** the phase deliverables exist.

### Phase 1: Database foundation - COMPLETED

**Objective**: Quiz Maker can persist users in local D1, and the schema contract is locked by tests.

**RED — write tests first** (expect fail: no Vitest harness and/or no migration):

1. Propose Vitest and the harness packages listed in Testing Approach. After agreement, add `vitest.config.ts` and the `test` / `test:watch` scripts so `npm test` can run
2. Add `src/lib/db/users-schema.test.ts` that loads the users migration SQL (read from `migrations/` — pick the file whose name/description is the users table) and asserts:
   - it creates table `users`
   - columns exist: `id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `created_at`, `updated_at`
   - there is no plaintext `password` column
   - `username` and `email` are `UNIQUE`
   - `id` is the primary key
3. Run `npm test`. This file must fail until the migration exists and matches

**GREEN — implement until those tests pass**:

1. Propose adding Cloudflare D1 (required; not configured today). After agreement, create the local D1 database and bind it as `DB` in `wrangler.jsonc`
2. Run `npm run cf-typegen` so `env.DB` is typed
3. Create a Wrangler migration for the `users` table that satisfies the schema test
4. Apply the migration locally only (`--local`). Never apply remotely

**Phase done when**:

- `src/lib/db/users-schema.test.ts` is green
- D1 binding, migration file, and local apply are in place

**Deliverables**:

- Vitest harness (`vitest.config.ts`, npm test scripts)
- `src/lib/db/users-schema.test.ts`
- D1 binding in `wrangler.jsonc`
- Migration file under `migrations/`
- Local schema applied

### Phase 2: User service - COMPLETED

**Objective**: All user persistence goes through one service, proven by unit tests against a mocked D1.

**RED — write tests first** (expect fail: `user-service` missing or methods unimplemented):

Add `src/lib/services/user-service.test.ts`. Mock `@opennextjs/cloudflare` and supply a fake `env.DB` (or mock a thin D1 helper if one is introduced). Tests must not touch real D1. Cover:

- `createUser` persists `password_hash` (not a raw password) and returns a public user with no `passwordHash` / `password_hash`
- `createUser` allows `username` and `email` to be the same string
- `createUser` rejects a duplicate username or email with a clear "already taken" error (simulate a D1 UNIQUE failure)
- `getUserByUsername`, `getUserByEmail`, and `getUserById` return the user when present and a defined empty/not-found result when absent
- `updateUser` changes the provided fields and refreshes `updated_at`
- `deleteUser` removes the user (subsequent lookup is not found)
- Public/to-API mapping never includes the stored hash

Run `npm test`. These must fail until the service exists.

**GREEN — implement until those tests pass**:

1. Add `src/lib/services/user-service.ts` (keep it under `src/lib/services/`)
2. Implement create, update, delete
3. Implement lookups: by id, by username, by email
4. Use prepared statements with numbered placeholders (`?1`, `?2`)
5. Never return `password_hash` from public-facing helpers used by API responses
6. Map D1 UNIQUE failures to a clear "username or email already taken" error

**Phase done when**:

- `src/lib/services/user-service.test.ts` is green
- Service module and public vs stored types exist

**Deliverables**:

- `user-service.test.ts` (written first) and `user-service.ts`
- Typed user record (public vs stored)

### Phase 3: Auth endpoints - PLANNED

**Objective**: Register, login, and logout are callable over HTTP, proven by unit tests against a mocked user service.

**RED — write tests first** (expect fail: routes or Zod schemas missing):

Add colocated tests. Mock the user service; do not mock-reconstruct D1 in this phase. Cover:

- `src/app/api/auth/register/route.test.ts`
  - valid body → 201 and public user (no hash in JSON)
  - `username === email` is accepted
  - missing/invalid fields (including invalid email or hash format) → 400
  - service "already taken" → 400
  - handler calls `createUser`, not D1
- `src/app/api/auth/login/route.test.ts`
  - matching username + hash → 200 and public user
  - unknown user or hash mismatch → 401 with generic `"Invalid username or password"`
  - unknown user and wrong hash produce the same message (no enumeration)
  - missing/invalid body → 400
  - handler uses the user service lookup + compare, not D1
- `src/app/api/auth/logout/route.test.ts`
  - POST → 200 `{ "ok": true }`

If route handlers are awkward to import under Vitest, extract request handlers into testable functions in the same folder (or `src/lib/`) and test those. Do not skip tests.

Run `npm test`. These must fail until the endpoints exist.

**GREEN — implement until those tests pass**:

1. Propose Zod for request validation (not installed today). Add it only after agreement
2. Implement `POST /api/auth/register`
3. Implement `POST /api/auth/login` with generic 401 copy
4. Implement `POST /api/auth/logout`
5. Keep SQL out of route handlers

**Phase done when**:

- All three `route.test.ts` files are green
- Handlers and Zod schemas exist

**Deliverables**:

- Three route handlers and their tests (tests first)
- Zod schemas for register and login bodies

### Phase 4: Frontend auth flow and MCQ stub - PLANNED

**Objective**: A teacher can register or log in in the browser and land on the MCQ stub; logout returns them to login. Client hashing and UI behavior are proven by Vitest.

**RED — write tests first** (expect fail: helper/components missing):

1. `src/lib/hash-password.test.ts`
   - same input → same 64-char lowercase hex
   - different inputs → different hashes
   - does not return the original password string
2. Client form tests (colocated `*.test.tsx`), rendered with Testing Library + `userEvent`. Mock `fetch` and Next navigation. Cover:
   - Register: required fields are present; submit hashes via `hashPassword` then POSTs `/api/auth/register` with `passwordHash` and **no** raw `password`; 201 navigates to `/mcqs`; 400 shows the API error and stays put; username and email may be the same
   - Login: submit hashes then POSTs `/api/auth/login`; 200 navigates to `/mcqs`; 401 shows a generic failure and stays put
   - MCQ stub: shows placeholder copy only (no question CRUD controls); Logout POSTs `/api/auth/logout` then navigates to `/login`
   - Home: links to Register and Login (query by role / accessible name)
3. Run `npm test`. These must fail until the helper and client components exist

Put interactive UI in client components so Testing Library can render them. Do not try to render Server Components.

**GREEN — implement until those tests pass**:

1. Shared client password-hash helper using Web Crypto SHA-256
2. `/register` page and form
3. `/login` page and form
4. `/mcqs` stub with logout
5. Update `/` so it is a simple launch pad to register and login
6. Client-side field validation plus API error display

**Phase done when**:

- Hash helper and UI tests are green
- Pages and forms exist and share the hash helper

**Deliverables**:

- Tests first, then pages, form components, and hash helper

### Phase 5: Verification - PLANNED

**Objective**: The suite stays green, lint/build pass, and the manual happy path matches the tests.

**RED is not required here.** This phase is the ship bar: run everything that already exists, plus checks unit tests cannot cover (real D1, browser network tab).

**Tasks**:

1. Run `npm test` for the full suite. All Phase 1–4 tests must be green. If any are red, return to that phase; do not "fix" by weakening assertions
2. Exercise register → `/mcqs` → logout → login → `/mcqs` locally (`npm run preview` for D1/Workers)
3. Confirm duplicate username/email is rejected
4. Confirm wrong password is a generic 401
5. Confirm raw passwords are not present in network payloads (only `passwordHash`)
6. Run `npm run lint` and `npm run build` and report the actual result

**Phase done when**:

- `npm test` green
- `npm run lint` and `npm run build` reported as actually run
- Manual checks and acceptance criteria checked off

**Deliverables**:

- Full Vitest run recorded
- Lint and build results recorded
- Acceptance criteria checked off

---

## Technical Implementation Details

### Key Files

Planned. Update paths here as files are created.

- `vitest.config.ts` - Vitest harness (jsdom, `@/` via vite-tsconfig-paths)
- `wrangler.jsonc` - D1 `DB` binding (`database_name`: `quizmaker`, local-only `database_id`)
- `migrations/0001_create_users.sql` - users table migration
- `src/lib/db/users-schema.test.ts` - Phase 1 schema contract tests (wrote first; RED then GREEN)
- `src/lib/db.ts` - `getDb()` D1 access (server-only; tests mock this module)
- `src/lib/services/user-service.ts` - create, update, delete, lookups, `toPublicUser`
- `src/lib/services/user-service.test.ts` - Phase 2 service tests (wrote first; RED then GREEN)
- `src/lib/hash-password.ts` - browser SHA-256 helper (client-only)
- `src/lib/hash-password.test.ts` - Phase 4 hash tests (write first)
- `src/app/api/auth/register/route.ts` - register endpoint
- `src/app/api/auth/register/route.test.ts` - Phase 3 register tests (write first)
- `src/app/api/auth/login/route.ts` - login endpoint
- `src/app/api/auth/login/route.test.ts` - Phase 3 login tests (write first)
- `src/app/api/auth/logout/route.ts` - logout endpoint
- `src/app/api/auth/logout/route.test.ts` - Phase 3 logout tests (write first)
- `src/app/register/page.tsx` - register UI
- `src/app/login/page.tsx` - login UI
- `src/app/mcqs/page.tsx` - MCQ stub
- `src/app/page.tsx` - home launch pad
- `src/components/` - register/login form components and colocated `*.test.tsx` (write tests first)

### Implementation Patterns

```typescript
// Client: hash before POST. Never send the raw password.
const passwordHash = await hashPassword(password);

await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    firstName,
    lastName,
    username,
    email,
    passwordHash,
  }),
});
```

```typescript
// Service: parameterized D1 access only. Example shape, not final code.
await db
  .prepare(
    "INSERT INTO users (first_name, last_name, username, email, password_hash) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
  .bind(firstName, lastName, username, email, passwordHash)
  .run();
```

```typescript
// Login compare: treat stored and submitted hashes as secrets.
// Use a constant-time comparison so timing does not leak a match.
```

```typescript
// Vitest: mock Cloudflare. Unit tests never use real D1.
import { beforeEach, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: { DB: mockDb },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
```

Access D1 through `getDb()` in `src/lib/db.ts` (`getCloudflareContext({ async: true })`, then `env.DB`). The user service is the only module that runs user SQL. Only server code may import `getDb` or the user service. Lookups used by the API return `PublicUser` (no hash). Login in Phase 3 should use `getStoredUserByUsername` when it needs the stored hash.

### Important Notes

- AGENTS.md currently says no database, auth, or testing framework is installed. Adding D1, Zod, and Vitest are part of this feature and must be proposed before install/config
- Ask before adding Zod, Vitest, or any other package
- TDD order is mandatory: tests for the phase, run them (RED), then implement (GREEN). Do not implement a phase and backfill tests afterward
- Phase 1 D1 is local-only. `wrangler.jsonc` uses `database_id` `local-only-quizmaker-db`. Migrations were applied with `--local` only. A remote D1 was not created
- `npm run dev` is Node and will not prove Workers/D1 behavior. Prefer `npm run preview` when checking database-backed auth
- Apply migrations with `--local` only
- Username/email may match for one user; they must still be unique across the table
- Logout cannot invalidate a server session because none exists. Document that limitation rather than faking a session
- SHA-256 without a per-user salt is not production-grade password storage. Call that out; do not "fix" it in this phase by adding tokens or bcrypt unless the user asks
- Do not import D1 or the user service into `'use client'` components

---

## Acceptance Criteria

- [x] A local D1 `users` table exists via migration (id, first_name, last_name, username, email, password_hash, timestamps)
- [ ] Register creates a user and stores only a hash in `password_hash`
- [ ] A user may set username and email to the same value
- [ ] A second user cannot reuse an existing username or email
- [ ] Login succeeds when username and the client-hashed password match a stored user
- [ ] Login fails with a generic 401 when the username is unknown or the hash does not match
- [ ] Register and login HTTP bodies include `passwordHash` and do not include the raw password
- [ ] Successful register redirects to `/mcqs`
- [ ] Successful login redirects to `/mcqs`
- [ ] `/mcqs` is a stub only (no MCQ CRUD)
- [ ] Logout returns the user to `/login`
- [x] User service supports create, update, and delete
- [ ] Route handlers do not query D1 directly; they go through the user service
- [ ] No social login, tokens, cookies, or other session machinery is introduced
- [x] Vitest is configured (`npm test` / `npm run test:watch`)
- [ ] Each implementation phase was developed test-first (RED then GREEN); the suite does not contain hollow assertions
- [ ] `npm test` is green for schema, user service, auth routes, hash helper, and client form tests
- [ ] `npm run lint` and `npm run build` succeed after implementation

---

## Success Metrics

This phase is foundation work, not a launched product. Treat the first row as the ship bar; the rest are directional once more than one teacher can use a shared environment.

| Metric | Target | How Measured |
|--------|--------|--------------|
| Unit tests (Vitest) | `npm test` green for all Phase 1–4 files | CI-local `vitest run` |
| Auth happy path | A new user can register, land on `/mcqs`, log out, and log back in without errors | Manual walkthrough on local preview |
| Password at rest | Zero plaintext passwords in `users` | Inspect a row created by register |
| Password in transit (this app) | Register/login payloads contain `passwordHash` only | Browser network tab on POST |
| Collision handling | Duplicate username or email is rejected with 400 | Attempt a second register with the same values |
| Time to first identified user | Under 2 minutes from home page for a new teacher | Informal timing during walkthrough |

---

## Dependencies

### External Dependencies

- Cloudflare D1 - user persistence (must be added; not configured today)
- Wrangler - create DB, migrations, local apply
- Web Crypto (`crypto.subtle`) - SHA-256 in the browser (built in; no package)
- Vitest - unit tests (`vi`, `expect`). Propose before adding, with `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `vite-tsconfig-paths`

### Internal Dependencies

- `@opennextjs/cloudflare` `getCloudflareContext()` - reach `env.DB`
- `src/lib/services/user-service.ts` - all user reads/writes
- shadcn/ui `card`, `button`, `field`, `input`, `label` - auth forms
- Zod - request validation (propose before adding)
- Vitest + Testing Library - TDD harness (propose before adding). Conventions in `.cursor/skills/testing/SKILL.md`

### Environment

- D1 binding name: `DB`
- No new auth secrets are required for SHA-256-only hashing
- If a variable is added later, put the local value in `.dev.vars` and an empty placeholder in `.dev.vars.example`

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `npm run dev` appears to work but D1 calls fail or differ on Workers
- **Mitigation**: Verify register/login with `npm run preview` before calling the phase done

- **Risk**: Client-side SHA-256 means the value on the wire is the same value in the database. A leaked hash is enough to call login
- **Mitigation**: Accept for this phase. Do not add tokens or sessions to compensate. A later sprint can introduce salted server-side hashing and real sessions

- **Risk**: UNIQUE constraint errors bubble as 500s instead of 400s
- **Mitigation**: Translate D1 constraint failures in the user service to a typed "already taken" error

- **Risk**: Adding D1, Zod, or Vitest without agreement violates working agreements
- **Mitigation**: Propose each new dependency/binding and wait for a yes before installing

- **Risk**: Tests are written after the code and never fail, or they assert nothing real
- **Mitigation**: Each phase requires a recorded RED run before implementation. Reject hollow tests. A test that cannot fail is not a test

### User Experience Risks

- **Risk**: Teachers expect to stay logged in after refresh and think logout is broken when `/mcqs` is still reachable
- **Mitigation**: Keep the stub honest. Do not fake a session. A later sprint owns real auth continuity

- **Risk**: Users try to log in with email when they registered a different username
- **Mitigation**: Login is by username. Copy on the login page should say that. It is valid when they chose the same value for both

- **Risk**: Hashing failures in older browsers
- **Mitigation**: Use `crypto.subtle` and show a form error if hashing throws

---

## Troubleshooting Guide

Add entries when bugs are found and fixed. Seeded from known starter constraints:

### D1 not configured
**Problem**: `env.DB` is missing or untyped
**Cause**: Starter originally had no D1 database
**Solution**: Binding `DB` is in `wrangler.jsonc`. Run `npm run cf-typegen` after changing bindings. Phase 1 used a local-only `database_id` (`local-only-quizmaker-db`) so no remote D1 was created. To deploy later, run `npx wrangler d1 create quizmaker` and replace that id with the real one
**Code Reference**: `wrangler.jsonc`, `.cursor/rules/d1.mdc`

### Migration applied to remote
**Problem**: Schema changed in the production/remote D1
**Cause**: `migrations apply` run without `--local` or with `--remote`
**Solution**: Do not do this. Local apply only. Remote is the user's decision later
**Code Reference**: `.cursor/rules/d1.mdc`

### Anonymous SQL placeholders fail locally
**Problem**: Query binding errors in local Wrangler
**Cause**: Mixing `?` and `?1` or using anonymous `?`
**Solution**: Use numbered placeholders only (`?1`, `?2`, …)
**Code Reference**: `.cursor/rules/d1.mdc`

### `@/` imports fail in Vitest
**Problem**: Tests cannot resolve `@/lib/...`
**Cause**: Missing `vite-tsconfig-paths` in `vitest.config.ts`
**Solution**: Add the plugin as specified in `.cursor/skills/testing/SKILL.md`
**Code Reference**: `vitest.config.ts`

### `getCloudflareContext` fails under jsdom
**Problem**: User-service or route tests throw when touching Cloudflare
**Cause**: `getCloudflareContext()` is not available in Vitest/jsdom
**Solution**: `vi.mock("@opennextjs/cloudflare")` and supply a fake `env`. Never use a real D1 in unit tests
**Code Reference**: `.cursor/skills/testing/SKILL.md`

---

## Notes for AI Agents

When working with this PRD:

1. Start by reading the Problem and Hypothesis to understand intent
2. Use Scope (In/Out/Cut) to determine boundaries — do not build out-of-scope items
3. Update phase status markers as work progresses
4. Add implementation details under "Technical Implementation Details" as code is written
5. Mark acceptance criteria as complete when features work
6. Add troubleshooting entries when bugs are found and fixed
7. Keep all sections current - remove outdated information
8. Use code references format: `filepath:line-number` when citing code
9. Do not implement MCQs, social login, tokens, cookies, or sessions
10. Ask before adding D1 configuration steps that create cloud resources, and before adding npm packages (including Vitest and Zod)
11. Never apply D1 migrations remotely
12. Hash passwords in the browser before POST; store and compare hashes only
13. Implement with TDD: for Phases 1–4, write the listed Vitest files first, run `npm test` (RED), then implement until GREEN. Do not backfill tests after the code
14. Follow `.cursor/skills/testing/SKILL.md`. No hollow tests. No real D1 or network in unit tests

---

## Current Status

**Last Updated**: 2026-08-31
**Current Phase**: Phase 2 - User service
**Status**: COMPLETED — stopped for user review before Phase 3
**Next Steps**: After review, start Phase 3 RED (auth route tests) on `feature/register-login-logout`
