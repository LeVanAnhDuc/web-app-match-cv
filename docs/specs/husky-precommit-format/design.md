# Design — Husky pre-commit auto-format (ESLint + Prettier)

> **Status**: Approved (brainstorm) — 2026-07-30. Scope: tooling/chore for `server/` + `client/`.

## Goal

On every `git commit` inside `server/` and `client/`, automatically run **ESLint (`--fix`)**
and **Prettier (`--write`)** on **staged files only**, re-stage the results, and let the commit
proceed with linted & formatted code. An unfixable ESLint error blocks the commit (intended).

## Tooling (per repo)

- **husky** v9 — git hook manager. Installs a `pre-commit` hook into the repo's `.git/`.
- **lint-staged** — runs commands against the list of staged files, then re-stages them.
- Both added as `devDependencies` via `yarn add -D` (both repos use yarn classic 1.22.19).
- A `"prepare": "husky"` script auto-installs the hook on `yarn install` for anyone cloning.

## Artifacts created in each repo

- `.husky/pre-commit` → single line: `npx lint-staged`
- `package.json` → `"prepare": "husky"` in `scripts`
- `package.json` → `"lint-staged"` config block

### `server/` (ESLint runs Prettier via `eslint-plugin-prettier`)

```jsonc
"lint-staged": {
  "*.ts": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

Rationale: server's flat config uses `eslint-plugin-prettier/recommended`, so `eslint --fix`
already applies Prettier formatting; the trailing `prettier --write` is a safety net and covers
the same rule config. Non-TS files (json/md/yaml) can't be linted, so Prettier only.

### `client/` (ESLint & Prettier separate; ignore-safe)

```jsonc
"lint-staged": {
  "*.{ts,tsx,js,jsx}": ["eslint --fix --no-warn-ignored", "prettier --write"],
  "*.{json,md,css,yml,yaml}": ["prettier --write"]
}
```

Rationale: client keeps ESLint and Prettier independent (its `format` script runs both).
`--no-warn-ignored` prevents failures when a staged file matches an ESLint ignore pattern
(`e2e/**`, `playwright.config.ts`, config files). `.prettierignore` already excludes lock files.

## Isolation

Feature branch `chore/husky-precommit` cut from `origin/main` in each repo (`docs/`, `server/`,
`client/`) — worktree opt-out per user for this small chore. No commits on `main`.

## Verification

Per repo:
1. Stage a deliberately mis-formatted file → commit → confirm the hook rewrites it (formatted
   content lands in the commit).
2. Introduce an unfixable ESLint error → confirm the commit is blocked with the error surfaced.

## Out of scope

- `docs/` and `.claude/` repos (no `package.json` / code to format).
- CI-side enforcement (pre-commit only).
- Changing existing ESLint / Prettier rule sets.
