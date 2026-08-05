# Design — Server NestJS Conventions (`server/.claude/`)

> **Status**: Approved 2026-07-30. Feature `server-nestjs-conventions`.
> Author the `server/.claude/` methodology layer (CLAUDE.md + rules + skills) for the
> NestJS + Prisma backend, taking the *spirit* of `web-app-store-server-client/server`
> but written NestJS-native. **No restructure** — light alignment only.

## 1. Goal & Scope

- **Author** `server/.claude/`: `CLAUDE.md`, `rules/*.md` (path-scoped), `skills/*` (curated 9).
- **Light-align** `server/src/**` only where a real convention drift exists (e.g. inline magic
  values). Keep NestJS module structure as-is — it is already idiomatic.
- **No behavior change.** Existing Jest tests + type-check + build must stay green.

**Out of scope**: client/, DB schema redesign, auth/JWT (deferred). Reference project's
Express/Mongoose/Joi structure is NOT mirrored.

## 2. Reference vs Current (why NestJS-native, not mirror)

| | Ref `store/server` | Current `match-cv/server` |
|---|---|---|
| Framework | Express.js (custom layered) | **NestJS** (DI, opinionated) |
| DB | MongoDB (Mongoose) | **PostgreSQL (Prisma)** |
| Validation | Joi (`validators/`) | **class-validator** (DTO) |
| Bootstrap | `loaders/loadAll()` | NestJS `main.ts` + `AppModule` |
| Errors | custom `common/exceptions` layer | NestJS built-in `HttpException` + i18n msg |
| i18n | i18next | **nestjs-i18n** (`tX(key, fallback)` per module) |
| Alias | `@/` | none (relative imports) |

Ref rules `models`(Mongoose)/`loaders`/`validators`(Joi)/`middlewares`(Express) do not map to
NestJS. NestJS already prescribes module/controller/service/DI/pipe/guard. → Author
NestJS-native rules/skills; borrow only philosophy (module-struct, restful, doc-api, security).

## 3. Current conventions (ground truth)

- **Module**: `src/modules/<f>/{<f>.controller.ts, <f>.service.ts, <f>.module.ts, dto/*.dto.ts, i18n-messages.ts, <domain-helpers>.ts}`; registered in `AppModule`.
- **Controller**: `@ApiTags`+`@Controller`, thin, delegates to service; pipes (`ParseUUIDPipe`, `ParseFilePipe`, global `ValidationPipe`); Swagger `@ApiOkResponse/@ApiCreatedResponse`; DTO in/out.
- **Service**: `@Injectable`, constructor DI (`PrismaService`, `CurrentUserService`); throws NestJS `HttpException` subclasses (`BadRequestException`, `NotFoundException`) with i18n message via `tX(key, fallback)`; returns `Dto.fromEntity(entity)`.
- **DTO**: input = class-validator decorators; output = `@ApiProperty` fields + `static fromEntity(entity): Dto` mapper. File `<name>.dto.ts`.
- **Prisma**: `prisma/schema.prisma` + `migrations/` + `seed.ts`; `src/prisma/{prisma.module,prisma.service}.ts`; queries live in services.
- **Config**: `src/config/env.validation.ts` `validateEnv`; `ConfigModule.forRoot({ isGlobal, validate })`.
- **i18n**: nestjs-i18n; per-module `i18n-messages.ts` → `tX(key, fallback) = I18nContext.current()?.t(key) ?? fallback`; JSON `src/i18n/{en,vi}/<ns>.json`.
- **common/**: cross-cutting providers (`current-user/`).
- **main.ts**: global prefix `api/v1`, `helmet`, CORS, global `ValidationPipe({whitelist,transform})`, Swagger `api/v1/docs`, Throttler `APP_GUARD`.
- **Tests**: co-located `*.spec.ts` (Jest).

## 4. Deliverables

### 4.1 Skills (`server/.claude/skills/<name>/SKILL.md`) — 9
`module-struct`, `standard-nestjs` (new), `standard-prisma` (from ref `standard-mongodb`),
`standard-typescript`, `standard-coding-universal`, `standard-security`,
`standard-restful-api`, `standard-doc-api`, `standard-backend-engineering-mindset`.
(Drop `standard-jwt` — auth deferred.)

### 4.2 Rules (`server/.claude/rules/<name>.md`, YAML `paths`) — 10
`controllers` (`src/modules/**/*.controller.ts`), `services` (`src/modules/**/*.service.ts`),
`dto` (`src/modules/**/dto/**`), `prisma` (`prisma/schema.prisma` + `src/prisma/**`),
`config` (`src/config/**`), `i18n` (`src/i18n/**` + `**/i18n-messages.ts`),
`common` (`src/common/**`), `errors` (`src/**`), `imports` (`src/**`), `constants` (`src/**`).
(No `modules` rule — module folder layout lives in the `module-struct` skill.)

### 4.3 `server/.claude/CLAUDE.md`
Tech stack (→ root `.claude/techstack/backend.md`) · skills/rules tables · commands
(`yarn build/start:dev/lint/format/type-check/test` + `npx prisma *`) · architecture
(bootstrap, global prefix, ValidationPipe, Swagger, Throttler) · core patterns
(`fromEntity`, `tX` i18n, `HttpException`, `PrismaService`, `CurrentUserService`) ·
quality gate (`format → lint → type-check → test`, `build`).

## 5. Light align (code)

Scan `src/` for real drift only. Candidate: inline `MAX_FILE_SIZE_BYTES` /
`ALLOWED_FILE_TYPE_REGEX` in `documents.controller.ts` → optionally hoist into a
per-module constants file to satisfy the `constants` rule. Apply only clear, low-risk
tidy-ups; no module moves. Likely minimal.

## 6. Root drift (§4.6)

After merge-ready, update root `.claude/CLAUDE.md` §2/§4.2 + status: mark
`server/.claude/CLAUDE.md` + BE skills/rules **DONE** (no longer TBD). Rides its own `.claude` PR.

## 7. Verification

Pure convention authoring + light align ⇒ E2E N/A (no FE), security review skip (no
attack-surface change). Green gate: `yarn format` → `yarn lint` → `yarn type-check` →
`yarn test` → `yarn build`, all pass.
