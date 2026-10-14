# COVERLETTERGENERATOR — Quyết định

## Nguồn

Đọc ngày 2026-10-14 (đường dẫn tính từ gốc repo app):

- `automation-testing/src/docs/requirement-sources.md`
- `docs/README.md` · `docs/01-product/journeys.md` · `docs/01-product/glossary.md` · `docs/02-requirements/scope.md`
  (FR-13) · `docs/02-requirements/nfr.md` · `docs/03-design/invariants.md` (#2, #4, #16, #17, #21)
- `docs/decisions/0013-noi-dung-ai-sinh-grounded-user-duyet.md` (ADR-0013) · ADR-0022
- `docs/specs/cover-letter-generator/design.md` · `docs/specs/cover-letter-generator/security-report.md`
- `docs/design-system/match-cv/ux-copy.md` · `README.md` (## Features)
- `server/src/modules/cover-letters/{cover-letters.controller.ts, cover-letters.service.ts, dto/*}`
- `server/src/modules/ai/ai.service.ts` (`generateCoverLetter`, `systemRuntimeConfig`)
- `server/src/modules/ai-credentials/ai-credentials.service.ts` (`getRuntimeConfig`) · `server/src/modules/auth/auth.guard.ts`
- `server/src/app.module.ts` (throttler, `APP_GUARD`) · `server/src/main.ts` (`ValidationPipe({ whitelist })`)
- `server/prisma/schema.prisma` (`CoverLetter`: cascade theo `MatchResult`, `SetNull` theo `AiCredential`)
- `server/src/i18n/{en,vi}/{coverLetters,auth}.json`
- `client/src/views/Wizard/components/{CoverLetterModal, MatchResultCard, Stepper, RunWithSelector}` ·
  `client/src/views/Wizard/{index.tsx, mains/StepResult, mains/StepReview, ghosts/OpenRunFromUrl}` ·
  `client/src/hooks/useCoverLetters.ts` · `client/src/locales/{en,vi}/translation.json`
- Gợi ý (không phải nguồn): test gom lúc scaffold — `src/tests/e2e/cover-letter-generator/*` (6 spec + `helpers.ts`),
  `src/tests/api/cover-letter-generator/cover-letters.api.ts`, mục `## Gom từ docs/specs/cover-letter-generator/e2e.md`.

Quyết định của user, chép nguyên văn (2026-10-14, áp cho mọi module):

> D1 AI: UI tests stub AI responses with page.route (everything else hits the real backend). API tests cover every
> branch that is decided before the AI/provider call. Add 2-3 tests tagged @live-ai that call the real provider
> (contract + score formula overall=round(0.6*semantic+0.4*keyword); Vietnamese scoring comparisons) — they only run
> when LIVE_AI=1. No other test may reach a paid provider or real OIDC.
>
> D2 Bugs: every place the app deviates from a requirement is a BUG: test asserts the REQUIRED behaviour, marked
> test.fail() with "// BUG: defects/<module>.md#bug-<module>-nn" directly above, and the bug is recorded in
> src/defects/<module>.md. Do NOT change app code (client/, server/).
>
> D3 Where the drafts recommend "accept the code, fix the doc": the code is the requirement; docs get updated (by the
> Docs agent).
>
> D4 NFR gaps (no language switcher — vi is tested through window.__i18n dev hook; no stricter rate limit on POST
> /match and export; no pagination on GET /documents and /match; no server idempotency; /health without DB check;
> Swagger in prod; inconsistent Vietnamese term for "match"): backlog debt, NOT bugs, tests do not assert them.
>
> D5 Auth OIDC: the suite runs a fake IdP (discovery + JWKS + token endpoint, RS256) plus a dedicated Match CV server
> instance whose OIDC_* env points at it; other modules keep planting sessions in the DB.
>
> D6 Every other open question in the drafts: apply the option marked (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1 — Đường sinh thư gọi LLM thật, test thế nào?** → (a) + D1: UI stub `POST /cover-letters` trên trình duyệt
  (fixture `coverLetterAi`: stub **ghi đúng row** server sẽ ghi vào DB rồi trả DTO của nó, nên GET / PATCH / DELETE đi
  backend thật — client invalidate và đọc lại danh sách sau mỗi lần sinh, một stub chỉ trả JSON sẽ làm bản nháp biến
  mất). Lỗi GET / PATCH / DELETE / POST-503 dựng bằng `network.failWith` vì là chính điều cần kiểm. API: mọi nhánh trước
  provider chạy thật (401, ownership 404 / `[]`, match failed 400, thứ tự kiểm match→credential, validation, PATCH /
  DELETE trên row seed thẳng vào DB, throttle 429 bằng request ẩn danh). 3 test `@live-ai`: contract 201 bằng key hệ
  thống, thư `vi`, key bị provider từ chối → row failed `invalid_key`. → REQ-05, -10, -11, -13, mọi REQ UI.
- **Q2 — Thông báo quyền riêng tư khi chọn System key ghi "System key" thay vì tên provider** → (a) **bug**: phải dùng
  `credentials.runWith.privacySystem` ("…sent to OpenRouter using the system key") như trang rewrite. → REQ-07,
  BUG-COVERLETTERGENERATOR-01.
- **Q3 — Dòng bản nháp thiếu thời điểm tạo (và provider)** → (a) **bug**: mỗi dòng phải có thời điểm tạo theo locale để
  hai bản cùng tuỳ chọn phân biệt được; provider tuỳ chọn, không kiểm. → REQ-17, BUG-COVERLETTERGENERATOR-02.
- **Q4 — `PATCH { content: "   " }` → 200 lưu thư trắng** → (a) **bug**: trim trước khi kiểm độ dài → 400. → REQ-22,
  BUG-COVERLETTERGENERATOR-03.
- **Q5 — "Try again" dùng tuỳ chọn đang chọn trên Segmented, không phải của bản failed** → (a) **bug**: retry phải dùng
  lại tone / length / language của bản failed đang mở. → REQ-19, BUG-COVERLETTERGENERATOR-04.
- **Q6 — 3 `test.fixme` gom lúc scaffold** (D1):
  - `[EP] generates a letter from an owned, succeeded match` → viết lại thành `@live-ai` TC-COVERLETTERGENERATOR-027.
  - `[EP] a dead provider yields 201 with status=failed…` → `@live-ai` TC-COVERLETTERGENERATOR-029 (credential với key
    giả → provider từ chối → `invalid_key`; không tốn tiền nhưng vẫn chạm provider nên gắn `@live-ai`). Phía UI phủ bằng
    stub TC-COVERLETTERGENERATOR-042.
  - `[grounding] sends the match's gaps as a forbidden list` → **xoá**: prompt gửi provider không quan sát được qua HTTP
    (không còn `FakeAiService.lastPrompt`); hành vi đã có unit test server `cover-letters/prompt.spec.ts` (kể cả chống
    giả mạo marker). Phần người dùng thấy được của grounding (REQ-15) phủ ở TC-COVERLETTERGENERATOR-048.
- **Q7 — Điểm vào UI**: thay luồng wizard + stub `POST /match` của bản cũ (phụ thuộc `multi-provider-compare/helpers`)
  bằng seed `Document` + `MatchRun` + `MatchResult` vào DB rồi mở `/wizard?runId=<id>` — cùng card mà Home mở lại, không
  gọi AI, không phụ thuộc helper của module khác. Riêng "card đang chạy" (TC-032) đi Review → Run match với `POST /match`
  stub có delay.
- **Q8 — REQ-12 (body rỗng / JSON hỏng / cắt 20 000)** chỉ dựng được khi điều khiển được câu trả lời của model; dev
  server trỏ provider thật → TC manual, đã có unit test `server/src/modules/ai/ai.service.spec.ts`. Tương tự 503 khi
  thiếu cấu hình (dev server luôn có `OPENROUTER_API_KEY` + `CREDENTIAL_ENCRYPTION_KEY`) → TC manual; phía UI của 503
  phủ bằng stub (TC-044).
- **Q9 — Bản cũ ghi "AuthN: N/A — chưa có auth"** → lỗi thời: auth đã có (ADR-0022), REQ-02 kiểm 401 cho ẩn danh và khách.
- **Q10 — Bản cũ "draft count 0/1/2 — so sánh chỉ có từ 2"** → bỏ ý "so sánh": dialog không có so sánh; 0 / 1 / 2 bản phủ
  ở TC-045, -039, -040.

## Tài khoản test

- **UI (`tests/e2e/cover-letter-generator`)**: user e2e đã seed bởi project `session` (`.auth/user.json`,
  `utils/auth-state.ts`). Mỗi test seed CV + JD + run + match (và thư, credential) của user này qua fixture
  `coverLetterSeed` và xoá sau test. TC-033 duyệt bằng cookie của một khách tạo bằng `createGuestUser()`.
- **API (`tests/api/cover-letter-generator`)**: mỗi file tạo user riêng bằng `createSignedInUser()` /
  `createGuestUser()` / `createUser()` (`src/utils/sessions.ts`) qua fixture `coverLetterDb`, xoá ở teardown của worker
  (cascade toàn bộ dữ liệu). Credential thật (mã hoá bởi server) tạo qua `POST /ai-credentials` với key giả
  `sk-or-v1-e2e…`, xoá trong `finally`.
- Throttle (TC-026) dùng client ẩn danh `coverLetterRawApi` (429 không bị chờ-lại như client chung).

## Ngoài phạm vi

- Điểm vào từ trang `/history` riêng — trang chưa tồn tại (FR-08 "đang").
- Export `.docx` / `.pdf`, nhiều provider song song cho một lá thư — cố ý không làm (design §1).
- FR-17 nhật ký tiết lộ, FR-16 xoá sạch dữ liệu — chưa làm.
- Chất lượng / độ dài thực tế của thư (150–200 / 300–350 từ) và việc model tuân thủ `MUST NOT CLAIM` — không kiểm được
  bằng E2E; prompt có unit test server (`prompt.spec.ts`).
- Luồng đăng nhập Ducker ID, mang dữ liệu khách — module `auth` / `guest-mode`.
- Throttle theo `userId` (security-report #4) — chưa làm, throttle vẫn theo IP; test chỉ kiểm theo IP.
- Skeleton khi đang tải danh sách (REQ-20): không có hook a11y để quan sát ổn định; TC-050 chỉ kiểm nhánh lỗi.

## Tech debt liên quan

- D4: không có nút đổi ngôn ngữ — `vi` kiểm qua `window.__i18n` (`BasePage.setLanguage`).
- D4: không có idempotency phía server cho `POST /cover-letters` — chỉ UI chặn bấm đúp (TC-041).
- Client chung `http.client.ts` tự chờ `Retry-After` khi 429: các file API của module này gửi khá nhiều POST trong một
  phút nên có thể chờ tới ~60 s; `throttle.api.ts` đặt tên để chạy sau cùng trong module.
