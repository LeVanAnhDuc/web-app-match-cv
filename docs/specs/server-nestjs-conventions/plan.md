# Server NestJS Conventions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author `server/.claude/` (CLAUDE.md + 10 rules + 9 skills) for the NestJS + Prisma backend, plus light code alignment. No behavior change.

**Architecture:** NestJS-native conventions (module/controller/service/dto + Prisma + class-validator + nestjs-i18n), modeled on `web-app-store-server-client/server` in spirit only. No restructure.

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, class-validator, nestjs-i18n, Swagger, Jest, yarn.

## Global Constraints

- NestJS module structure kept as-is; no module moves.
- Rules describe actual code (relative imports — no alias; `HttpException` + `tX` i18n; DTO `fromEntity`).
- Verification gate: `yarn format` → `yarn lint` → `yarn type-check` → `yarn test` → `yarn build`.
- Work in worktree `server/.worktrees/server-nestjs-conventions` (branch `chore/server-nestjs-conventions`).

---

## Group A — `server/.claude/` authoring (parallel subagents)

### Task A1: Skills (9)
**Files:** `server/.claude/skills/<name>/SKILL.md` for: `module-struct`, `standard-nestjs`, `standard-prisma`, `standard-typescript`, `standard-coding-universal`, `standard-security`, `standard-restful-api`, `standard-doc-api`, `standard-backend-engineering-mindset`.
**Source:** adapt `web-app-store-server-client/server/.claude/skills/*` → NestJS+Prisma. Rewrite `standard-mongodb`→`standard-prisma`, `standard-nestjs` new (from Express framework skill spirit), `module-struct` → NestJS module layout. Keep frontmatter (`name`, `description` with TRIGGER).
- [ ] Author all 9; ground examples in real code (`DocumentsService`, `DocumentDto.fromEntity`, `tDoc`, `PrismaService`).

### Task A2: Rules (10)
**Files:** `server/.claude/rules/<name>.md` with YAML `paths`: `controllers`, `services`, `dto`, `prisma`, `config`, `i18n`, `common`, `errors`, `imports`, `constants` (paths per design §4.2).
- [ ] Author all 10 NestJS-native; real symbols; `project-rules`-style is N/A (server uses CLAUDE.md skills table to route).

### Task A3: `server/.claude/CLAUDE.md`
**Files:** `server/.claude/CLAUDE.md` — per design §4.3. Model on ref server CLAUDE.md, adapt to NestJS+Prisma.
- [ ] Verify referenced skills/rules exist.

## Group B — light align + gate

### Task B1: Drift scan + tidy
- [ ] Grep `src/` for inline magic values / hard-coded literals that violate `constants`/`errors` rules.
- [ ] Apply only clear low-risk fixes (e.g. hoist `MAX_FILE_SIZE_BYTES`/regex to a per-module constants file). No module moves.

### Task B2: Green gate
- [ ] `yarn format`
- [ ] `yarn lint` (fix all)
- [ ] `yarn type-check` (fix all)
- [ ] `yarn test` (all pass)
- [ ] `yarn build` (succeeds)

## Group C — drift + PR

### Task C1: root `.claude/CLAUDE.md` drift
- [ ] Mark `server/.claude/CLAUDE.md` + BE skills/rules DONE in §2/§4.2 + status. Separate `.claude` worktree/PR.

### Task C2: commit + PR + merge gate
- [ ] Commit per repo (docs: design+plan; server: .claude + align; .claude: drift).
- [ ] Push + PR per repo; report at merge gate.
