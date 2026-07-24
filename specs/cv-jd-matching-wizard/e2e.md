# E2E — `cv-jd-matching-wizard` (Plan 1: wizard step 1–2, Plan 2: step 3–4)

> Dual-gate §4.3. Nguồn scenario: `design.md` §7 E2E Scenario Matrix. Plan 1 scope = step 1–2; Plan 2 mở rộng step 3 (Review) + step 4 (Result). Auth rows N/A (auth defer). Ngày: 2026-07-24.

## Gates

- **Gate A — committed Playwright suite**: `client/e2e/cv-jd-matching-wizard/*.e2e.ts`, chạy `cd client && npx playwright test` (serial `workers:1`, no auto webServer — cần server :5200 + client :5300 chạy). **Kết quả (Plan 1): 21 passed / 0 failed. Kết quả (Plan 2, sau khi thêm `review-and-result.e2e.ts` + sửa `happy-path.e2e.ts`): 25 passed / 0 failed** (full suite, single run).
- **Gate B — MCP walk** (Playwright MCP, browser thật): walk step 1 (JD reuse radio) → step 2 (CV empty-state), verify render + BE integration (reuse list fetch từ backend) + **0 console errors** (sau khi thêm `@ant-design/v5-patch-for-react-19`). **PASS** (Plan 1 scope). Step 3–4 gate-B walk (route-stubbed, giống Gate A) chưa chạy trong task này — xem "Deferred / notes".

## Test data isolation

Backend dùng **1 stub current-user** (shared). Tests đụng empty-state/reuse dọn DB `beforeEach` (`e2e/db-cleanup.ts` → `DELETE FROM "Document"`), global-setup/teardown dọn đầu/cuối run. DB dev — an toàn truncate. `review-and-result.e2e.ts` cũng `beforeEach` clean DB (step 1–2 trong đó tạo document thật).

## Route-stub cho matching engine (Plan 2)

Không có `GEMINI_API_KEY` cấu hình cho môi trường này, và **không có runtime mock** theo thiết kế (server thật sự gọi Google Gemini, 503 nếu thiếu key). Step 3 "Run match" / step 4 "Result" test do đó **BẮT BUỘC** route-stub qua Playwright `page.route`, KHÔNG gọi `/match` thật:

- `POST /api/v1/match` → **201** fixed `MatchResultDto` (`STUB_MATCH_RESULT`, `client/e2e/cv-jd-matching-wizard/helpers.ts`).
- `GET /api/v1/match/:id` → **200** cùng fixture.
- Step 1–2 (tạo `jdDocId`/`cvDocId` qua `POST /documents`, prefill step 3 qua `GET /documents/:id`) **vẫn gọi backend thật** — các endpoint này không phụ thuộc Gemini nên an toàn, đồng thời cho `resolveDocId` (StepReview) tái dùng id thật thay vì tạo document rỗng.

## Scenario → test map

| Rubric row (design.md §7) | Scenario | Test | Gate |
|---|---|---|---|
| 1 Happy | Paste JD → step2 → paste CV → step3 (Review, nội dung thật) | `happy-path.e2e.ts` | A+B |
| 1 Happy (Plan 2) | Step3 Review → **Run match** (route-stubbed) → step4 Result render overall%/semantic/keyword + strengths/gaps/suggestions | `review-and-result.e2e.ts` | A (xem "Deferred / notes" cho gate B) |
| 2 AuthN | N/A — auth defer (stub user, no redirect/401) | — | — |
| 3 AuthZ (role) | N/A — candidate/recruiter đều dùng wizard | — | — |
| 3/11 Per-user isolation | BE-only (client luôn là stub user) → cover ở `server/test/documents.e2e-spec.ts` (2-user) | (BE test) | A |
| 4 Validation | [EP] wrong-type `.exe`/`.png` reject; [BVA] size >10MB reject; [DT] type>size precedence; valid `.pdf` accept | `file-validation.e2e.ts` | A |
| 4/6 Validation (paste) | [BVA] empty paste → Next disabled; 1 char → enabled; **Save-for-reuse modal** requires a name (empty → inline error) + shows description + saves on confirm | `validation.e2e.ts` | A |
| 5 Empty state | "No saved job descriptions yet" (step1) / "No saved CVs yet" (step2) | `reuse-and-data-rendering.e2e.ts` | A+B |
| 6 Boundary / step guard | Back disabled step1; step3 active + stepper step1/2 "done", step4 "idle" | `happy-path.e2e.ts`, `review-and-result.e2e.ts` | A+B |
| 7 Filter/search | N/A — reuse là radio list đơn giản, không search (MVP) | — | — |
| 8 Data rendering | sourceFormat label ("text") not raw enum; no JSON dump; step4 overallScore/semanticScore/keywordScore render `NN%` (không phải số thập phân), strengths/gaps/suggestions render bullet list từ report (không phải JSON) | `reuse-and-data-rendering.e2e.ts`, `review-and-result.e2e.ts` | A |
| 9 i18n | EN default + VI (stepper, step title, empty state, buttons); round-trip; no missing-key leak; **step4 result labels EN + VI** ("Overall match"/"Mức khớp tổng", "Start over"/"Làm lại", ...) qua `window.__i18n` | `i18n.e2e.ts`, `review-and-result.e2e.ts` | A+B |
| 10 Error/loading | Parse/validation error inline; (API 5xx / 503 Gemini-unavailable → covered ở BE test + `StepResult.test.tsx` component test, không re-test ở E2E vì cần fail thật/mock DI phía server) | `validation.e2e.ts` (inline error) | A |
| 11 Mutation/state | [ST] step1→2→Back giữ state; repeated cycles ổn định; saved JD reuse radio-select; **step3→Back→step2**; **step4 "Start over" reset về step1** (clear jdDocId/cvDocId/matchId) | `mutation-and-state.e2e.ts`, `reuse-and-data-rendering.e2e.ts`, `review-and-result.e2e.ts` | A |
| 12 a11y | radiogroup có role/label; Next/Back button roles; stepper testids; step3 review textareas có `aria-label` (Job Description / CV / Resume) | `accessibility.e2e.ts`, `review-and-result.e2e.ts` | A+B |

## Deferred / notes

- **File upload wrong-type/oversize**: cover client-side (DocumentInputStep `handleFileChange` validate + inline error) qua `file-validation.e2e.ts`. Server-side type/size validation cover ở `server/test/documents.e2e-spec.ts`.
- **i18n language switcher UI**: chưa có (Plan 2) → test đổi locale qua dev-only hook `window.__i18n` (guard `import.meta.env.DEV`, không có ở production build).
- **Step 3–4 (Review/Result), Plan 2**: nội dung thật (không còn placeholder) — cover đầy đủ ở `review-and-result.e2e.ts` (route-stubbed `/match`, xem "Route-stub cho matching engine" ở trên).
- **LIVE (real-Gemini) smoke — DEFERRED, KHÔNG phải silent gap**: `review-and-result.e2e.ts` chỉ verify FE render với response **stub**; chưa có test nào gọi `POST /match` thật (Gemini) end-to-end vì môi trường hiện tại **không có `GEMINI_API_KEY`** (server trả `503` nếu thiếu key — theo API Contract Plan 2). Khi key có sẵn: thêm 1 scenario gate-B "live smoke" (MCP walk thật, KHÔNG route-stub) chạy full step1→4 với JD/CV thật, verify `POST /match` trả `201` thật (không stub) + report hợp lý (overall/semantic/keyword trong [0,100], strengths/gaps/suggestions non-empty) — ghi PASS/FAIL vào bảng Gates phía trên khi chạy. Cho tới lúc đó, coverage cho "real Gemini integration" nằm ở BE e2e-spec (Task E4, `overrideProvider` mock GeminiService) chứ không phải ở Gate A/B của suite này.
- Không có `e2e-bugs.md` round nào cần ghi cho gate A cuối (các fail trong quá trình phát triển suite: antd Segmented selector + SSR hydration race + test-data contamination — đều là test-infra, đã fix; app không có bug behavior). Plan 2 extension (`review-and-result.e2e.ts` + sửa `happy-path.e2e.ts` cho content thật step3) cũng pass ngay lần chạy đầu — không có round fix nào cần ghi.
