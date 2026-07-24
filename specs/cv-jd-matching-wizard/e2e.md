# E2E — `cv-jd-matching-wizard` (Plan 1: wizard step 1–2)

> Dual-gate §4.3. Nguồn scenario: `design.md` §7 E2E Scenario Matrix (Plan 1 scope = step 1–2). Auth rows N/A (auth defer). Ngày: 2026-07-24.

## Gates

- **Gate A — committed Playwright suite**: `client/e2e/cv-jd-matching-wizard/*.e2e.ts`, chạy `cd client && npx playwright test` (serial `workers:1`, no auto webServer — cần server :5200 + client :5300 chạy). **Kết quả: 21 passed / 0 failed.**
- **Gate B — MCP walk** (Playwright MCP, browser thật): walk step 1 (JD reuse radio) → step 2 (CV empty-state), verify render + BE integration (reuse list fetch từ backend) + **0 console errors** (sau khi thêm `@ant-design/v5-patch-for-react-19`). **PASS.**

## Test data isolation

Backend dùng **1 stub current-user** (shared). Tests đụng empty-state/reuse dọn DB `beforeEach` (`e2e/db-cleanup.ts` → `DELETE FROM "Document"`), global-setup/teardown dọn đầu/cuối run. DB dev — an toàn truncate.

## Scenario → test map

| Rubric row (design.md §7) | Scenario | Test | Gate |
|---|---|---|---|
| 1 Happy | Paste JD → step2 → paste CV → step3 placeholder | `happy-path.e2e.ts` | A+B |
| 2 AuthN | N/A — auth defer (stub user, no redirect/401) | — | — |
| 3 AuthZ (role) | N/A — candidate/recruiter đều dùng wizard | — | — |
| 3/11 Per-user isolation | BE-only (client luôn là stub user) → cover ở `server/test/documents.e2e-spec.ts` (2-user) | (BE test) | A |
| 4 Validation | [EP] wrong-type `.exe`/`.png` reject; [BVA] size >10MB reject; [DT] type>size precedence; valid `.pdf` accept | `file-validation.e2e.ts` | A |
| 4/6 Validation (paste) | [BVA] empty paste → Next disabled; 1 char → enabled; save ON no title → blocked inline error | `validation.e2e.ts` | A |
| 5 Empty state | "No saved job descriptions yet" (step1) / "No saved CVs yet" (step2) | `reuse-and-data-rendering.e2e.ts` | A+B |
| 6 Boundary / step guard | Back disabled step1; step3/4 disabled placeholder | `happy-path.e2e.ts` | A+B |
| 7 Filter/search | N/A — reuse là radio list đơn giản, không search (MVP) | — | — |
| 8 Data rendering | sourceFormat label ("text") not raw enum; no JSON dump | `reuse-and-data-rendering.e2e.ts` | A |
| 9 i18n | EN default + VI (stepper, step title, empty state, buttons); round-trip; no missing-key leak | `i18n.e2e.ts` | A+B |
| 10 Error/loading | Parse/validation error inline; (API 5xx → covered ở BE test) | `validation.e2e.ts` (inline error) | A |
| 11 Mutation/state | [ST] step1→2→Back giữ state; repeated cycles ổn định; saved JD reuse radio-select | `mutation-and-state.e2e.ts`, `reuse-and-data-rendering.e2e.ts` | A |
| 12 a11y | radiogroup có role/label; Next/Back button roles; stepper testids | `accessibility.e2e.ts` | A+B |

## Deferred / notes

- **File upload wrong-type/oversize**: cover client-side (DocumentInputStep `handleFileChange` validate + inline error) qua `file-validation.e2e.ts`. Server-side type/size validation cover ở `server/test/documents.e2e-spec.ts`.
- **i18n language switcher UI**: chưa có (Plan 2) → test đổi locale qua dev-only hook `window.__i18n` (guard `import.meta.env.DEV`, không có ở production build).
- **Step 3–4** (Review/Result): placeholder ("Coming in Plan 2") → chỉ assert disabled; nội dung thật thuộc Plan 2.
- Không có `e2e-bugs.md` round nào cần ghi cho gate A cuối (các fail trong quá trình phát triển suite: antd Segmented selector + SSR hydration race + test-data contamination — đều là test-infra, đã fix; app không có bug behavior).
