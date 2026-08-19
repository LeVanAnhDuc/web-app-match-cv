---
name: standard-coding-universal
description: Language-agnostic code standards applicable to all stacks and all agent types (code generation, review, refactoring). Load this skill alongside any stack-specific coding standard. TRIGGER — read when writing or reviewing any code in this repo, as the baseline layer beneath standard-typescript / standard-nestjs / standard-prisma.
user-invocable: false
---

# Universal Coding Standards

## Code Quality Principles

- Readability > KISS > DRY > YAGNI
- **Readability First** — clear names, self-documenting code, consistent formatting
- **KISS** — simplest solution that works, no premature optimization
- **YAGNI** — don't build features before they're needed
- **Design for testability** — avoid hidden dependencies and global state

## Naming Conventions

- Names must express intent, not implementation
- Variables and functions must be self-explanatory — no comment needed to understand them
- No single-letter names except loop indices (`i`, `j`, `k`)
- No misleading names — `userList` must be a list, not an object
- No unexplained abbreviations: `usrMgr`, `calcTtl`, `dtStr` are forbidden
- Boolean variables must be phrased as yes/no: `isValid`, `hasPermission`, `canEdit`, `isSaved`
- Function names must be verbs: `getUserId`, `createMatch`, `parseFile`
- Class/type names must be nouns: `DocumentsService`, `MatchResult`, `PrismaService`
- Magic numbers → use named constants (e.g. `MAX_FILE_SIZE_BYTES`, `SEMANTIC_WEIGHT`)

## Function Design

- **Single responsibility** — one function does one thing
- **Max ~40 lines of logic** per function — extract if exceeded (excluding boilerplate/setup)
- **Max 3 parameters** — group into an object/DTO if more are needed
- **Pure functions** when possible — minimize side effects (e.g. `deriveTitle`, `tokenize`, `cosine` are pure)
- **Early return** — return immediately on failure conditions, avoid deep nesting
- **Rule of Three** — logic appearing 3+ times must be extracted into a shared function. Two occurrences may be acceptable — prefer duplication over premature abstraction

## Module Design

- **High cohesion** — group related logic together, keep unrelated logic separate
- **Low coupling** — modules depend on abstractions (DI), not concrete implementations
- **Single direction** — avoid circular dependencies between modules

## Comments

- Never comment what the code already says
- Comments explain **why**, not what (e.g. the security-review notes on file caps in `parsing.ts`)
- `TODO` and `FIXME` must include a reference — no open-ended comments (e.g. `TODO(auth): …`)
- Dead code must be deleted, never commented out

## Error Handling

- **Never swallow errors** — empty catch blocks are forbidden. A `catch {}` must translate to a domain exception (e.g. `throw aiFailedError()`), not silence
- **Fail fast** — detect errors as early as possible, do not let them propagate silently
- **Error messages must include context** — what failed, why, and ideally what to do
- **Never expose internal details** outside the system boundary (stack traces, DB schema, internal paths)
- **Distinguish recoverable vs unrecoverable** — recoverable (invalid input → 400, provider stall → 503) handled gracefully; unrecoverable (missing config at boot) fails loudly

## Security Baseline

- **No hardcoded secrets** — no credentials, API keys, or tokens in source code, ever (use validated env)
- **Validate all external input** — request body/query/params, file contents, env vars
- **Principle of Least Privilege** — code only has access to what it needs
- **Never log sensitive data** — tokens, PII, raw CV/JD content
- **No string concatenation for queries** — always use the ORM (Prisma parameterized queries)
