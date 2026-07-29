# Plan — Husky pre-commit auto-format (ESLint + Prettier)

Design: `design.md` (same folder). Isolation: worktrees on branch `chore/husky-precommit`
in `docs/`, `server/`, `client/`. Both code repos use **yarn classic 1.22.19**.

## Task 1 — server/ (worktree: `server/.worktrees/husky-precommit`)

1. `yarn add -D husky lint-staged` (installs deps + adds to devDependencies).
2. `npx husky init` — creates `.husky/pre-commit` and adds `"prepare": "husky"` to scripts.
3. Overwrite `.husky/pre-commit` contents with exactly: `npx lint-staged`.
4. Add to `package.json`:
   ```jsonc
   "lint-staged": {
     "*.ts": ["eslint --fix", "prettier --write"],
     "*.{json,md,yml,yaml}": ["prettier --write"]
   }
   ```
5. Verify (see Verification).

## Task 2 — client/ (worktree: `client/.worktrees/husky-precommit`)

1. `yarn add -D husky lint-staged`.
2. `npx husky init`.
3. Overwrite `.husky/pre-commit` contents with exactly: `npx lint-staged`.
4. Add to `package.json`:
   ```jsonc
   "lint-staged": {
     "*.{ts,tsx,js,jsx}": ["eslint --fix --no-warn-ignored", "prettier --write"],
     "*.{json,md,css,yml,yaml}": ["prettier --write"]
   }
   ```
5. Verify (see Verification).

## Verification (each repo, inside its worktree)

- **Format path**: create a temp file with bad formatting (e.g. `const x=1 ;`), `git add` it,
  run `npx lint-staged` → confirm the file is rewritten to the repo's Prettier style. Delete temp file.
- **Confirm hook wiring**: `.husky/pre-commit` contains `npx lint-staged`; `package.json` has
  `"prepare": "husky"` and the `lint-staged` block; `git config core.hooksPath` resolves to husky's dir.
- Do NOT leave the temp file staged/committed.

## Commit / PR (per repo, at end)

- docs: commit `specs/husky-precommit-format/{design,plan}.md`.
- server / client: commit `package.json`, `yarn.lock`, `.husky/**` (husky auto-gitignores `.husky/_`).
- Open a PR per repo. **STOP at merge and report to the user** (do not auto-merge).

## Out of scope

`docs/` & `.claude/` hooks; CI enforcement; changing ESLint/Prettier rules.
