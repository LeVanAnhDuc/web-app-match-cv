# Match CV (web-app-match-cv)

Web app that matches a CV against a job description: a hybrid engine (keyword overlap + embedding cosine + an LLM report) scores one CV↔JD pair, then generates follow-up content (CV rewrite suggestions, cover letters) from that report. Stack: NestJS 11 + Prisma 6 + PostgreSQL on the server, TanStack Start (React 19 + Vite) + Ant Design + Tailwind on the client, with `openai`-SDK calls to OpenAI-compatible providers (OpenRouter / OpenAI / Gemini).

This is a **monorepo** with two workspaces, `client/` and `server/`, plus shared `docs/`. It was assembled from what used to be two separate repositories, `client-web-app-match-cv` and `api-web-app-match-cv` (merged in with `git subtree`, so their history is preserved).

## Commands

Root (`/`): `pnpm install` — installs husky only; the pre-commit hook runs `lint-staged` in `client/` and then `server/`.

From `server/`:

- `pnpm install` then `cp .env.example .env` — needs a local PostgreSQL (no Docker in this repo)
- `pnpm exec prisma migrate dev` — apply migrations · `pnpm exec prisma generate` — regenerate the client (run before `pnpm lint`) · `pnpm exec prisma db seed` — no-op (there is no default user; users come from Ducker ID sign-in)
- `pnpm start:dev` (watch, `:5200`) · `pnpm start` · `pnpm build` · `pnpm start:prod`
- `pnpm test` (Jest unit, `src/**/*.spec.ts`) · `pnpm test:watch` · `pnpm test:cov`
- `pnpm type-check` · `pnpm lint` · `pnpm lint:fix` · `pnpm format` · `pnpm format:check`
- `pnpm seed:mock --user <email>` / `pnpm seed:mock:clean` — dev-only mock CV/JD documents for a user who has signed in once · `pnpm recompute-scores` — recompute stored keyword/overall scores

From `client/`:

- `pnpm install` then `cp .env.example .env`
- `pnpm dev` (`:5300`) · `pnpm build` · `pnpm preview` · `pnpm generate-routes` (`tsr generate`)
- `pnpm test` (Vitest unit, serial)
- `pnpm type-check` · `pnpm lint` · `pnpm lint:fix` · `pnpm format` · `pnpm format:check`

From `automation-testing/` (own `package.json` + `.env`; see its `README.md` and `CLAUDE.md`):

- `pnpm install` then `cp .env.example .env` · first run `pnpm exec playwright install chromium`
- `pnpm test` — Playwright e2e (desktop / tablet / mobile / guest) + API tests against the running pair (`:5200` + `:5300`); seeds and wipes rows in the dev DB at `E2E_DATABASE_URL`
- `/write-tests <module>` — write or normalise a feature's e2e + API coverage there

## README — keep `## Features` in sync

`README.md` describes what the app does for its users — it is not a boilerplate page. Every commit that adds or changes user-facing behaviour (`feat:`) also updates the `## Features` section of `README.md` in the same branch, before merging — one short English bullet in the existing style.

While touching README, refresh any stale numbers you notice (test counts, stack versions).

README-only documentation commits use a `docs:` prefix.

## Commits

Conventional Commits, English subject, scope = feature or area (`feat(compare):`, `docs(specs):`, `chore:`). Bodies are multi-paragraph and explain the reasoning, not the diff.

`docs/` is the source of truth for scope. Before starting work, read `docs/README.md` — it maps the whole tree — then the files the task needs: `docs/01-product/overview.md` §4 Non-Goals, `docs/02-requirements/scope.md` (FR status), `docs/03-design/invariants.md` (before touching existing code), `docs/04-state/backlog.md` (what is in flight and what is owed). Update them in the same PR. Traceability runs on IDs (`US-xx`, `FR-xx`, `NFR-<AREA>-xx`, `ADR-NNNN`) — reference them in commit bodies instead of restating the docs.

`docs/project-goals.md` and `docs/unfinished-features.md` were split into that tree on 2026-09-03 and are now redirect stubs only. Do not read from or write to them.
