---
name: standard-security
description: Application security standards (OWASP Top 10 2025) for this NestJS + Prisma backend — input validation & DTO whitelisting, access control / per-user scoping, secrets via validated env, Prisma parameterized queries, helmet, throttler/rate-limit, file-upload validation, safe error handling, and logging. TRIGGER — read when writing or reviewing any code handling user input, access control, sensitive data, file uploads, external requests (OpenRouter), or config.
user-invocable: false
---

> Sources: OWASP Top 10 2025, NIST SP 800-63-4, Mozilla Security Guidelines, OWASP Cheat Sheets.

## Backend = trust boundary

The server is the last line of defense — **never rely on the client for security**. Weight these first for this codebase:

- **Access control / ownership** — every query scoped by `userId`; deny by default.
- **Input validation** — global `ValidationPipe` + class-validator DTOs; validate/normalize ALL external input.
- **Injection** — Prisma parameterized queries only; no raw SQL string-building.
- **Secrets** — validated env via `ConfigService`; never raw `process.env` scattered, never in source/logs.
- **Rate limiting & resource caps** — global throttler; file/text/AI-input size caps.
- **Safe errors & logging** — no stack traces/PII to clients; no secrets/CV-JD content in logs.

---

## Security Mindset

- **Least Privilege** — every component gets the minimum it needs.
- **Defense in Depth** — assume any single control fails (e.g. `ParseFilePipe` mimetype check **and** a defensive re-check in `parseFile`).
- **Fail Securely** — on a failed check, deny by default; never fail open (e.g. AI failure → 503, not silently return an empty/mock report).
- **Zero Trust** — authenticate/authorize every request (auth deferred in MVP via stub `CurrentUserService`, but scoping is already enforced).

---

## OWASP Top 10 2025 — applied

### A01 Broken Access Control (#1)

- **Enforce ownership server-side on every request.** Every Prisma query filters by the current `userId`:
  ```ts
  const userId = this.currentUser.getUserId();
  const doc = await this.prisma.document.findFirst({ where: { id, userId } });
  if (!doc) throw new NotFoundException(tDoc("documents.errors.notFound", "…"));
  ```
- Cross-resource ops verify **all** inputs belong to the user (see `MatchingService.createMatch` checking both `cvDoc`/`jdDoc` ownership + kind).
- A record owned by someone else → return 404, don't leak existence.
- IDs are opaque UUIDs, not sequential ints — no enumeration.
- **SSRF**: the only server-side outbound is OpenRouter (fixed, config-driven base URL). Never fetch a URL taken from user input; if that's ever added, whitelist hosts and block internal/metadata ranges (`169.254.169.254`, `127.0.0.1`, RFC1918).

### A02 Security Misconfiguration

- `helmet()` applied globally in `main.ts` (security headers). Keep it.
- CORS = explicit origin whitelist from env (`CLIENT_ORIGIN`), `credentials: true` — **never `*`** for a credentialed API.
- No debug/verbose errors to clients (Nest default filter returns minimal body). Never expose stack traces or DB errors.

### A03 Software Supply Chain

- Prisma pinned exactly (`6.19.3`) — v7 is breaking. Prefer exact/careful ranges for security-critical deps; commit the lockfile.
- Run `yarn npm audit` (or `npm audit`) before releases; review dependency bumps.

### A04 Cryptographic Failures

- No custom crypto. TLS in transit for all external calls (OpenRouter is HTTPS). When auth ships: Argon2id/bcrypt for passwords, CSPRNG (`crypto.randomBytes`) for tokens — never `Math.random()`.

### A05 Injection

- **Prisma query builder is parameterized** — safe by default. Pass user values as `where`/`data` fields, never build query strings.
- Do NOT use `$queryRawUnsafe` or string interpolation. If raw is unavoidable, use tagged-template `$queryRaw` / `Prisma.sql`.
- All input shape-validated by class-validator before the service (`@IsUUID`, `@IsEnum`, `@MaxLength`).

### A06 Insecure Design

- Rate limiting + size caps designed in, not bolted on. Threat-model new attack surface (uploads, AI, future auth) at design time.

### A07 AuthN Failures / A08 Integrity

- Auth deferred (MVP) — `CurrentUserService` is a documented stub. When implemented: server-side session/JWT validation on every request, deny by default. Do not deserialize untrusted data without validation (AI JSON output is parsed then field-coerced via `toStringArray`, not trusted raw).

### A09 Logging & Monitoring

- Log security-relevant events (validation failures, access denials) — **never** log secrets, tokens, or raw CV/JD text (PII).

### A10 Mishandling Exceptional Conditions

- Every external/expensive op has a **timeout** and fails to a safe status: AI stall/failure → `ServiceUnavailableException` (503) via `withTimeout`; file parse stall → `BadRequestException` via `withParseTimeout`.
- Handle null/empty/oversized input: empty text → 400; extracted text over `MAX_EXTRACTED_CHARS` (~2MB) → 400; AI input capped at 20k chars.

---

## Input Validation & Resource Limits (this project)

- **Global `ValidationPipe({ whitelist: true, transform: true })`** — strips unknown fields (mass-assignment defense) + coerces DTO types. Every DTO field is explicitly decorated.
- **File uploads** (`ParseFilePipe`): allowlist MIME (`application/pdf`, DOCX), max 10MB, `fileIsRequired: false`. Defense-in-depth: `parseFile` re-checks mimetype and enforces a parse **wall-time timeout** + extracted-size cap (mitigates zip-bomb / pathological files — full worker-thread isolation noted as future hardening).
- **Size caps everywhere**: pasted text `@MaxLength(100_000)`; title `@MaxLength(200)`; AI input `MAX_MATCH_CHARS = 20_000` (bounds cost/latency). Enforce a max request body size at the platform level too.

## Secrets Management

- **Never hardcode secrets.** `OPENROUTER_API_KEY` and `DATABASE_URL` come from env, validated at boot by `validateEnv`.
- Read secrets via **`ConfigService.get(...)`** inside providers — not raw `process.env` scattered through modules.
- `.env.example` holds keys + placeholders only; never commit real secrets. Never log the API key, DB URI, or tokens.

## Rate Limiting

- Global `ThrottlerGuard` via `APP_GUARD` (`ttl 60s / limit 100`). Tighten per-route for expensive/abusable endpoints (`/match` calls a paid AI provider) and, once added, auth endpoints.

## DO NOT

- Query without a `userId` scope on user-owned data
- Read raw `@Body`/`@Query`/`@Param` bypassing DTO/pipe validation
- Use `$queryRawUnsafe` or string-concatenated queries
- Hardcode secrets or read scattered `process.env` in modules
- Return stack traces, DB errors, or internal paths to clients
- Log secrets, tokens, or raw CV/JD content
- Use `*` CORS for the credentialed API
- Accept unbounded uploads / text / pagination
- Fail open — a failed check must deny (return 4xx/5xx), not proceed

## Review Checklist (blocking)

- [ ] Access to user-owned data not scoped by `userId`
- [ ] Input reaching a service without DTO/pipe validation
- [ ] Raw/unsafe SQL with user input
- [ ] Secret in source or logged; raw `process.env` in a module
- [ ] Stack trace / internal detail in an error response
- [ ] File upload without MIME + size validation
- [ ] Outbound (AI) call without timeout
- [ ] Wildcard CORS on the credentialed API
