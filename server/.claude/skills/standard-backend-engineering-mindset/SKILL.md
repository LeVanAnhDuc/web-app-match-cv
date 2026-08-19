---
name: standard-backend-engineering-mindset
description: Language-agnostic backend engineering principles — resilience, observability, data integrity, layering/separation of concerns, and architecture decisions — applied to this NestJS + Prisma backend. TRIGGER — read when designing a feature or module, making an architecture/data-model decision, or reviewing backend code for correctness and production reliability. Load alongside standard-nestjs / standard-prisma.
user-invocable: false
---

> Sources: 8 Fallacies of Distributed Computing, Martin Fowler, Google SRE Book, Designing Data-Intensive Applications (Kleppmann).

## The Core Job of a Backend

> "The fundamental job of a backend is to reliably manage, process, and distribute state (data) and logic in response to requests."

Evaluate every decision — module boundary, data model, external call — against: does it make state management more reliable, correct, or efficient?

---

## Layering — never cross boundaries (NestJS)

```
Controller  → parse/validate input (DTO + pipes), delegate to service, map/return DTO. NO business logic, NO Prisma.
Service     → business logic, orchestrate Prisma + collaborators, scope by userId. NO HTTP objects (no req/res).
Data (Prisma) → data access only. Service calls this.prisma.*; no business rules live in the query.
External    → wrapped provider (AiService) with timeout + failure translation.
```

- The controller is thin (`DocumentsController.findOne` = one delegating line). The service holds the logic (`DocumentsService`, `MatchingService`). Pure sub-logic is extracted to helper files (`parsing.ts`, `tokenize`/`cosine`).
- Each layer knows only the layer directly below. A service takes primitives/DTOs and returns DTOs — never `Request`/`Response`.

## Coupling & Cohesion

- **High cohesion**: a module does one thing completely (`documents/` owns document upload/parse/list; `matching/` owns scoring + report).
- **Low coupling** via DI: depend on injected abstractions, not `new`. Cross-module use = export/import a provider (see `module-struct`).
- **Acyclic dependencies**: A→B→C, never C→A. Circular DI is a design smell — extract shared logic to `src/common/`.
- Test: could you lift a module into its own package without dragging half the repo? `AiService` is a clean, swappable seam behind `MatchingService`.

---

## Assume Failure, Design for Recovery

- **Every outbound call has a timeout.** No exceptions. This repo: `AI_TIMEOUT_MS = 20s` (`withTimeout`), `PARSE_TIMEOUT_MS = 15s` (`withParseTimeout`). An unbounded call can cascade into resource exhaustion.
- **Fail to a safe status, loudly**: AI unconfigured/stalled/failed → `ServiceUnavailableException` (503); bad file → `BadRequestException` (400). **No silent fallback/mock** — matching genuinely requires the provider.
- **Graceful degradation**: a dependency failing should degrade one feature (`/match`), not collapse the app — the service boots without `OPENROUTER_API_KEY`; only `/match` 503s, every other endpoint works.
- **Retry** only transient failures (408/429/5xx/timeout) with backoff; never retry 4xx (400/401/403/404/409/422). Bound the retry budget.
- **Idempotency**: `GET`/`PUT`/`DELETE` are idempotent by definition; make sensitive `POST` idempotent where it matters. `seed.ts` uses `upsert` — safe to re-run.

---

## Data Integrity — correctness over convenience

- **Default to strong consistency (ACID)** — PostgreSQL transactions. Relax only with a documented reason.
- **Multi-step writes → one transaction** (`prisma.$transaction`). Keep transactions short; **never call an external API (OpenRouter, file parse) inside a transaction** — do that first, then wrap only the DB writes.
- **Validate before it touches the DB** — global `ValidationPipe` + per-user scoping.
- **Backward-compatible migrations only** — additive changes; rename/drop via expand → backfill → contract across separate deploys. Never drop a column an in-flight deploy still reads.
- **Avoid N+1** — batch with `Promise.all` (the two embeddings, the two document lookups) or a single query with the right `@@index`. Match query patterns to indexes (`Document @@index([userId, kind])`).

---

## Observability — build it in

- **Structured logging** (JSON) — use Nest's `Logger`, include request/trace context. Never log secrets, tokens, or raw CV/JD text (PII).
- Instrument inbound latency/status, outbound (AI) latency/failure, DB error rate. Define SLOs before incidents (e.g. p99 of `/match`).
- A crash that surfaces loudly beats silent data corruption.

---

## Architecture — start simple, earn complexity

- **Modular monolith first.** This app is exactly that: feature modules under `src/modules/**`, shared infra in `src/common` / `src/prisma` / `src/config`. Extract a service only under measured pressure (release contention, scaling hotspot), not "might need it".
- **YAGNI** the roadmap: pgvector, BullMQ/Redis, SSO are deliberately deferred until there's real need — synchronous matching + in-app cosine is enough for 1 CV × 1 JD.
- **Evolutionary**: refactoring module structure as it grows is normal. Record non-obvious decisions (ADR-style) — e.g. why cosine is computed in-app, why AI has no mock fallback.
- **Stateless services**: providers are singletons holding no per-request state; per-user identity flows through `CurrentUserService`, state lives in Postgres.

---

## Performance — measure before optimizing

- Common backend problems, in impact order: **N+1 queries, missing indexes, sync calls that should be async/parallel.** Check the query the ORM generates.
- Cap payloads (upload 10MB, text 100k, AI input 20k) — bandwidth and provider cost are real.
- Parallelize independent awaits (`Promise.all`); don't serialize independent I/O.

---

## DO NOT

- Put business logic in a controller, or Prisma calls outside the service layer
- Let a service touch `req`/`res` (HTTP concepts leak into business logic)
- Make an outbound call without a timeout
- Call an external API inside a DB transaction
- Retry a non-retryable 4xx
- Write an N+1 loop instead of a batched query
- Ship a non-backward-compatible migration in one step
- Add a queue/cache/service boundary before measuring the need
- Log sensitive data; return raw entities or stack traces

---

## Review Checklist

**Blocking**

- [ ] Outbound (AI/parse) call missing timeout
- [ ] External call inside a DB transaction
- [ ] Business logic in controller / Prisma call outside service
- [ ] Multi-step write without transaction protection
- [ ] Retry on a non-retryable status
- [ ] Migration not backward compatible

**Warning**

- [ ] Service references HTTP request/response
- [ ] N+1 query pattern where a batch/`Promise.all` fits
- [ ] Query without a supporting index for its filter/sort
- [ ] Unstructured logging / missing request context
- [ ] Consistency model chosen implicitly (silent eventual consistency)

**Suggestion**

- [ ] Independent awaits not parallelized
- [ ] New expensive endpoint without an SLO
- [ ] Non-obvious design decision not recorded as an ADR
