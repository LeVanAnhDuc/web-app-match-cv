# Server — Backend API

NestJS REST API cho web-app-match-cv (job-board 2 chiều; MVP = CV↔JD matching). Prisma/PostgreSQL, nestjs-i18n, Swagger; AI qua OpenRouter (`openai` SDK). Port **5200**, prefix `api/v1`.

> Yêu cầu chưa rõ → hỏi lại user trước khi làm. Tránh tự suy luận convention — đọc rule/skill.

## Tech Stack

Chi tiết version xem root `.claude/techstack/backend.md`. Tóm tắt:

- **Framework**: NestJS 11 (DI, module-based) + Express platform
- **Language**: TypeScript 5 (decorators; `tsc --noEmit` type-check)
- **Database**: PostgreSQL + **Prisma** (`PrismaService`)
- **Validation**: class-validator + class-transformer (DTO), global `ValidationPipe({ whitelist, transform })`
- **i18n**: nestjs-i18n (`en` / `vi`), per-module `tX(key, fallback)`
- **API docs**: Swagger (`@nestjs/swagger`) tại `api/v1/docs`
- **AI**: OpenRouter qua `openai` SDK (matching engine)
- **Security**: helmet + `@nestjs/throttler` (global guard)
- **Test**: Jest (`*.spec.ts` co-located)
- **Auth**: **defer** — `CurrentUserService` hiện stub (`STUB_USER_ID`)
- **Package manager**: yarn

## Skills

`.claude/skills/` chứa convention. Đọc skill theo task:

| Khi nào                                                           | Skill                                           |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| Viết/review BẤT KỲ code — nguyên tắc chung                        | `standard-coding-universal/SKILL.md`            |
| Viết/review `.ts` (type safety, decorators, async, imports)       | `standard-typescript/SKILL.md`                  |
| Scaffold/review module (controller/service/module/dto/i18n)       | `module-struct/SKILL.md`                        |
| NestJS: DI, provider, pipe, guard, interceptor, config, bootstrap | `standard-nestjs/SKILL.md`                      |
| Prisma schema, query, migration, PrismaService, seed              | `standard-prisma/SKILL.md`                      |
| REST endpoint, verb/status, request/response DTO                  | `standard-restful-api/SKILL.md`                 |
| Swagger/OpenAPI: `@ApiTags`, `@ApiProperty`, response decorators  | `standard-doc-api/SKILL.md`                     |
| Auth / input user / data nhạy cảm / external request / config     | `standard-security/SKILL.md`                    |
| Thiết kế backend, architecture, resilience                        | `standard-backend-engineering-mindset/SKILL.md` |

## Rules (path-scoped)

Đọc rule khớp target path (`paths` frontmatter) **1 lần ở đầu task**:

| Rule          | Paths                                    |
| ------------- | ---------------------------------------- |
| `controllers` | `src/modules/**/*.controller.ts`         |
| `services`    | `src/modules/**/*.service.ts`            |
| `dto`         | `src/modules/**/dto/**`                  |
| `prisma`      | `prisma/schema.prisma` + `src/prisma/**` |
| `config`      | `src/config/**`                          |
| `i18n`        | `src/i18n/**` + `**/i18n-messages.ts`    |
| `common`      | `src/common/**`                          |
| `errors`      | `src/**`                                 |
| `imports`     | `src/**`                                 |
| `constants`   | `src/**`                                 |

> Module folder layout (controller+service+module+dto+i18n-messages) nằm trong skill `module-struct` (không có rule `modules` riêng).

## Commands

```bash
yarn start:dev        # Dev server watch (port 5200)
yarn build            # nest build → dist/
yarn start:prod       # node dist/main
yarn type-check       # tsc --noEmit
yarn lint             # eslint .   (lint:fix để auto-fix)
yarn format           # prettier --write .
yarn test             # jest (test:cov, test:watch, test:e2e)
npx prisma migrate dev --name <name>   # tạo + apply migration
npx prisma generate                    # regenerate client
yarn seed             # seed DB (idempotent)
```

## Architecture

```
main.ts  bootstrap: NestFactory → setGlobalPrefix('api/v1') → helmet → CORS
         → global ValidationPipe({whitelist,transform}) → Swagger('api/v1/docs') → listen
AppModule: ConfigModule.forRoot({isGlobal, validate: validateEnv})
         + ThrottlerModule (+ APP_GUARD ThrottlerGuard)
         + I18nModule (fallback 'en', QueryResolver 'lang' + AcceptLanguageResolver)
         + PrismaModule + CurrentUserModule + feature modules (Documents, Matching, Health)
Request flow: Controller (thin, @Api* + pipes) → Service (@Injectable, business) → PrismaService (data)
```

- **DB access**: chỉ trong service qua `PrismaService`; query scope theo `userId` = `CurrentUserService.getUserId()`.
- **Env**: `src/config/env.validation.ts` `validateEnv` (class-validator). KHÔNG đọc `process.env` trong module/service (chỉ bootstrap `main.ts` + validator được phép).

## Core Patterns

- **DTO**: input = class-validator (`@IsEnum/@IsString/@IsBoolean/@IsOptional`) + `@ApiProperty`; output = `@ApiProperty` fields + `static fromEntity(entity): Dto`. Entity type từ `@prisma/client`.
- **Errors (domain)**: throw NestJS `HttpException` subclass (`BadRequestException`, `NotFoundException`…) với message i18n `tX(key, fallback)`. KHÔNG `new Error(...)` trong domain (ngoại lệ: bootstrap/config validation lúc khởi động). Global `ValidationPipe` lo lỗi DTO.
- **i18n**: mỗi module có `i18n-messages.ts` → `tDoc/tMatch(key, fallback)` = `I18nContext.current()?.t(key) ?? fallback`; JSON `src/i18n/{en,vi}/<ns>.json` (en+vi đồng bộ).
- **Imports**: relative (chưa cấu hình alias). `import type` cho type-only.
- **Constants**: magic value (vd `MAX_FILE_SIZE_BYTES`, regex mime) là named const (module-local hoặc file constants) — không hard-code literal rải rác.

## Quality & Workflow

**BẮT BUỘC: sau khi hoàn tất BẤT KỲ task code trong thư mục này, chạy đủ theo thứ tự:**

```bash
yarn format       # auto-fix format
yarn lint         # eslint (fix hết error)
yarn type-check   # tsc --noEmit (fix tay)
yarn test         # jest (phải xanh)
yarn build        # nest build phải thành công
```

- Chạy đủ dù nghĩ code đã sạch. Còn error → fix HẾT trước khi bàn giao.
- `yarn format`/`yarn lint` có thể tự sửa file → đọc lại sau khi chạy.
- Đổi Prisma schema → `npx prisma migrate dev` + cập nhật `seed.ts` idempotent; note ảnh hưởng data trong `design.md`.
