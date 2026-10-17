# CVJDMATCHINGWIZARD — Quyết định

## 1. Nguồn

Đọc ngày 2026-10-14 (đường dẫn tính từ gốc app `web-app-match-cv/`).

**Tài liệu:** `docs/README.md`; `docs/01-product/journeys.md` (US-01…05); `docs/02-requirements/scope.md` (FR-01, 03,
04, 05, 11, 21); `docs/02-requirements/nfr.md` (NFR-SEC-01/06/07/09/10/11, NFR-REL-01…04, NFR-PERF-01/06,
NFR-DATA-04/05, NFR-I18N-01/03, NFR-A11Y-02/03/04, NFR-COST-02/04); `docs/03-design/invariants.md` (#2, #4, #5, #7,
#12, #17, #21); `docs/04-state/backlog.md`; `docs/decisions/0014-keyword-tieng-viet-cap-am-tiet.md` (và ADR-0004,
0019, 0022, 0023 qua tham chiếu); `docs/specs/cv-jd-matching-wizard/design.md`, `security-report.md`, `e2e.md`;
`docs/specs/vietnamese-document-support/design.md`; `docs/specs/wizard-responsive/design.md`;
`docs/design-system/match-cv/ux-copy.md`.

**Code server:** `server/src/app.module.ts`, `main.ts`; `modules/documents/{documents.controller.ts,
documents.service.ts, parsing.ts, dto/*}`; `modules/matching/{matching.controller.ts, matching.service.ts,
tokenizer.ts, dto/*}`; `modules/ai/ai.service.ts`; `modules/auth/auth.guard.ts`; `i18n/{en,vi}/{documents,matching,ai}.json`;
`node_modules/@nestjs/common` `MaxFileSizeValidator`.

**Code client:** `routes/_app/wizard.tsx`; `views/Wizard/index.tsx`, `mains/{StepJD,StepCV,StepReview,StepResult}`,
`components/{DocumentInputStep,UploadPasteTabs,SavedDocRadioList,SaveForReuseButton,Stepper,RunWithSelector,MatchResultCard}`,
`ghosts/OpenRunFromUrl`; `components/{DocumentPreview,Readout,SectionCard}`; `stores/slices/wizard.ts`;
`hooks/{useDocuments,useMatch}.ts`; `libs/api.ts`; `constants/fileConstraints.ts`; `i18n/config.ts`;
`locales/{en,vi}/translation.json`; `types/{Matching,AiCredentials}`.

**Test cũ (gợi ý, không phải requirement):** `src/tests/e2e/cv-jd-matching-wizard/*.e2e.ts`,
`src/tests/api/cv-jd-matching-wizard/matching.api.ts`, mục "Gom từ `docs/specs/cv-jd-matching-wizard/e2e.md`" của
`src/test-cases/cv-jd-matching-wizard.md`, `src/docs/migrated-tests.md`.

**Quan sát app (bước 5, chỉ đọc):** `curl` GET tới API dev — `GET /documents` ẩn danh → 401
`{"code":"SIGN_IN_REQUIRED"}`, message theo `?lang=` / `Accept-Language` (mặc định en); `/wizard` → 200. Selector lấy
từ code client đã đọc (testid `stepper-step-N`, `#step-blocked-N`, meter `aria-label`, `aria-busy`, `aria-live`).

**User (2026-10-14, nguyên văn các quyết định ràng buộc, dùng ở mục 2 dưới tên D1–D6):**

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

## 2. Quyết định chốt qua hỏi đáp

- **Q1 — Bước 4 cần LLM thật để chấm.** → Phương án A (D1): UI stub `POST /match` qua fixture `network` (thành công,
  `failed` theo `errorCode`, 503, mất mạng); `POST /documents`, `POST /match/runs`, `GET /match/runs/:id`,
  `GET /match/:id` đi backend thật (kết quả cần đọc lại được seed thẳng vào DB). 3 test `@live-ai` gọi provider thật:
  hợp đồng + công thức điểm + đọc lại (TC-070), so dấu (TC-071), NFC/NFD (TC-072). → REQ-29, 30, 35, 41, 42, 44.
- **Q2 — FR-11 chỉ quan sát qua keywordScore.** → A (D1, D6): REQ-45/46 kiểm dưới `@live-ai` bằng **quan hệ** (bằng
  nhau), không assert con số. REQ-47/48 thành TC manual (D1 giới hạn 2–3 test @live-ai; đã có `tokenizer.spec.ts`).
  Sàn nhiễu tiếng Việt (backlog nợ #1) không test. → REQ-45…48.
- **Q3 — Ngôn ngữ giao diện.** → A (D4): tiếng Việt kiểm qua `window.__i18n` (`BasePage.setLanguage`), API gửi
  `Accept-Language: vi` / `?lang=vi`. Thiếu bộ chuyển ngôn ngữ là nợ, không phải bug. → REQ-49, 50.
- **Q4 — Bấm đúp "Run match" / idempotency.** → A (D4, D6): chỉ yêu cầu ở UI — bấm đúp sinh đúng 1 `POST /match/runs`
  và 1 `POST /match`. Server không idempotent là nợ, không test. → REQ-04, REQ-28.
- **Q5 — Chỗ code lệch doc/NFR.** → A (D2, D6), trừ hai mục D4 loại ra:
  - (a) file đúng 10 MB: server từ chối → BUG-02 (REQ-14).
  - (b) bước 3 quay `review.loading` vô hạn → BUG-06 (REQ-25).
  - (c) danh sách đã lưu lỗi hiện empty state → BUG-04 (REQ-22).
  - (d) khách không được báo bên nhận dữ liệu; `result.disclaimer` không dùng → BUG-05 (REQ-26).
  - (e) `POST /match` không có throttle riêng → **nợ (D4)**, không test; REQ-38 bỏ, mã giữ trống.
  - (f) lỗi class-validator không bản địa hoá → BUG-03 (REQ-20, REQ-49).
  - (g) `GET /documents` không phân trang → **nợ (D4)**, không test.
- **Q6 — Copy chết trong ux-copy.md** (`stepper.progress`, `review.hint`, `wizard.comingSoon`, design.md §2 "bước 3 cho
  sửa"). → A (D3, D6): không test các key này; agent Docs cập nhật `ux-copy.md`; `design.md` để nguyên làm lịch sử.
  Bước 3 chỉ đọc là requirement (REQ-24).
- **Q7 — Chèn lỗi vào endpoint không phải AI** (phát sinh khi viết TC). D1 nói "mọi thứ khác đi backend thật". Chốt:
  trạng thái lỗi được dựng bằng backend thật khi có cách (xoá row trong DB trước khi trang đọc: TC-046, TC-050). Chỉ
  khi backend thật không thể lỗi theo kiểu cần kiểm thì mới chèn lỗi bằng `network.failWith` — duy nhất TC-039
  (`GET /documents` 500). Đây là fault injection, không phải stub dữ liệu. → REQ-22.
- **Q8 — Back giữ dữ liệu** (phát sinh khi đối chiếu design.md §7 hàng 11 với code). Docs nói "back button giữ data";
  code giữ id trong store nhưng ô nạp mount lại trống nên phải nạp lại. Theo D2: requirement là hành vi của docs →
  BUG-01. → REQ-05.
- **Q9 — Test cũ cần xử lý** (`src/docs/migrated-tests.md`, 2 fixme):
  - `[happy] matches CV+JD → 201 with scores + report shape` (fixme, cần FakeAiService) → viết lại thành `@live-ai`
    TC-070 (D1).
  - `POST /match → 503 when AiService.isConfigured() is false` (fixme, cần UnconfiguredAiService) → bỏ khỏi spec, thành
    TC-074 manual: dev server có key hệ thống, dựng server thứ hai không có key chỉ được phép cho auth (D5). UI hiện
    503 đã phủ ở TC-054.
  - `GET /match (list)` → bỏ: lịch sử match là FR-08, ngoài phạm vi module (mục 4).
  - Các spec UI cũ (`happy-path`, `file-validation`, `validation`, `mutation-and-state`, `reuse-and-data-rendering`,
    `review-and-result`, `pdf-preview`, `i18n`, `accessibility`, `responsive`) → gộp theo chủ đề vào `stepper`,
    `document-input`, `saved-documents`, `review`, `result`, `guest`, `i18n`, `accessibility`, `responsive`,
    `happy-path`. Bỏ `cleanDocuments()` trong `beforeEach` (xoá cả DB dùng chung) — thay bằng user riêng mỗi test.
    Bỏ assert `textarea aria-label` ở bước 3 (bước 3 giờ chỉ đọc, REQ-24).
  - `helpers.ts` cũ: giữ tạm dạng DEPRECATED trong lúc các module khác còn import; đã xoá 2026-10-14 khi không còn
    spec nào dùng (cùng lúc với `multi-provider-compare/helpers.ts`).
- **Q10 — Thông báo quyền riêng tư nêu đích danh OpenRouter (user, 2026-10-17, ghi đè cách nói trước).** NFR-DATA-05
  đòi nêu đích danh bên nhận; "System key" không phải tên nhà cung cấp. Trước đây REQ-26 / TC-042 / TC-047 chốt câu
  `credentials.runWith.privacyList` với "System key" ("…sent to: System key."), mâu thuẫn với REQ-MULTIPROVIDERCOMPARE-04/05.
  User chốt: khách thấy `credentials.runWith.privacySystem` ("Your CV and JD text will be sent to OpenRouter using the
  system key."); user đã đăng nhập giữ câu `privacyList`, mục key hệ thống trong danh sách là
  `credentials.runWith.privacySystemEntry` "OpenRouter (system key)" / "OpenRouter (key hệ thống)". Nhãn checkbox vẫn là
  "System key". → REQ-26, TC-042, TC-047 (cùng REQ-AICREDENTIALS-35 / TC-AICREDENTIALS-049); đóng
  BUG-MULTIPROVIDERCOMPARE-03, BUG-MULTIPROVIDERCOMPARE-04.

## 3. Tài khoản test

- **UI:** fixture `wizardUser` (slot `fixtures/modules/cv-jd-matching-wizard.fixture.ts`) tạo một user đăng nhập mới
  cho từng test bằng `createSignedInUser()` (`src/utils/sessions.ts`), thay cookie `mcv_session` của user e2e cố định
  trong context của page, xoá user (cascade tài liệu, run, kết quả) sau test. Lý do: danh sách tài liệu đã lưu, khoá AI
  và run phải bắt đầu rỗng; không phụ thuộc dữ liệu module khác để lại trên user e2e. `wizardApi` = client API của
  chính user đó (seed tài liệu đã lưu, run).
- **Khách:** `guestWizardPage` xoá hết cookie (ẩn danh); `POST /documents` đầu tiên cấp phiên khách; user khách bị xoá
  sau test. `POST /match` luôn stub nên không tốn quota khách.
- **API:** user tạo trong `beforeAll` bằng `createSignedInUser()` / `createUser()` / `createGuestUser()`, xoá trong
  `afterAll`/`finally`. "User khác" có tài liệu/run/kết quả seed thẳng bằng `insertDocument` / `insertMatchRun` /
  `insertMatchResult` (`src/utils/db.ts`).
- Không có mật khẩu: phiên được cắm thẳng vào bảng `Session` (không đi OIDC — D5).

## 4. Ngoài phạm vi

- Thư viện `/cv`, `/jd` (đổi tên, xoá, tải bản gốc, `PATCH /documents/:id/parent` ngoài việc seed) — FR-07, module
  home-dashboard-library / cv-version-comparison.
- Chọn nhiều provider, thẻ hiện dần, partial success, CRUD khoá AI — FR-09/10, module ai-credentials /
  multi-provider-compare. Ở đây chỉ đường key hệ thống một provider.
- Quota khách 429, `SignInGate`, `KeepResultCallout`, `ClaimedNotice`, chuyển dữ liệu khách khi đăng nhập — FR-21,
  module guest-mode.
- Hành vi của "Improve my CV", cover letter, so sánh phiên bản — FR-12/13/14 (ở đây chỉ kiểm nút hiện/ẩn, REQ-43).
- Lịch sử match `GET /match` — FR-08.
- Script `pnpm recompute-scores` (công cụ chạy tay).
- Hạn chế đã chấp nhận của tokenizer: token 1 ký tự, `it` là stopword, CJK dính token; sàn nhiễu tiếng Việt.
- Bàn phím ảo, landscape mobile, safe-area iOS, dark mode trực quan (wizard-responsive/design.md §7 ghi verify tay).
- Kiểm magic number của file upload (follow-up của security-report, chưa làm).
- Nhánh "parse quá 15 s" của REQ-16: không dựng được file chắc chắn chậm qua HTTP; chỉ nhánh trần 2 000 000 ký tự.

## 5. Tech debt liên quan

- Không có throttle riêng cho `POST /match` (NFR-SEC-07) — D4.
- `GET /documents?kind=&saved=` và `GET /match` không phân trang (NFR-PERF-01) — D4.
- Server không idempotent cho `POST /match` / `POST /match/runs` (invariants #5, NFR-REL-02) — D4.
- Không có bộ chuyển ngôn ngữ; lỗi server theo `Accept-Language` của trình duyệt, không theo ngôn ngữ app — D4.
- Thuật ngữ tiếng Việt cho "match" không thống nhất ("so khớp" / "match" / "ghép nối") — D4.
- `capForMatch` (trần 20 000 ký tự, REQ-31) chưa có unit test server; e2e không quan sát được nếu không gọi provider.
