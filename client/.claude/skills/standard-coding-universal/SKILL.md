---
name: standard-coding-universal
description: Language-agnostic code standards applicable to all stacks and all agent types (code generation, review, refactoring). Load this skill alongside any stack-specific coding standard.
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
- Boolean variables must be phrased as yes/no: `isValid`, `hasPermission`, `canEdit`
- Function names must be verbs: `getUser`, `validateInput`, `sendEmail`
- Class/type names must be nouns: `UserService`, `OrderProcessor`, `PaymentResult`
- Magic numbers → use named constants

## Function Design

- **Single responsibility** — one function does one thing
- **Max ~40 lines of logic** per function — extract if exceeded (excluding boilerplate/setup)
- **Max 3 parameters** — group into an object/struct if more are needed
- **Pure functions** when possible — minimize side effects
- **Early return** — return immediately on failure conditions, avoid deep nesting
- **Rule of Three** — logic appearing 3+ times must be extracted into a shared function. Two occurrences may be acceptable — prefer duplication over premature abstraction

## Module Design

- **High cohesion** — group related logic together, keep unrelated logic separate
- **Low coupling** — modules should depend on abstractions, not concrete implementations
- **Single direction** — avoid circular dependencies between modules

## Comments

- Never comment what the code already says
- Comments explain **why**, not what
- `TODO` and `FIXME` must include a ticket/issue reference — no open-ended comments
- Dead code must be deleted, never commented out

## Error Handling

- **Never swallow errors** — empty catch blocks are forbidden
- **Fail fast** — detect errors as early as possible, do not let them propagate silently
- **Error messages must include context** — what failed, why, and ideally what to do
- **Never expose internal details** outside the system boundary (stack traces, DB schema, internal paths)
- **Distinguish recoverable vs unrecoverable** — recoverable errors (invalid input, network timeout) should be handled gracefully; unrecoverable errors (corrupted state, missing config) should fail loudly

## Security Baseline

- **No hardcoded secrets** — no credentials, API keys, or tokens in source code, ever
- **Validate all external input** — user input, API responses, file contents, env vars
- **Principle of Least Privilege** — code only has access to what it needs
- **Never log sensitive data** — passwords, tokens, PII, payment details
- **No string concatenation for queries** — always use parameterized queries or ORM
