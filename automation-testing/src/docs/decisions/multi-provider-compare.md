# MULTIPROVIDERCOMPARE — Quyết định

Module FR-10 · US-03: chạy một cặp CV/JD trên nhiều provider AI trong một "run", mỗi provider một card, lỗi từng phần.

## Nguồn

Đọc ngày 2026-10-13 – 2026-10-14 (đường dẫn tính từ gốc app repo).

- `automation-testing/src/docs/requirement-sources.md`
- Docs: `docs/README.md`, `docs/01-product/journeys.md` (US-03, US-09), `docs/01-product/overview.md`,
  `docs/02-requirements/scope.md`, `docs/02-requirements/nfr.md` (NFR-COST-01/04, NFR-DATA-04/05, NFR-PERF-05,
  NFR-REL-03/04/05, NFR-SEC-01/07, NFR-I18N-01, NFR-A11Y-03/04), `docs/03-design/invariants.md` (#4, #12, #17),
  `docs/04-state/backlog.md`, `docs/decisions/0010-…`, `0011-…` (ADR-0011 multi-provider), `0023-…` (guest mode),
  `docs/specs/multi-provider-compare/design.md` (D1–D7, §1, §3, §4, §5), `docs/specs/ai-credentials/design.md` (§7, §10),
  `docs/design-system/match-cv/ux-copy.md`, `README.md` (Features).
- Server: `server/src/modules/matching/{matching.controller,matching.service}.ts`, `dto/*.dto.ts`,
  `server/src/modules/ai/ai.service.ts`, `server/src/modules/ai-credentials/ai-credentials.service.ts`,
  `server/src/modules/auth/auth.guard.ts`, `server/src/app.module.ts`, `server/src/i18n/{en,vi}/{matching,ai,aiCredentials}.json`,
  `server/prisma/schema.prisma`.
- Client: `client/src/views/Wizard/{index.tsx, mains/StepReview, mains/StepResult, components/MatchResultCard,
  components/RunWithSelector, components/KeepResultCallout, components/Stepper, ghosts/OpenRunFromUrl}`,
  `client/src/components/{SectionCard,Readout}`, `client/src/stores/slices/wizard.ts`, `client/src/hooks/useMatch.ts`,
  `client/src/libs/api.ts`, `client/src/routes/_app/wizard.tsx`, `client/src/locales/{en,vi}/translation.json`,
  `client/node_modules/antd/es/checkbox/Group.js` (không render `role`).
- Test cũ (gợi ý, không phải nguồn): `src/tests/e2e/multi-provider-compare/*`, `src/tests/api/multi-provider-compare/match-runs.api.ts`,
  mục "Gom từ `docs/specs/multi-provider-compare/e2e.md`" (đã chuyển thành TC, xem `test-cases/multi-provider-compare.md`).

Quyết định của user (2026-10-14, ràng buộc cho mọi module):

> D1 AI: UI tests stub AI responses with page.route (everything else hits the real backend). API tests cover every
> branch that is decided before the AI/provider call. Add 2-3 tests tagged @live-ai that call the real provider
> (contract + score formula overall=round(0.6*semantic+0.4*keyword); Vietnamese scoring comparisons) — they only run
> when LIVE_AI=1. No other test may reach a paid provider or real OIDC.
> D2 Bugs: every place the app deviates from a requirement is a BUG: test asserts the REQUIRED behaviour, marked
> test.fail() … Do NOT change app code.
> D3 Where the drafts recommend "accept the code, fix the doc": the code is the requirement; docs get updated.
> D4 NFR gaps (… no stricter rate limit on POST /match and export; no pagination on GET /documents and /match; no server
> idempotency; …): backlog debt, NOT bugs, tests do not assert them.
> D5 Auth OIDC: … other modules keep planting sessions in the DB.
> D6 Every other open question in the drafts: apply the option marked (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1** `runId` của người khác trên `POST /match`: 400 (design §3.3, §5 row 4) hay 404 (code)? → **(a) giữ 404**
  "Match run not found." (không lộ sự tồn tại, khớp `GET /match/runs/:id`); design §3.3 + §5 row 4 sửa theo code (D3, D6).
  → REQ-21.
- **Q2** F5 giữa lúc chạy về bước 1 thay vì đọc lại run (design D7). → **(a) chấp nhận code**: test khẳng định 0
  `POST /match` sau reload và wizard về bước 1; đọc lại run chỉ qua `/wizard?runId=`; D7 của design sửa theo code (D3).
  → REQ-24, REQ-25.
- **Q3** Lỗi HTTP của một card đều thành "Could not reach the provider." → **(a) bug**: card phải hiện message của
  server cho 4xx/5xx, `unreachable` chỉ cho lỗi mạng (D2, D6). → REQ-20, BUG-MULTIPROVIDERCOMPARE-02.
- **Q4** "Try again" tạo thêm một kết quả; design §1 tự mâu thuẫn. → **(a) giữ Try again, run lưu mọi lần thử** kể cả
  lần lỗi (ADR-0011 "lỗi là dữ liệu"); design §1 bỏ dòng mâu thuẫn (D3). → REQ-19, REQ-33.
- **Q5** `POST /match` không có rate limit riêng (NFR-SEC-07). → **D4 thay (a)**: nợ backlog, không phải bug, không test.
  → không REQ.
- **Q6** Thông báo quyền riêng tư không nêu đích danh provider: (i) khách không thấy thông báo nào ở bước 3; (ii) key
  hệ thống ghi "System key" thay vì OpenRouter. → **(a) bug cả hai** (NFR-DATA-05): khách phải thấy câu
  `credentials.runWith.privacySystem`; danh sách của user phải nêu OpenRouter cho key hệ thống (D2, D6).
  → REQ-04, REQ-05, BUG-MULTIPROVIDERCOMPARE-03, BUG-MULTIPROVIDERCOMPARE-04.
- **Q7** Chạy thật cần LLM. → **D1 thay (a)**: UI stub `POST /match` theo kịch bản theo từng credential (thành công / lỗi /
  chậm / HTTP lỗi); API phủ mọi nhánh trước call AI; nhánh `failed` qua key giả và nhánh `succeeded` (công thức điểm,
  tiếng Việt) chỉ ở 3 test `@live-ai` (key giả cũng là một lần gọi provider thật nên không chạy trong lượt thường).
  → REQ-15, REQ-35.
- **Q8** (phát hiện khi viết test, theo D2) `RunWithSelector` dùng antd `Checkbox.Group`, vốn không render
  `role="group"`; `aria-label` trên một `div` không role không được trình đọc màn hình công bố. Design D4 / §5 row 12
  đòi một nhóm có tên. → **bug**. → REQ-01, BUG-MULTIPROVIDERCOMPARE-05.
- **Q9** (phát hiện khi viết test, theo D2) `MatchResultCard` truyền `aria-busy="true"` cho `SectionCard`, nhưng
  `SectionCard` không chuyển prop đó xuống DOM, nên card đang chạy không có `aria-busy`. → **bug**. → REQ-11, REQ-32,
  BUG-MULTIPROVIDERCOMPARE-01.
- **Q10** Card thứ tự cố định: design §5 row 7 viết "thứ tự user chọn", code (antd sắp theo thứ tự option) cho thứ tự
  dòng trong danh sách. → code là requirement (D3, D6). → REQ-09.
- **Q11** Lỗi đọc run ở bước 4 (REQ-27) chỉ xảy ra khi lần đọc đầu thành công còn lần đọc lại (React Query refetch khi
  mount) thất bại; server thật không tạo được tình huống đó theo ý muốn. → UI stub riêng `GET /match/runs/:id` "lần
  đầu đi backend thật, các lần sau trả lỗi" (fixture `mpcRunReads`), ngoại lệ có chủ ý của D1. Tương tự REQ-25 "lỗi
  khác 404" dùng `network.failWith` 500. → REQ-25, REQ-27.
- **Q12** Lỗi cấu hình 503 (REQ-16) cần một server không có `OPENROUTER_API_KEY` / `CREDENTIAL_ENCRYPTION_KEY`; dev server dùng
  chung có cấu hình đủ và không được khởi động lại. → TC manual. → REQ-16.
- **Q13 — Thông báo quyền riêng tư nêu đích danh OpenRouter (user, 2026-10-17, ghi đè cách nói trước).** Q6 xếp hai
  lỗi là bug nhưng module cv-jd-matching-wizard (REQ-CVJDMATCHINGWIZARD-26, TC-042, TC-047) vẫn chốt "…sent to: System
  key.", nên BUG-03/04 bị treo chờ quyết định. User chốt theo NFR-DATA-05: khách thấy
  `credentials.runWith.privacySystem`; danh sách của user nêu key hệ thống là `credentials.runWith.privacySystemEntry`
  "OpenRouter (system key)" / "OpenRouter (key hệ thống)". REQ/TC của module kia đã cập nhật theo. → REQ-04, REQ-05,
  BUG-MULTIPROVIDERCOMPARE-03, BUG-MULTIPROVIDERCOMPARE-04 (đã sửa).

## Tài khoản test

- **UI (project `app`, `app-tablet`, `app-mobile`)**: không dùng user e2e chung. Fixture `mpcUser` tạo một user đăng
  nhập riêng cho từng test (`createSignedInUser`, `src/utils/sessions.ts`), cắm cookie phiên của nó vào context của
  trang (thay phiên user e2e), và xoá user khi test xong — cascade tài liệu, run, kết quả, credential. Nhờ vậy credential
  hay tài liệu module khác để lại không đổi lựa chọn mặc định ở bước 3. Credential tạo qua `mpcCredentials` (API thật,
  key giả không bao giờ được gửi đi vì `POST /match` bị stub); run để mở lại tạo qua `mpcSeed` (tài liệu + run qua API,
  kết quả chèn DB bằng `insertMatchResult`).
- **Khách (UI)**: fixture `guestCompareWizardPage` xoá cookie; khách được mint ở `POST /documents` đầu tiên và bị xoá
  khi test xong. `POST /match` luôn bị stub nên không trừ quota thật.
- **API**: mỗi file tạo user riêng qua `src/utils/sessions.ts` (`createSignedInUser`, `createGuestUser`, `createUser`
  cho "người khác"), xoá trong `afterAll`. Run / kết quả của người khác và kết quả cũ seed bằng `src/utils/db.ts`
  (`insertMatchRun`, `insertMatchResult`).
- **`@live-ai`**: user riêng như API; dùng key hệ thống của dev server và một credential OpenRouter mang key giả.

## Ngoài phạm vi

- CRUD credential, test connection, nhãn trạng thái test và cảnh báo "credential chưa test" ở bước 3 → module
  `ai-credentials` (case cũ "[EP] an untested credential is warned about, not blocked" bỏ khỏi module này vì vậy).
- Engine chấm điểm (tokenizer, embedding) và bước 1–2 của wizard → `cv-jd-matching-wizard`; ở đây chỉ kiểm công thức
  điểm và chấm tiếng Việt qua `@live-ai` theo D1.
- So sánh giữa các card, nhiều CV cho một JD (FR-19), hàng đợi / streaming — cố ý không làm (design §1, ADR-0011).
- Nhật ký tiết lộ dữ liệu theo provider (FR-17), trang lịch sử match / xoá match (FR-08), xoá run — chưa có.
- Quota khách thật (đếm theo IP, reset, claim khi đăng nhập), và 429 qua API → `guest-mode`. Làm cạn quota của IP
  localhost sẽ chặn test khách của module khác tới hết ngày UTC, nên ở đây 429 chỉ kiểm ở UI bằng stub. Ghi chú cho
  `guest-mode`: code trừ quota **trước** khi kiểm tài liệu / run, nên một request sai (400) của khách vẫn mất một lượt.
- Hành vi của action trên card (Improve my CV, Write cover letter, Compare versions) → `cv-rewrite-assistant`,
  `cover-letter-generator`, `cv-version-comparison`; ở đây chỉ kiểm sự có mặt.
- Thứ tự Tab chi tiết giữa danh sách → Add credential → xem trước tài liệu → Back → Run match: phụ thuộc nội dung xem
  trước; chỉ kiểm mỗi checkbox tới được và bật/tắt được bằng bàn phím.

## Tech debt liên quan

- (D4) `POST /match` không có ngưỡng rate limit riêng chặt hơn (chỉ mức toàn cục 100/60 s), trái NFR-SEC-07; với N
  provider mỗi run là N request nên ngưỡng phải tính theo N.
- (D4) `GET /match` không phân trang.
- (D4) Không có idempotency phía server cho `POST /match/runs` / `POST /match`; chống bấm đúp chỉ nằm ở client (nút
  loading).
- (D4) Thuật ngữ tiếng Việt cho "match" không thống nhất ("so khớp" / "ghép nối" / "đối chiếu" / "match").
- (D3) Docs cần sửa theo code: design §3.3 + §5 row 4 (404 cho run của người khác), D7 (reload mất run), §1 (bỏ dòng
  "chạy lại một card lỗi" ngoài phạm vi), §5 row 7 (thứ tự card = thứ tự danh sách).
