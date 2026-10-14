# CVVERSIONCOMPARISON — Quyết định

## 1. Nguồn

Đọc ngày 2026-10-14 (đường dẫn tính từ gốc app `web-app-match-cv/`):

- `automation-testing/src/docs/requirement-sources.md`
- Tài liệu: `docs/README.md`, `docs/01-product/journeys.md` (US-06, US-09), `docs/01-product/glossary.md`,
  `docs/02-requirements/scope.md` (FR-14), `docs/02-requirements/nfr.md` (NFR-DATA-04, NFR-COST-02, NFR-A11Y-01/02/04,
  NFR-I18N-01/02/03, NFR-REL-03, NFR-SEC-10), `docs/03-design/invariants.md` (#4, #8–#12, #15, #19, #21),
  `docs/decisions/README.md` (ADR-0015, ADR-0022), `docs/specs/cv-version-comparison/design.md`,
  `docs/specs/cv-version-comparison/security-report.md`, `docs/design-system/match-cv/ux-copy.md`, `README.md` (## Features)
- Server: `server/src/modules/comparison/{comparison.controller.ts, comparison.service.ts, lineage.ts, gap-diff.ts,
  dto/comparison-query.dto.ts, dto/cv-comparison.dto.ts}`, `server/src/modules/documents/{documents.controller.ts,
  documents.service.ts, dto/set-document-parent.dto.ts}`, `server/src/modules/auth/auth.guard.ts`,
  `server/src/app.module.ts` (throttle), `server/prisma/schema.prisma`, `server/src/i18n/{en,vi}/{comparison,documents,auth}.json`
- Client: `client/src/routes/_app/compare.$documentId.tsx`, `client/src/views/CvComparison/**`,
  `client/src/components/{Readout, DocumentRow, DocumentLineageModal, RequireAuth, SignInGate}`,
  `client/src/views/{CvLibrary, JdLibrary}/**`, `client/src/hooks/{useCvLibrary, useComparison}.ts`,
  `client/src/views/Wizard/{index.tsx, mains/StepResult, mains/StepReview, components/MatchResultCard}`,
  `client/src/stores/slices/wizard.ts`, `client/src/locales/{en,vi}/translation.json`
- Gợi ý (không phải nguồn): kịch bản và spec gom về lúc scaffold (`docs/specs/cv-version-comparison/e2e.md`,
  `client/e2e/cv-version-comparison/*`, `server/test/comparison.e2e-spec.ts`)
- Quan sát live: chỉ `GET` ẩn danh (`/api/v1/comparisons/<uuid>` → 401 `{code:"SIGN_IN_REQUIRED"}`, header
  `X-RateLimit-Limit: 100`). Khám phá UI bằng trình duyệt có seed dữ liệu bị chặn (không được ghi vào DB dùng chung khi
  12 agent chạy song song), nên selector suy từ code; xác nhận ở lượt chạy.

User (2026-10-14, nguyên văn các quyết định áp cho module này):

> D1 AI: UI tests stub AI responses with page.route (everything else hits the real backend). API tests cover every
> branch that is decided before the AI/provider call. Add 2-3 tests tagged @live-ai that call the real provider
> (contract + score formula overall=round(0.6*semantic+0.4*keyword); Vietnamese scoring comparisons) — they only run
> when LIVE_AI=1. No other test may reach a paid provider or real OIDC.
> D2 Bugs: every place the app deviates from a requirement is a BUG: test asserts the REQUIRED behaviour, marked
> test.fail() … the bug is recorded in src/defects/<module>.md. Do NOT change app code.
> D3 Where the drafts recommend "accept the code, fix the doc": the code is the requirement; docs get updated (by the
> Docs agent).
> D4 NFR gaps (no language switcher …; no stricter rate limit on POST /match and export; no pagination on GET /documents
> and /match; no server idempotency; /health without DB check; Swagger in prod; inconsistent Vietnamese term for
> "match"): backlog debt, NOT bugs, tests do not assert them.
> D5 Auth OIDC: the suite runs a fake IdP … other modules keep planting sessions in the DB.
> D6 Every other open question in the drafts: apply the option marked (Khuyến nghị) / (a).

## 2. Quyết định chốt qua hỏi đáp

- **Q1 — Dữ liệu test lấy từ đâu?** → **(a)** (D6): seed `Document` + `MatchResult` (+ `MatchRun`) thẳng vào DB rồi chạy
  **live** cả API lẫn UI; trình duyệt chỉ stub 5xx, mất kết nối và phản hồi chậm. Lý do: suite cũ stub toàn bộ
  `**/api/v1/comparisons/*` nên logic chọn kết quả, ghép gap, delta, version của server không được E2E chạm tới.
  Ảnh hưởng: mọi REQ; cách seed ở `fixtures/modules/cv-version-comparison.fixture.ts`.
- **Q2 — Header không có ngày tạo, khối điểm chỉ hiện điểm bản mới (lệch design §5.1 / §7 row 1b, 8).** → **(a)** (D3):
  code là requirement; design.md được Docs agent sửa. Ảnh hưởng: REQ-13 (không ngày), REQ-15 (chỉ điểm mới + delta).
- **Q3 — Cảnh báo khác model chỉ nêu chat model.** → **(a)** bug (D6, D2): hint phải nêu model thực sự khác.
  Ảnh hưởng: REQ-16 → BUG-CVVERSIONCOMPARISON-01.
- **Q4 — FE đoán lý do lỗi 400 theo `?jd`; lineage modal gộp mọi 400.** → **(a)** bug (D6, D2): BE trả `code` cho từng
  lớp 400, FE map theo code và hiển thị đúng lý do. Ảnh hưởng: REQ-06, REQ-20, REQ-23, REQ-25 →
  BUG-CVVERSIONCOMPARISON-02 (BE), -03 (trang so sánh), -04 (modal). Test không đòi tên `code` cụ thể, chỉ đòi có và
  khác nhau; với `notCv` / `lineageTooDeep` không đòi câu chữ cụ thể (FE chưa có copy), chỉ đòi **không** phải câu sai.
- **Q5 — Định dạng delta âm / bằng 0** (design dùng `−` U+2212 và "0 không mũi tên"). → **(a)** (D3): chấp nhận code —
  `-6` gạch nối ASCII, `0` không có `+`, icon gạch ngang cạnh 0 là được. Ảnh hưởng: REQ-15. Docs agent sửa design.md.
- **REQ-28 focus của modal** (design §7 row 12, không có câu hỏi riêng): giữ là requirement; code không đặt focus →
  BUG-CVVERSIONCOMPARISON-05 (D2). Phần "ngày giờ theo locale" của draft bỏ vì Q2 = (a) — trang không hiện ngày.
- **REQ-10 phần vượt biên**: draft chỉ nói "đi tối đa 20 bước". Chốt: chuỗi tới 21 phiên bản cho số đúng; dài hơn chỉ
  đòi trả lời 200 (con số khi vượt biên là hệ quả của giới hạn an toàn, không phải hành vi sản phẩm).

Xử lý test gom về lúc scaffold:

| Test cũ | Thành |
|---|---|
| `api/comparison.api.ts` (13 test, không có fixme) | tách theo chủ đề vào `access` / `comparison-contract` / `result-selection` / `lineage` — TC-002, 005, 007, 008, 014, 016, 022, 023, 024; file cũ xoá |
| `e2e/helpers.ts` (stub toàn bộ comparison / saved docs / parent) | xoá — Q1 = (a); seed ở fixture, locator ở `pages/cv-version-comparison/` |
| `happy-path.e2e.ts` (7) | TC-032 (gồm hàng không có bản trước), 038, 041 (a11y gộp vào 038/041), 050, 051 |
| `validation-and-data.e2e.ts` (13) | TC-054, 055, 053, 045, 047, 042, 039, 048, 049, 041 (`[object Object]`), 043, 071, 072 |
| `error-and-mutation.e2e.ts` (7) | TC-056, 057, 052, 060, 065, 063, 064 |
| "ScoreDelta 61% bị cố ý bỏ" (confirmed 2026-09-07) | khớp Q2 = (a): TC-038 assert không có điểm cũ |
| Row 1(d) "điểm vào từ step 4 chỉ phủ FE unit" | nay E2E: TC-034, 035 qua `/wizard?runId=` (đọc kết quả lưu, không gọi AI) |
| Row 2/3 AuthN/AuthZ "N/A" | nay có: TC-001…004, 036 |

Module không có `test.fixme` nào trong `src/docs/migrated-tests.md`.

## 3. Tài khoản test

- Mỗi test tạo **một user đăng nhập riêng** bằng `createSignedInUser()` (`src/utils/sessions.ts`) qua fixture `cvcSeed`,
  seed tài liệu / match / run cho user đó, và xoá user ở teardown (cascade xoá session, tài liệu, run, match). Lý do:
  thư viện `/cv` chỉ chứa dữ liệu của chính test, không lẫn dữ liệu module khác gắn vào user e2e chung.
- UI: page fixture (`versionComparePage`, `versionLibraryPage`, `versionWizardPage`) thay cookie của storage state
  `.auth/user.json` bằng cookie của user đó; `cvcSignIn(undefined)` đăng xuất trình duyệt (cổng đăng nhập),
  `cvcSignIn(guest.cookie)` đăng nhập bằng session khách (`createGuestUser()`).
- "User khác" (IDOR) và "khách": `cvcSeed.otherUser()` / `cvcSeed.guest()`, xoá cùng user chính.
- `@live-ai`: cùng user riêng, `POST /match` không `credentialId` (system key của dev server, cần `OPENROUTER_API_KEY`).

## 4. Ngoài phạm vi

- So sánh hai `MatchResult` bất kỳ, so > 2 phiên bản, dashboard xu hướng, chạy match từ trang so sánh — cố ý không làm (design §1).
- Ngưỡng ghép gap ở biên 0.49 / 0.5, best-first, alias tokenizer, gap rỗng chủ đề — unit test server `gap-diff.spec.ts`;
  E2E chỉ assert các ví dụ bắt buộc của REQ-12 và giới hạn 50.
- Race hai PATCH đồng thời tạo vòng 2 nút (security-report L1, chấp nhận) và N+1 khi đi tổ tiên (L2).
- `DELETE /match/:id` (FR-08 chưa xong) — không có đường dọn dữ liệu so sánh từ UI.
- Caveat dữ liệu cũ chưa chạy `recompute-scores` (invariant #8) — vận hành.
- Luồng đăng nhập Ducker ID (module auth, fake IdP — D5); ở đây chỉ cổng + 401.
- Đếm request vượt throttle 100/60 s — chỉ assert header `X-RateLimit-Limit` (TC-019), không bắn 101 request vào dev
  server dùng chung.

## 5. Tech debt liên quan (D4 — không phải bug, test không assert)

- Không có nút đổi ngôn ngữ: tiếng Việt test qua dev hook `window.__i18n` (TC-071, 072).
- Không có rate limit chặt hơn cho `POST /match` (lối "Match this version" dẫn tới đó) — module này chỉ assert throttle global.
- `GET /documents` không phân trang — thư viện và danh sách bản trước của modal lineage tải toàn bộ.
- Không có idempotency phía server cho `PATCH /documents/:id/parent` — chống double-click chỉ nằm ở FE (TC-064).
- Thuật ngữ tiếng Việt cho "match" không thống nhất ("Match phiên bản này", "Chưa phiên bản nào được match").
- Docs cần sửa theo D3 (Docs agent): design.md §5.1 bước 3 (ngày tạo) và §5.1 bước 5 / §7 row 6 (điểm cũ → mới, `−`
  U+2212, "0 không mũi tên").
