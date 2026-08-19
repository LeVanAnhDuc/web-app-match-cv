# Multi-Provider Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Run one CV↔JD pair through several AI providers at once and show each result as it lands, with a failing provider costing only its own card.

**Architecture:** A `MatchRun` groups N `MatchResult` rows. The client creates the run, then fires N independent `POST /match` calls — one per chosen credential — and each step-4 card owns its own request, so progressive reveal falls out for free with no queue, stream, or polling (ADR #11).

**Tech Stack:** NestJS + Prisma (BE) · TanStack Start + antd + TanStack Query (FE). No new dependency.

**Spec:** `docs/specs/multi-provider-compare/design.md`

## Global Constraints

- Worktrees on `feat/multi-provider-compare`, branched from `origin/main` **after** `ai-credentials` merged. Never commit to `main`.
- **`errorCode` is a closed set** — `invalid_key | no_quota | model_unavailable | timeout | unreachable`. It must never carry a provider's raw message (key-leak risk, `ai-credentials` security invariant §5.3).
- **A provider failure is a 201 with `status=failed`**, not a 503. 503 stays only for configuration errors (missing system key, missing encryption key).
- **Route order**: `GET /match/runs/:id` must be declared before `GET /match/:id`.
- Every result row keeps its own `provider` / `chatModel` / `embedModel` snapshot — cards read attribution from the row, never from the credential list.
- BE gate: `yarn format && yarn lint && yarn type-check && yarn test && yarn test:e2e && yarn build`.
- FE gate: `yarn format && yarn lint && yarn type-check && yarn test && yarn build`, plus Playwright.
- Conventions: `server/.claude/CLAUDE.md` and `client/.claude/CLAUDE.md` + their rules.

## File Structure

| File | Responsibility |
|---|---|
| `server/prisma/schema.prisma` + migration | `MatchRun`, `MatchStatus`, three `MatchResult` columns |
| `server/src/modules/ai/ai.service.ts` | Throw a classifiable `AiProviderError` instead of a bare 503 |
| `server/src/modules/matching/matching.service.ts` | Create runs; persist failures; validate `runId` ownership |
| `server/src/modules/matching/dto/*` | `CreateMatchRunDto`, `MatchRunDto`, `MatchRunDetailDto`; extend `CreateMatchDto` + `MatchResultDto` |
| `client/src/views/Wizard/components/RunWithSelector/` | One dropdown → a checkbox list |
| `client/src/views/Wizard/components/MatchResultCard/` | One result: skeleton · result · error |
| `client/src/views/Wizard/mains/StepResult/` | N cards; collapse the report when N > 1 |

---

### Task 1: Schema + migration

**Files:** `server/prisma/schema.prisma`; `server/prisma/migrations/<ts>_add_match_run/migration.sql`

**Produces:** Prisma `MatchRun`, enum `MatchStatus`, and `MatchResult.runId | status | errorCode`.

- [ ] **Step 1** — Add `enum MatchStatus { succeeded failed }` and the `MatchRun` model (design §3.1). Add `runs MatchRun[]` to `User`, and the two named relations to `Document`.
- [ ] **Step 2** — Add to `MatchResult`: `runId String?` + relation `onDelete: Cascade`, `status MatchStatus @default(succeeded)`, `errorCode String?`.
- [ ] **Step 3** — `npx prisma migrate dev --name add_match_run`. Unlike `add_ai_credential`, no hand-editing is needed: `runId`/`errorCode` are nullable and `status` has a default, so existing rows backfill on their own.
- [ ] **Step 4** — Verify: existing rows read back `status = succeeded`, `runId = null`.
- [ ] **Step 5** — Gate + commit.

---

### Task 2: Make provider failures classifiable

**Files:** `server/src/modules/ai/ai.service.ts`, `ai.service.spec.ts`

**Produces:** `AiProviderError` (carries an `AiTestStatus`), thrown by `embed` and `generateReport`.

Today both methods swallow everything into one 503, so the caller cannot tell `no_quota` from `unreachable`. `MatchingService` needs that distinction to fill `errorCode`.

- [ ] **Step 1: failing test** — `embed()` rejects with an `AiProviderError` whose `status` is `no_quota` when the SDK throws a 429; `unreachable` on a socket error; `timeout` when the call exceeds `AI_TIMEOUT_MS`.
- [ ] **Step 2** — Run, expect failure.
- [ ] **Step 3** — Add `export class AiProviderError extends ServiceUnavailableException` carrying `readonly reason: AiTestStatus`. Build it from `mapProviderError`, with a dedicated `timeout` reason from `withTimeout`. Keep the i18n 503 message so **any caller that does not catch it behaves exactly as before**.
- [ ] **Step 4** — Run, expect pass. Confirm `matching.e2e-spec`'s unconfigured case still gets 503.
- [ ] **Step 5** — Gate + commit.

---

### Task 3: Runs — service, DTOs, controller

**Files:** `server/src/modules/matching/{matching.service.ts,matching.controller.ts}`, `dto/{create-match-run.dto.ts,match-run.dto.ts,match-run-detail.dto.ts,create-match.dto.ts,match-result.dto.ts}`, `matching.service.spec.ts`, `i18n/{en,vi}/matching.json`

**Produces:** `createRun(dto)`, `getRun(id)`; `createMatch` accepts `runId` and persists failures.

- [ ] **Step 1: failing tests** in `matching.service.spec`:
  - provider throws → a row is created with `status: "failed"`, the mapped `errorCode`, zeroed scores and an empty report — and `createMatch` **does not** reject;
  - a `runId` belonging to another user → `NotFoundException`;
  - a `runId` whose documents differ from the request → `BadRequestException`;
  - a successful run stores `status: "succeeded"` and `errorCode: null`.
- [ ] **Step 2** — Run, expect failure.
- [ ] **Step 3** — Implement `createRun` (ownership + kind check on both documents, then insert) and `getRun` (`findFirst({ where: { id, userId }, include: { results: … } })`, 404 otherwise). Wrap the engine call in `createMatch` per design §3.3.
- [ ] **Step 4** — Add i18n keys `matching.errors.runNotFound` and `matching.errors.runDocumentMismatch` in `en` + `vi`.
- [ ] **Step 5** — Controller: `POST /match/runs`, then `GET /match/runs/:id` **above** `GET /match/:id`. Add `@ApiCreatedResponse`/`@ApiOkResponse`.
- [ ] **Step 6** — Run, expect pass. Gate + commit.

---

### Task 4: Backend e2e

**Files:** `server/test/match-runs.e2e-spec.ts`; update `server/test/matching.e2e-spec.ts`

**The existing matching e2e asserts 503 when the AI fails — that expectation is now wrong** (design D3). Update it to assert a persisted `failed` row, and keep a separate 503 case for the unconfigured system key.

- [ ] **Step 1** — Write `match-runs.e2e-spec.ts`: create a run → two matches under it → `GET /match/runs/:id` returns both with distinct providers; a run id from another user → 404; a `runId` pointing at other documents → 400; a pre-existing row with `runId = null` still readable via `GET /match/:id`; a failing provider yields `201` with `status: "failed"` and an `errorCode` from the closed set — and the response body contains no provider message.
- [ ] **Step 2** — Reconcile `matching.e2e-spec.ts` with the new contract.
- [ ] **Step 3** — `yarn test:e2e`. Gate + commit.

---

### Task 5: Frontend data layer

**Files:** `client/src/types/Matching/index.ts`, `src/constants/endpoints.ts`, `src/requests/match.ts`, `src/hooks/useMatch.ts`, `src/stores/slices/wizard.ts`

**Produces:** `MatchStatus`, `MatchRunDto`, `MatchRunDetailDto`; `createMatchRun`, `fetchMatchRun`, `matchRunQueryKey`; `useCreateMatchRun`, `useMatchRun`; store fields `credentialIds: Array<string | null>`, `runId`, `pendingCredentialIds`.

- [ ] **Step 1** — Types + endpoints (`matchRuns`, `matchRunById`).
- [ ] **Step 2** — Requests + hooks, mirroring `aiCredentials.ts`.
- [ ] **Step 3** — Store: replace `credentialId` with `credentialIds` (`null` inside the array means the system key), add `runId` and `pendingCredentialIds`; `reset()` clears all three.
- [ ] **Step 4** — Gate + commit.

---

### Task 6: Step 3 — multi-select

**Files:** `client/src/views/Wizard/components/RunWithSelector/index.tsx` + its test; `client/src/views/Wizard/mains/StepReview/index.tsx`; locales

- [ ] **Step 1: failing tests** — nothing selected → Run match disabled and no request; default selects the newest `lastUsedAt`; with no credentials the system key is selected; selecting two then unselecting one leaves one; the privacy notice names **every** selected provider; the CTA states the count.
- [ ] **Step 2** — Run, expect failure.
- [ ] **Step 3** — Rewrite as an antd `Checkbox.Group` (`role="group"` + accessible name), one row per credential plus a System key row. `onChange` writes `credentialIds`.
- [ ] **Step 4** — `StepReview`: `Run match` calls `useCreateMatchRun`, stores `runId` + `pendingCredentialIds`, then `goNext()`. On failure it stays on step 3 with an alert.
- [ ] **Step 5** — Locales `en` + `vi`: `credentials.runWith.*` count/CTA/privacy-multi keys.
- [ ] **Step 6** — Run, expect pass. Gate + commit.

---

### Task 7: Step 4 — N cards

**Files:** `client/src/views/Wizard/components/MatchResultCard/index.tsx` + test; `client/src/views/Wizard/mains/StepResult/index.tsx` + test; locales

- [ ] **Step 1: failing tests** — a card renders skeleton while pending, the result when resolved, and an error with a Try-again button on `status: "failed"`; a failed card does **not** render "0%"; `StepResult` renders one card per pending credential; with N = 1 the report is expanded, with N > 1 collapsed; without `pendingCredentialIds` it reads the run instead of firing.
- [ ] **Step 2** — Run, expect failure.
- [ ] **Step 3** — Extract today's gauge/score/report markup out of `StepResult` into `MatchResultCard`, which takes `{ runId, credentialId, autoRun, initialResult }` and owns one `useRunMatch` mutation fired on mount when `autoRun`.
- [ ] **Step 4** — `StepResult` maps over `pendingCredentialIds` (autoRun) or over `useMatchRun(runId).data.results` (reload path). `aria-busy` while pending; the results region is `aria-live="polite"`.
- [ ] **Step 5** — Locales: five `errorCode` messages + Try again + empty state, `en` + `vi`.
- [ ] **Step 6** — Run, expect pass. Gate + commit.

---

### Task 8: Playwright suite

**Files:** `client/e2e/multi-provider-compare/{helpers,happy-path,validation,rendering,i18n,error-and-loading,mutation-and-a11y}.e2e.ts`; `docs/specs/multi-provider-compare/e2e.md`

One test per ✅ row of design §5. Providers are stubbed with `page.route` on `POST /match` — **regex, not glob** (the `ai-credentials` suite learned that a wildcard path segment does not match reliably).

- [ ] **Step 1** — helpers: `createRunViaApi`, `stubMatch(page, perProviderVerdict)`, `resetMatches`.
- [ ] **Step 2–7** — one file per matrix group.
- [ ] **Step 8** — Run the **whole** desktop suite, not just the new files: the contract change in Task 3 can break existing wizard specs.
- [ ] **Step 9** — Write `e2e.md` with the matrix → test mapping and the gate B status. Commit.

---

### Task 9: Docs, README, then PR

- [ ] **Step 1** — `erd.md`: `MatchRun` and the three columns lose their 📝.
- [ ] **Step 2** — `project-goals.md`: drop the §12 open question on capping providers; Roadmap #9 → DONE; Goal 6 fully ✅.
- [ ] **Step 3** — `server/README.md`: the two new endpoints and the 503 → 201 contract change.
- [ ] **Step 4** — `unfinished-features.md` #4: note that `MatchRun` is now the foundation for comparing two runs.
- [ ] **Step 5** — Full gates on both repos, then three PRs and squash-merge.

## Self-Review

**Spec coverage.** design §3.1 → Task 1; §3.3 `classify` → Task 2; §3.2 + §3.3 → Task 3; §6 BE tests → Tasks 3–4; §4 → Tasks 5–7; §5 matrix → Task 8; §7 → Task 9.

**Type consistency.** `MatchStatus` is defined once in Prisma (Task 1), mirrored once in `types/Matching` (Task 5), and consumed with the same member names in Tasks 6–7. `AiProviderError.reason` is an `AiTestStatus` — deliberately the same enum the credential test already uses, so the five `errorCode` values and the five test-status values stay one vocabulary with one set of translations.

**Riskiest step.** Task 3's contract change. Task 4 exists specifically to reconcile the existing e2e expectations rather than let them fail late in Task 8.
