# AGENTS.md

Instructions for AI agents working in this repository. This file is loaded into every
agent conversation, so it describes only what is stable and true of the project.

## Project

Quiz Maker is a shared multiple-choice test bank for teachers. Sprint 1
(register / login / logout) is **complete** — see
`ai-workspace/register-login-logout_prd.md`. Teachers can register, log in, log
out, and land on an MCQ stub. The next sprint should add question-bank behavior
on `/mcqs` via a new PRD, without replacing the auth contract.

Live: https://quizmaker.shwetha-hr.workers.dev

## Stack

- **Next.js 16** with the App Router and React 19
- **Cloudflare Workers** for hosting, via `@opennextjs/cloudflare`
- **Tailwind CSS v4**, configured in CSS rather than a JS config file
- **shadcn/ui** on Base UI, `base-nova` style, with Lucide icons
- **TypeScript** in strict mode
- **Wrangler** for Cloudflare configuration, secrets, and deployment
- **Cloudflare D1** bound as `DB` (`quizmaker`, id in `wrangler.jsonc`)
- **Vitest** for unit tests (`npm test` / `npm run test:watch`)
- **Zod** for request validation (`src/lib/auth-schemas.ts`)

An AI SDK is not installed. Do not write code that imports one without adding
it first and telling the user.

## Layout

```
src/app/            Routes, layouts, and global styles (App Router)
src/app/api/auth/   Register, login, logout HTTP endpoints
src/components/     Feature UI (login/signup/mcq stub) + src/components/ui/
src/lib/            Shared utilities; domain logic in src/lib/services/
migrations/         D1 schema migrations
ai-workspace/       Technical PRDs (source of truth for the current sprint)
.cursor/rules/      File-scoped conventions
.cursor/skills/     Task-specific guidance loaded on demand
public/             Static assets
```

Import through the `@/` alias, which maps to `src/`.

Always run npm and wrangler from this directory (`quiz-maker/`), not the parent
`c:\quiz` folder.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server on Node at `localhost:3000` |
| `npm run preview` | Build and run on the local **Workers** runtime |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` after changing bindings |

`npm run dev` runs on Node and will not surface Workers-specific problems. Verify
anything runtime-sensitive with `npm run preview`. Restart `npm run dev` after
changing `wrangler.jsonc` bindings.

## Working agreements

- **Do not deploy.** Never run `npm run deploy` unless explicitly asked.
- **Do not touch the remote database unless asked.** Default is
  `migrations apply --local`. `--remote` only when the user wants production
  schema updated.
- **Ask before adding a dependency.** This is a teaching repository; an unexplained
  dependency is a cost. Propose it and say why.
- **Do not edit generated files.** `cloudflare-env.d.ts`, `next-env.d.ts`, and
  `package-lock.json` are generated.
- **Keep secrets out of the repo.** Local values belong in `.dev.vars`, which is
  gitignored. When adding a variable, also add an empty placeholder to
  `.dev.vars.example`. Production values go in `wrangler secret put`.
- **Verify before claiming completion.** Run `npm run lint` and `npm run build` and
  report the actual result. Do not describe work as done based on inspection alone.
- **TDD.** New feature phases: write failing Vitest files first, then implement.
  Follow `.cursor/skills/testing/SKILL.md`. No hollow tests. No real D1 in unit tests.
- **Auth stays hashed in the browser.** Do not send raw passwords. Do not add
  sessions, tokens, or social login unless a new PRD says so.
- **Say when you are unsure.** A flagged uncertainty is more useful than a confident
  guess that has to be unwound later.

## Cursor Cloud specific instructions

Cloud agents have no Cloudflare credentials and no `.dev.vars`. In that environment:

- `npm run dev`, `npm run build`, and `npm run lint` work normally.
- `npm run preview`, `npm run deploy`, and any `wrangler` command that needs
  authentication will fail. This is expected. Do not try to authenticate.
- If a task genuinely requires Cloudflare access, stop and report that it must be run
  locally instead.
