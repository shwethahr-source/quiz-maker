Date created: 2026-08-31
Date last modified: 2026-08-31

# Register, Login, and Logout - Technical PRD

## Overview/Problem

Quiz Maker is a shared multiple-choice test bank for teachers. Collaboration cannot start until teachers can identify themselves. This sprint delivered that identity layer: a D1 `users` table, a user service, HTTP register/login/logout, and shadcn-based pages that hash passwords in the browser and land on an MCQ stub. The next sprint builds the question bank on `/mcqs`; it must not replace this auth contract.

---

## Hypothesis

We believe that a simple register / login / logout flow, backed by a hashed-password user table, will let multiple teachers start using Quiz Maker as distinct users and reach a stub MCQ workspace, without introducing sessions, tokens, or social login in this sprint.

**Outcome**: Confirmed locally and on the deployed Worker (`https://quizmaker.shwetha-hr.workers.dev`). Teachers can register, reach `/mcqs`, log out, and log back in.

---

## Scope

### In Scope (this sprint — shipped)

- Cloudflare D1 bound as `DB` (local + remote `quizmaker`)
- `users` table via `migrations/0001_create_users.sql`
- Fields: id, first name, last name, username, email, password hash, timestamps
- Username and email may be the same for one user; both are unique across users
- Passwords stored and compared only as SHA-256 hex hashes
- Client-side hashing before register/login POST
- User service: create, update, delete, lookups
- HTTP endpoints: `POST /api/auth/register`, `/login`, `/logout`
- shadcn login/signup block pages, adapted to username login and first/last/username/email
- Stub `/mcqs` with logout (no question CRUD)
- Vitest TDD for Phases 1–4

### Out of Scope (still true for the next sprint unless a new PRD says otherwise)

- Multiple-choice question create / read / update / delete (next sprint)
- Shared test-bank collaboration features
- Social login (Google, Microsoft, GitHub, and similar)
- Tokens (JWT, API keys, refresh tokens)
- Session management (cookies, server sessions, CSRF, "remember me")
- Persisted authentication across refresh or a protected-route gate
- Password reset, email verification, account lockout, MFA
- Role-based access (admin vs teacher)
- Profile editing UI

### Cut

- Server-side password stretching (bcrypt / Argon2)
- Cookies or `localStorage` used as auth
- Server Actions instead of HTTP endpoints
- Sending plaintext passwords over the wire
- shadcn "Login with Google" / "Sign up with Google" / "Forgot your password?"
- `@cloudflare/vitest-pool-workers`
- Hollow tests

---

## Testing Approach (TDD with Vitest)

**Installed and required.** Every new feature phase is test-first: RED, then GREEN. Colocate tests (`foo.ts` → `foo.test.ts`). Follow `.cursor/skills/testing/SKILL.md`.

```bash
npm test          # vitest run — 10 files / 32 tests as of Phase 5
npm run test:watch
```

Harness (`vitest.config.ts`): jsdom, `globals: true`, `@vitejs/plugin-react`, `vite-tsconfig-paths` for `@/`.

Pinned because latest `@vitejs/plugin-react` pulled Babel 8 and conflicted with this repo:

```
vitest@^3.2.7
@vitejs/plugin-react@^4.7.0
```

Rules:

- Assert observable behavior and failure paths. No `expect(true).toBe(true)`
- `vi.clearAllMocks()` in `beforeEach`. Tests must pass alone
- Never hit a real network, real D1, or Cloudflare runtime in unit tests
- Mock `@/lib/db` (or the user service) rather than reconstructing D1 in every test
- Query UI by role and accessible name; use `userEvent`
- Do not render Server Components in Testing Library

```ts
// Unit tests mock the D1 entry point, not Cloudflare itself, when the subject is the service.
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => getMemoryDb()),
});
```

---

## Technical Requirements

### Database Schema

Cloudflare D1 (SQLite). Binding `DB` in `wrangler.jsonc`. Database name `quizmaker`. Remote id: `fd33905f-6013-476c-974a-79dbc6fed47a`. Migration: `migrations/0001_create_users.sql` (applied local and remote).

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

The service generates `id` with `crypto.randomUUID()` and sets timestamps in JS. `password_hash` is the client SHA-256 hex. Never store a raw password.

Further schema changes **must** be a new Wrangler migration. Apply `--local` by default. Apply `--remote` only when the user explicitly asks (needed before a deploy that depends on the new columns).

```bash
npx wrangler d1 migrations create quizmaker <description>
npx wrangler d1 migrations apply quizmaker --local
# remote only when asked:
# npx wrangler d1 migrations apply quizmaker --remote
```

### API Endpoints

JSON bodies. Zod in `src/lib/auth-schemas.ts` before any service call. Handlers never import `getDb` or run SQL.

`passwordHash` must match `/^[a-f0-9]{64}$/`.

#### POST /api/auth/register — `src/app/api/auth/register/route.ts`

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

**Response:**

- 201: `{ "user": { "id", "firstName", "lastName", "username", "email", "createdAt", "updatedAt" } }` — no hash
- 400: validation failed, or `UserAlreadyTakenError` (`"Username or email already taken"`)
- 500: unexpected error (logged server-side)

#### POST /api/auth/login — `src/app/api/auth/login/route.ts`

**Request Body:**

```json
{
  "username": "ada@school.edu",
  "passwordHash": "64-char-sha256-hex"
}
```

Login is by **username**. Unknown user and wrong hash both return 401 `{ "error": "Invalid username or password" }`. Compare with `hashesMatch` (`src/lib/hashes-match.ts`). Return `toPublicUser(stored)`.

#### POST /api/auth/logout — `src/app/api/auth/logout/route.ts`

No session to clear. Returns 200 `{ "ok": true }`. Client navigates to `/login`.

### User Interface Requirements

Auth UI is the shadcn login/signup **block layout** (centered card, `Card` / `Field` / `Input` / `Button`, Tailwind tokens). No `react-hook-form`. Errors via `FieldError`.

Client helper: `src/lib/hash-password.ts` — SHA-256, lowercase hex. Register and login must keep using it.

**Page shells** (do not invent a different chrome without a new PRD):

```tsx
// /login
<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
  <div className="w-full max-w-sm">
    <LoginForm />
  </div>
</div>
```

`/register` is the same shell with `SignupForm`.

| Route | Component | Behavior |
|---|---|---|
| `/` | `HomeLaunchPad` | Links: Register, Log in |
| `/register` | `SignupForm` | first/last/username/email/password/confirm; hash; POST register; 201 → `/mcqs` |
| `/login` | `LoginForm` | username + password; hash; POST login; 200 → `/mcqs` |
| `/mcqs` | `McqStub` | Placeholder copy only; Log out → POST logout → `/login` |

Confirm password is client-only and must never appear in the POST body. No Google buttons. No forgot-password link. `/mcqs` is not route-protected (no session).

---

## Implementation Phases

### Phase 1: Database foundation - COMPLETED

Vitest harness + schema contract tests (RED: no `migrations/`) + D1 binding + `0001_create_users.sql` applied locally.

### Phase 2: User service - COMPLETED

`user-service.test.ts` (RED: missing module) then `src/lib/services/user-service.ts` + `src/lib/db.ts`. Mocked D1 only.

### Phase 3: Auth endpoints - COMPLETED

Route tests (RED: missing `./route`) then Zod + three handlers. Handlers call the user service, never `getDb`.

### Phase 4: Frontend auth flow and MCQ stub - COMPLETED

Hash + form tests (RED: missing modules) then shadcn-adapted pages. Follow-up fix: `env.DB` was undefined under a stale `next dev` / non-UUID `database_id`. Binding now uses a real UUID; `getDb()` throws if `DB` is missing.

### Phase 5: Verification - COMPLETED

**Objective**: Suite stays green; lint/build pass; happy path matches tests.

**Verification log (2026-08-31):**

| Check | Result |
|---|---|
| `npm test` | **32 passed** / 10 files |
| `npm run lint` | **passed** (exit 0) |
| `npm run build` | **passed** — routes `/`, `/login`, `/register`, `/mcqs`, `/api/auth/*` |
| Local browser | User confirmed register → `/mcqs` → logout → login works |
| Deployed Worker | User confirmed `https://quizmaker.shwetha-hr.workers.dev` works |
| Duplicate username/email | 400 already-taken (covered by tests + user walkthrough) |
| Wrong password | generic 401 (covered by tests + user walkthrough) |
| Wire format | POST bodies send `passwordHash` only (covered by form tests) |

**RED is not required for Phase 5.**

---

## Technical Implementation Details

### Key Files

- `wrangler.jsonc` — Worker `quizmaker`, `account_id`, `workers_dev: true`, D1 `DB` → `fd33905f-6013-476c-974a-79dbc6fed47a`
- `next.config.ts` — `initOpenNextCloudflareForDev()` so `getCloudflareContext` works in `next dev`
- `vitest.config.ts` — jsdom + `@/` via `vite-tsconfig-paths`
- `migrations/0001_create_users.sql` — users table
- `src/lib/db.ts` — `getDb()` (`src/lib/db.ts:3`)
- `src/lib/services/user-service.ts` — persistence + `PublicUser` / `StoredUser` / `UserAlreadyTakenError`
- `src/lib/auth-schemas.ts` — Zod register/login bodies
- `src/lib/hash-password.ts` — browser SHA-256
- `src/lib/hashes-match.ts` — constant-time compare
- `src/app/api/auth/{register,login,logout}/route.ts` — HTTP APIs
- `src/components/{login-form,signup-form,home-launch-pad,mcq-stub}.tsx`
- `src/app/{page,login/page,register/page,mcqs/page}.tsx`

### Implementation Patterns (as shipped)

**D1 access — server only** (`src/lib/db.ts`):

```ts
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) {
    throw new Error(
      "D1 binding DB is not available. Restart `npm run dev` after changing wrangler.jsonc, and apply migrations with `npx wrangler d1 migrations apply quizmaker --local`.",
    );
  }
  return env.DB;
}
```

**Insert — numbered placeholders** (`src/lib/services/user-service.ts:120`):

```ts
await db
  .prepare(
    `INSERT INTO users (id, first_name, last_name, username, email, password_hash, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
  .bind(id, firstName, lastName, username, email, passwordHash, now, now)
  .run();
```

Lookups use `all()` and `results[0]`, not `first()`. UNIQUE failures matching `/UNIQUE constraint failed/i` become `UserAlreadyTakenError`. Public API mapping is `toPublicUser` (strips `passwordHash`). Login uses `getStoredUserByUsername`.

**Client hash + POST** (`src/lib/hash-password.ts`, used by both forms):

```ts
export async function hashPassword(password: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const passwordHash = await hashPassword(password);
await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ firstName, lastName, username, email, passwordHash }),
});
```

**Login compare** (`src/lib/hashes-match.ts`):

```ts
export function hashesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
```

**Zod** (`src/lib/auth-schemas.ts`):

```ts
export const passwordHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "passwordHash must be a 64-character lowercase hex SHA-256 digest");
```

**next dev bindings** (`next.config.ts:15`):

```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
```

Restart `npm run dev` after any `wrangler.jsonc` binding change.

### Important Notes

- Run all npm/wrangler commands from `c:\quiz\quiz-maker`, never `c:\quiz` (no `package.json` there)
- D1, Vitest, and Zod are installed. Ask before adding more packages
- TDD remains mandatory for new work
- `database_id` must be a UUID or `env.DB` stays undefined under `next dev`
- `npm run dev` is Node; `npm run preview` is the local Workers runtime
- Username/email may match for one user; unique across the table
- Logout does not clear a session — none exists. `/mcqs` is reachable without login
- SHA-256 without a per-user salt is not production-grade. Do not "fix" that by adding tokens unless a new PRD says so
- Never import `getDb` or the user service into `'use client'` components
- Live URL: `https://quizmaker.shwetha-hr.workers.dev` (Workers & Pages → `quizmaker`, not Websites/Domains)

---

## Acceptance Criteria

- [x] A D1 `users` table exists via migration (local and remote)
- [x] Register creates a user and stores only a hash in `password_hash`
- [x] A user may set username and email to the same value
- [x] A second user cannot reuse an existing username or email
- [x] Login succeeds when username and the client-hashed password match
- [x] Login fails with a generic 401 when the username is unknown or the hash does not match
- [x] Register and login HTTP bodies include `passwordHash` and do not include the raw password
- [x] Successful register redirects to `/mcqs`
- [x] Successful login redirects to `/mcqs`
- [x] `/mcqs` is a stub only (no MCQ CRUD)
- [x] Logout returns the user to `/login`
- [x] User service supports create, update, and delete
- [x] Route handlers do not query D1 directly; they go through the user service
- [x] No social login, tokens, cookies, or other session machinery was introduced
- [x] Vitest is configured (`npm test` / `npm run test:watch`)
- [x] Phases 1–4 were test-first (RED then GREEN)
- [x] `npm test` is green (32 tests)
- [x] `npm run lint` and `npm run build` succeed (Phase 5, 2026-08-31)

---

## Success Metrics

| Metric | Target | How Measured | Status |
|--------|--------|--------------|--------|
| Unit tests (Vitest) | `npm test` green | `vitest run` — 32 passed | Met |
| Auth happy path | Register → `/mcqs` → logout → login | Local + deployed, user-confirmed | Met |
| Password at rest | No plaintext in `users` | Service + register tests | Met |
| Password in transit | `passwordHash` only | Form tests | Met |
| Collision handling | Duplicate → 400 | Service + register tests | Met |

---

## Dependencies

### External

- Cloudflare D1 `quizmaker` — `fd33905f-6013-476c-974a-79dbc6fed47a`
- Wrangler 4 — config, migrations, deploy
- Web Crypto — client SHA-256
- Vitest 3 + Testing Library + jsdom + `vite-tsconfig-paths` + `@vitejs/plugin-react@4`

### Internal

- `getDb()` → `getCloudflareContext({ async: true }).env.DB`
- `src/lib/services/user-service.ts`
- shadcn `card`, `button`, `field`, `input`, `label`
- Zod 4 — `src/lib/auth-schemas.ts`

### Environment

- D1 binding: `DB`
- Worker name: `quizmaker`
- Account: `d0144de158bb59c054b6f7d86d340bc8`
- `workers_dev`: true (subdomain `shwetha-hr.workers.dev`)
- No auth secrets. New vars: `.dev.vars` + empty `.dev.vars.example`

---

## Risks and Mitigation

### Technical

- **`next dev` vs Workers** — Prefer `npm run preview` for runtime-sensitive checks. Restart `next dev` after binding changes
- **Hash on the wire equals hash in the DB** — Accepted. Later sprint can add salted server hashing + sessions
- **UNIQUE as 500** — Mapped in the user service to `UserAlreadyTakenError`
- **New packages** — Ask first
- **Hollow tests** — Reject tests that cannot fail

### User experience

- Refresh on `/mcqs` does not "stay logged in" — expected; no session
- Login is by username, not email, unless they set both to the same value

---

## Troubleshooting Guide

### npm cannot find package.json
**Problem**: `ENOENT ... C:\quiz\package.json`
**Cause**: Command run from `c:\quiz` instead of `c:\quiz\quiz-maker`
**Solution**: `cd c:\quiz\quiz-maker` then retry
**Code Reference**: repo root is `quiz-maker/`

### D1 `env.DB` undefined / register "Server error"
**Problem**: `Cannot read properties of undefined (reading 'prepare')`
**Cause**: Stale `next dev` started before the binding, or `database_id` was not a UUID
**Solution**: UUID id in `wrangler.jsonc`, `npx wrangler d1 migrations apply quizmaker --local`, restart `npm run dev`
**Code Reference**: `src/lib/db.ts:3`, `wrangler.jsonc`

### Deploy fails: workers.dev subdomain
**Problem**: Wrangler asks to register a workers.dev subdomain and non-interactive deploy says no
**Cause**: Account had no `*.workers.dev` subdomain
**Solution**: Register once at the Workers onboarding page, set `workers_dev: true`, redeploy from `quiz-maker`
**Code Reference**: `wrangler.jsonc` (`workers_dev`, `account_id`)

### `@/` imports fail in Vitest
**Problem**: Cannot resolve `@/lib/...`
**Cause**: Missing `vite-tsconfig-paths`
**Solution**: Keep the plugin in `vitest.config.ts`
**Code Reference**: `vitest.config.ts`

### `getCloudflareContext` / D1 in unit tests
**Problem**: Tests throw when importing Cloudflare or real D1
**Cause**: jsdom is not Workers
**Solution**: Mock `@/lib/db` or the user service. Never use real D1 in Vitest
**Code Reference**: `.cursor/skills/testing/SKILL.md`

### Anonymous SQL placeholders fail
**Problem**: Binding errors in local Wrangler
**Cause**: `?` instead of `?1`
**Solution**: Numbered placeholders only
**Code Reference**: `.cursor/rules/d1.mdc`

### Remote schema missing new columns
**Problem**: Production register/login works but a new table/column does not
**Cause**: Migration applied only with `--local`
**Solution**: Ask the user, then `npx wrangler d1 migrations apply quizmaker --remote`
**Code Reference**: `migrations/`

---

## Handoff for the next sprint (MCQ)

Start a new technical PRD from `ai-workspace/TEMPLATE_TECHNICAL_PRD.md` (for example `ai-workspace/mcq_prd.md`). Do not reopen this file's Out of Scope items unless the new PRD explicitly takes them.

**Keep:**

- `users` table and user service as-is unless you add a column via migration
- Auth pages and `/api/auth/*` unless the new PRD adds sessions
- TDD with Vitest; mock `getDb` / user service
- shadcn Field/Card/Button; ask before `react-hook-form`

**Build on `/mcqs`:** replace `McqStub` placeholder copy with question-bank UI. Logout must remain.

**Do not:**

- Add Google login, JWT, cookies, or bcrypt "while you're here"
- Query D1 from client components or from route handlers (keep a service in `src/lib/services/`)
- Apply remote migrations or `npm run deploy` unless the user asks
- Run npm from `c:\quiz`

**Suggested first tests for MCQ:** failing tests for create/list question APIs and the `/mcqs` form, then implement.

---

## Notes for AI Agents

1. Read Problem, Hypothesis, and **Handoff** before writing MCQ code
2. Honor Scope In/Out/Cut — this sprint is closed
3. Keep this PRD current if you change auth; otherwise write a new PRD
4. Cite code as `filepath:line-number`
5. Do not implement MCQs, social login, tokens, cookies, or sessions in this file's name
6. Ask before new npm packages or new Cloudflare resources
7. Default: local migrations only. Remote apply and deploy only when the user asks
8. Hash in the browser; store and compare hashes only
9. TDD: tests first (RED), then implement (GREEN)
10. Follow `.cursor/skills/testing/SKILL.md` and `.cursor/rules/d1.mdc`
11. Working directory is always `quiz-maker/`

---

## Current Status

**Last Updated**: 2026-08-31
**Current Phase**: Phase 5 - Verification
**Status**: COMPLETED
**Branch**: `feature/register-login-logout`
**Live**: https://quizmaker.shwetha-hr.workers.dev
**Local**: http://localhost:3000 (from `c:\quiz\quiz-maker`, `npm run dev`)
**Next Steps**: New PRD for MCQ question-bank work on `/mcqs`. Do not start that work from this document's leftover Phase 5 tasks
