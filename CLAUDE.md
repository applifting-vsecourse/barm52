# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

The CLI may also import `cn` from the `cn` npm package and add that package to `apps/frontend/package.json` and `pnpm-lock.yaml`. Every kit file uses `cn` from `@/lib/utils`, and a new dependency is a separate decision. Point the import back at `@/lib/utils`, revert both files, then run `pnpm install --frozen-lockfile --offline` to prune the stray package.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it. Don't start a second instance, don't restart it, don't run `pnpm dev`.

Don't reach for the browser to check your own work. Tests and type-checks are the evidence; open the running app when asked to, not on your own initiative.

### Extending an endpoint must not change what it already accepts

`QuacksController` — and any controller copied from it — runs a controller-level `ValidationPipe` with `forbidNonWhitelisted: true`. Give a handler that had no `@Query()` or `@Body()` a DTO, and every parameter the DTO doesn't list turns from ignored into a 400. Tests and `pnpm check-all` stay green unless a test pins it, so nothing else will notice.

Before changing an existing endpoint's inputs, check what `main` does with them (`git show main:<file>`). Validate a new parameter on its own, with a pipe on `@Query('q', …)` rather than a DTO for the whole query string — see `search-query.pipe.ts`.
