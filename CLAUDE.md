# Match CV (web-app-match-cv)

Web app that matches a CV against a job description: a hybrid engine (keyword overlap + embedding cosine + an LLM report) scores one CV↔JD pair, then generates follow-up content (CV rewrite suggestions, cover letters) from that report. Stack: NestJS 11 + Prisma 6 + PostgreSQL on the server, TanStack Start (React 19 + Vite) + Ant Design + Tailwind on the client, with `openai`-SDK calls to OpenAI-compatible providers (OpenRouter / OpenAI / Gemini).

This is a **monorepo** with two workspaces, `client/` and `server/`, plus shared `docs/`. It was assembled from what used to be two separate repositories, `client-web-app-match-cv` and `api-web-app-match-cv` (merged in with `git subtree`, so their history is preserved).

## Commands

Root (`/`): `yarn install` — installs husky only; the pre-commit hook runs `lint-staged` in `client/` and then `server/`.

From `server/`:

- `yarn install` then `cp .env.example .env` — needs a local PostgreSQL (no Docker in this repo)
- `npx prisma migrate dev` — apply migrations · `npx prisma generate` — regenerate the client (run before `yarn lint`) · `npx prisma db seed` — seed the stub user
- `yarn start:dev` (watch, `:5200`) · `yarn start` · `yarn build` · `yarn start:prod`
- `yarn test` (Jest unit, `src/**/*.spec.ts`) · `yarn test:watch` · `yarn test:cov` · `yarn test:e2e` (Jest + supertest, needs the DB)
- `yarn type-check` · `yarn lint` · `yarn lint:fix` · `yarn format` · `yarn format:check`
- `yarn seed:mock` / `yarn seed:mock:clean` — dev-only mock CV/JD documents · `yarn recompute-scores` — recompute stored keyword/overall scores

From `client/`:

- `yarn install` then `cp .env.example .env`
- `yarn dev` (`:5300`) · `yarn build` · `yarn preview` · `yarn generate-routes` (`tsr generate`)
- `yarn test` (Vitest unit, serial) · `yarn test:e2e` (Playwright; needs both servers up and `E2E_DATABASE_URL`; first run `npx playwright install chromium`)
- `yarn type-check` · `yarn lint` · `yarn lint:fix` · `yarn format` · `yarn format:check`

## README (REQUIRED — keep in sync with features)

`README.md` describes what the app does for its users — it is not a boilerplate page. Every commit that adds or changes user-facing behaviour (`feat:`) MUST update the `## Features` section of `README.md` in the same branch, before merging — one short English bullet in the existing style.

While touching README, refresh any stale numbers you notice (test counts, stack versions).

README-only documentation commits use a `docs:` prefix.

## Commits

Conventional Commits, English subject, scope = feature or area (`feat(compare):`, `docs(specs):`, `chore:`). Bodies are multi-paragraph and explain the reasoning, not the diff. `docs/` is the source of truth for scope: check `docs/project-goals.md` (§4 Goals, §5 Non-Goals, §10 Roadmap) and `docs/unfinished-features.md` before starting work, and update them in the same PR.
