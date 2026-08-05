---
name: standard-typescript
description: TypeScript coding standards for this NestJS backend (Node.js). TRIGGER — read when writing or reviewing any server-side .ts file. Covers type safety, tsconfig + NestJS decorator flags, type-check via tsc --noEmit, generics, async patterns, error handling, immutability, relative imports (no path alias), and naming.
user-invocable: false
---

> Sources: TypeScript official docs, Google TypeScript Style Guide, TS Do's and Don'ts. **Backend (Node.js) variant** — no DOM; runtime is NestJS on Node.

## tsconfig.json — this project

Actual `tsconfig.json` (NestJS default, hardened). Key flags:

| Flag                                               | Value      | Why                                                                                                                                     |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `module` / `moduleResolution`                      | `nodenext` | Node runtime resolution — NOT `bundler` (that is FE)                                                                                    |
| `target`                                           | `ES2023`   | modern Node                                                                                                                             |
| `experimentalDecorators` + `emitDecoratorMetadata` | `true`     | **required by NestJS DI + class-validator/@nestjs/swagger** — decorators read constructor/param types at runtime via `reflect-metadata` |
| `strictNullChecks`                                 | `true`     | null-safety on                                                                                                                          |
| `isolatedModules`                                  | `true`     | each file transpiles standalone                                                                                                         |
| `skipLibCheck`                                     | `true`     | skip d.ts checks                                                                                                                        |

- Type-check command: **`yarn type-check`** = `tsc --noEmit`. Must be green before handover.
- Note: `noImplicitAny`, `strictBindCallApply`, `noFallthroughCasesInSwitch` are currently off in this repo — do not rely on them; still write explicit types.

## No path alias — relative imports

This project uses **relative imports only**, no `@/`:

```ts
// ✅ actual project style
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { CreateDocumentDto } from "./dto/create-document.dto";

// ❌ no path alias in this repo
import { PrismaService } from "@/prisma/prisma.service";
```

## Imports

```ts
import type { Document } from "@prisma/client"; // type-only when possible
```

- **Named exports only** — no default exports (matches Nest style; providers/DTOs are named classes).
- Prisma-generated types + enums import from `@prisma/client` (`Document`, `MatchResult`, `DocumentKind`, `SourceFormat`, `Prisma`).
- No circular dependencies — restructure or use `import type` to break cycles.

## Type vs Interface

- `interface` for object shapes (DTO payloads, `MatchReport`, `ParsedFile`, `MatchRunResult`).
- `type` for unions, intersections, mapped/conditional types.

```ts
export interface MatchReport {
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}
```

## Enums

- **In-schema Prisma enums** (`DocumentKind`, `SourceFormat`) are the exception — they generate real runtime enums used across DTO validation + queries. Import and use them (`SourceFormat.text`, `DocumentKind.CV`).
- For app-only fixed sets not in the DB, prefer union types or `as const` over hand-written TS `enum`.

## Forbidden patterns

- Boxed primitives (`String`, `Number`, `Boolean`, `Object`) — use `string`, `number`, `boolean`, `Record<string, unknown>`.
- `any` in production code — use `unknown` + narrow/guard (e.g. `parsed as Record<string, unknown>` then read fields via `toStringArray`).
- `as` to bypass type errors — narrow first. **Exception**: the Prisma `Json` ↔ DTO boundary needs a documented `as unknown as Prisma.InputJsonValue` / `as unknown as MatchReportDto` cast (Prisma types JSON columns loosely).
- `!` non-null assertion without structural guarantee. **Exception**: the `clearTimeout(timer!)` pattern in `withTimeout` where the timer is provably assigned.
- `// @ts-ignore` — use `// @ts-expect-error: <reason>` only for a known TS bug.

## Null & Undefined

- `??` for defaults when `0`/`""` are valid — never `||`:
  ```ts
  const baseURL = config.get<string>("OPENROUTER_BASE_URL") ?? DEFAULT_BASE_URL;
  ```
- Optional chaining: `I18nContext.current()?.t(key)`, `response.data[0]?.embedding`.

## Async Patterns

- `Promise.all()` for independent calls — the codebase does this for the two embeddings and the two document lookups:
  ```ts
  const [cvEmbedding, jdEmbedding] = await Promise.all([
    this.ai.embed(cvText),
    this.ai.embed(jdText)
  ]);
  const [cvDoc, jdDoc] = await Promise.all([
    this.prisma.document.findFirst({ where: { id: dto.cvDocumentId, userId } }),
    this.prisma.document.findFirst({ where: { id: dto.jdDocumentId, userId } })
  ]);
  ```
- Always `await` (or return) promises — unhandled rejections crash Node.
- External calls get a timeout guard (see `withTimeout` in `ai.service.ts`, `withParseTimeout` in `parsing.ts`) — never let a provider hang the request.

## Error Handling

- `catch` is `unknown` in strict mode — narrow before use, or re-throw a domain exception. Codebase pattern: `catch (err) { if (err instanceof BadRequestException) throw err; throw parseFailedError(); }`.
- Domain failures = **NestJS `HttpException` subclasses** (`BadRequestException`, `NotFoundException`, `ServiceUnavailableException`) — NOT `new Error(...)`, NOT custom classes (see `standard-nestjs` / `module-struct`).

## Immutability

- Prefer spread + `.map()/.filter()` over mutation.
- `readonly` on injected deps: `constructor(private readonly prisma: PrismaService)`.

## Naming

- Types/classes = PascalCase nouns (`DocumentsService`, `MatchResultDto`). Functions = camelCase verbs (`createMatch`, `deriveTitle`). Constants = `UPPER_SNAKE_CASE` (`MAX_MATCH_CHARS`, `SEMANTIC_WEIGHT`).

## DO NOT

- Use `any`, boxed primitives, default exports, or path aliases (`@/`)
- Use `||` for defaults when `0`/`""` valid — use `??`
- Throw `new Error(...)` for domain failures — throw a Nest `HttpException`
- Leave unhandled promise rejections or untyped `catch` usage
- Hand-write a TS `enum` when a union / Prisma enum fits
