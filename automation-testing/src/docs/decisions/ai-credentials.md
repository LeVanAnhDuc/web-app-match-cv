# AICREDENTIALS — Quyết định

## Nguồn

Đọc ngày 2026-10-13/14 (đường dẫn tính từ gốc app `web-app-match-cv/`):

- `automation-testing/src/docs/requirement-sources.md`
- `docs/README.md`, `docs/01-product/journeys.md` (US-03, US-09), `docs/01-product/overview.md`, `docs/02-requirements/scope.md`
  (FR-09), `docs/02-requirements/nfr.md` (NFR-SEC-01, -07, -08, -09, -10, NFR-DATA-04, NFR-REL-03, NFR-I18N-01,
  NFR-A11Y-02, -03, -04), `docs/03-design/invariants.md` (#2, #4, #5, #12, #17, #21), `docs/04-state/backlog.md` (nợ #7)
- ADR-0009 (mã hoá key), ADR-0010 (whitelist provider), ADR-0011, ADR-0022, ADR-0023
- `docs/specs/ai-credentials/design.md` (D3, D5–D8, §4.2–4.7, §5.1–5.8, §6, §7 Scenario Matrix, §8),
  `docs/specs/ai-credentials/security-report.md`, `docs/design-system/match-cv/ux-copy.md`, `README.md` (Features)
- Server: `server/src/modules/ai-credentials/**` (controller, service, 5 DTO), `server/src/modules/ai/{ai.service,providers}.ts`,
  `server/src/common/crypto/credential-crypto.service.ts`, `server/src/modules/matching/{matching.controller,matching.service}.ts`
  + DTO, `server/src/modules/auth/auth.guard.ts`, `server/src/app.module.ts`, `server/src/main.ts`,
  `server/src/i18n/{en,vi}/{aiCredentials,ai,matching,auth}.json`, `server/prisma/schema.prisma`,
  `server/node_modules/@nestjs/throttler` (cách đếm và reset của bucket)
- Client: `client/src/routes/_app/ai-credentials.tsx`, `components/RequireAuth`, `views/AiCredentials/**`,
  `components/CredentialFormModal`, `components/TestStatusTag`, `hooks/useAiCredentials.ts`, `requests/aiCredentials.ts`,
  `views/Wizard/{index,mains/StepReview,components/RunWithSelector,components/UploadPasteTabs}`,
  `layouts/AppShell/components/Sidebar`, `locales/{en,vi}/translation.json`
- Quan sát app đang chạy (2026-10-14, user tạm tự xoá): cây accessibility của trang, modal tạo/sửa, Popconfirm, step 3;
  focus khi mở modal; `aria-describedby` của lỗi validate; kích thước nút ở 390 px; `GET /api/v1/docs-json`.
- Test gom về lúc scaffold (gợi ý, không phải requirement): `src/tests/e2e/ai-credentials/*` (6 spec + `helpers.ts`),
  `src/tests/api/ai-credentials/credentials.api.ts` (từ `server/test/ai-credentials.e2e-spec.ts`), mục `## Gom từ
  docs/specs/ai-credentials/e2e.md` trong `src/test-cases/ai-credentials.md`.

Nguồn gốc từng REQ: 01 (ADR-0022/0023, invariant #21, `RequireAuth`); 02 (invariant #21, `auth.guard.ts`); 03 (NFR-SEC-01,
NFR-DATA-04, invariant #2 #4, design §5.7, security-report IDOR, `findOwned`); 04 (design §4.5, controller); 05 (design §6,
Sidebar); 06 (design §6, e2e.md "phát hiện" #2); 07 (design §7 row 10, NFR-REL-03); 08 (design §6, §7 row 1a/5); 09 (§7
row 10); 10 (§4.5, §7 row 6–7, `list`); 11 (§6, §7 row 5/8/12, `CredentialRow`); 12 (§7 row 5/8, `TestStatusTag`, Q5);
13 (NFR-SEC-09, invariant #17, §5.8); 14 (ADR-0010, §4.2, §4.5); 15 (§6, `CredentialFormModal`); 16 (§7 row 4/6, Q1, Q2);
17 (NFR-SEC-01, §5.6, DTO, Q1); 18 (NFR-SEC-09, §4.5, §5.1); 19 (NFR-SEC-09/10, invariant #17, §8); 20 (NFR-SEC-08,
ADR-0009, §4.3); 21 (§5.7, §7 row 4, `@@unique([userId,label])`); 22 (invariant #5, §7 row 11); 23 (D8, §6 — nhánh lỗi
lưu khác 409 khi sửa chỉ thấy trong code, giữ theo D3); 24 (§5.8, §6); 25 (D5, §4.5, §5.6); 26 (§4.5, §7 row 11); 27 (§6,
§7 row 12); 28 (invariant #12, §4.4); 29 (D3, §4.6, `worstStatus`); 30 (§4.6, §5.3, `mapProviderError`); 31 (§7 row 1c);
32 (NFR-SEC-07, §5.5, `TEST_THROTTLE`); 33 (D7, §4.3, `requireCrypto`); 34 (§6, multi-provider-compare D4,
`RunWithSelector`); 35 (§6, §7 row 1d/5, `pickDefault` — nhánh "mới tạo nhất" chỉ thấy trong code, giữ theo D3); 36 (D6,
`untestedCount_*`); 37 (§8 FE unit, effect của `RunWithSelector`); 38 (invariant #12, §4.7, `createMatch` / `markUsed` —
"kể cả khi failed" chỉ thấy trong code, giữ theo D3); 39 (§5.6, §7 row 11, ADR-0023); 40 (NFR-I18N-01, §7 row 9);
41 (NFR-A11Y-02/04, §7 row 12); 42 (NFR-A11Y-03, nợ #7); 43 (NFR-SEC-10, §5.4).

## Quyết định chốt qua hỏi đáp

Người dùng chốt ngày 2026-10-14 (D1–D6, áp cho cả bộ test); các câu hỏi trong nháp của module lấy phương án
(Khuyến nghị)/(a) theo **D6**.

- **Q1 — Label chỉ gồm khoảng trắng được lưu thành tên rỗng** (server `@Length(1,60)` trước khi trim, form chỉ có
  `required`). → **(a)** là bug (D2): test khẳng định `"   "` → 400 (server) và bị form chặn, label đệm 60 ký tự → 201.
  Ảnh hưởng: REQ-AICREDENTIALS-16, -17 · BUG-AICREDENTIALS-01, -02.
- **Q2 — Ô model ở client chặt hơn server và báo sai câu.** → **(a)** giữ rule không-khoảng-trắng ở client (vô hại);
  câu "Use at most 60 characters" cho giới hạn 120 là bug copy; BVA model 120/121 kiểm qua API. Ảnh hưởng:
  REQ-AICREDENTIALS-16, -17 · BUG-AICREDENTIALS-03.
- **Q3 — Test connection cần provider thật.** → theo **D1** (thay phương án (a) của nháp ở phần API): UI giả
  `POST /ai-credentials/:id/test` cho mọi trạng thái; API phủ mọi nhánh trước khi gọi provider (401, 400, 404, chủ sở
  hữu) và throttle 10/phút bằng UUID không tồn tại; đúng hai test `@live-ai` chạm provider thật, đều bằng key giả nên
  provider trả 401 (không tốn tiền): TC-AICREDENTIALS-041 (hợp đồng `/test` + phân loại `invalid_key` + lưu kết quả) và
  TC-AICREDENTIALS-052 (match bằng credential: snapshot + `lastUsedAt` khi `failed`). Phân loại 402/429/404/timeout/DNS
  và thứ tự "nặng nhất" cần provider giả → TC manual, đã có unit test ở server. Ảnh hưởng: REQ-AICREDENTIALS-29, -30,
  -31, -32, -38.
- **Q4 — 503 thiếu khoá mã hoá.** → **(a)** UI giả 503 ở trình duyệt để kiểm câu `notConfigured`; API không dựng instance
  thứ hai (TC-AICREDENTIALS-045 manual). Ảnh hưởng: REQ-AICREDENTIALS-09, -33, -14 (nhánh "chạy khi thiếu khoá").
- **Q5 — Mốc thời gian khi `null`.** → **(a)** theo **D3**: code là requirement — không hiện "—", không hiện `lastUsedAt`
  trên dòng; chỉ yêu cầu không bao giờ "Invalid Date"/ô lạ. `design.md` §7 row 5 cần sửa (Docs agent). Ảnh hưởng:
  REQ-AICREDENTIALS-12.
- **Q6 — Dữ liệu UI cô lập thế nào** (nảy ra khi chuẩn hoá: suite cũ `DELETE FROM "AiCredential"` toàn bảng trước mỗi
  test, xoá cả credential của module khác). → mỗi test UI dùng một user tạm riêng (`aiCredUser`, cookie phiên của user
  đó thay cookie user e2e trong context của test), xoá user sau test (cascade). Không còn câu SQL nào xoá toàn bảng.
- **Q7 — `test.fixme` gom về (7), quyết theo D1/D5:**
  - "runs without CREDENTIAL_ENCRYPTION_KEY" (kiểm `isConfigured()` in-process) → **xoá**: chỉ có nghĩa khi suite tự dựng
    app; suite HTTP dùng khoá của server dev.
  - "the key is stored as ciphertext" → **viết lại chạy thật** (TC-AICREDENTIALS-023) không có bước giải mã ngược: suite
    không giữ khoá của server. Giải mã đúng được chứng minh gián tiếp ở TC-AICREDENTIALS-041/052 (provider nhận đúng key
    giả nên trả 401, không phải lỗi khác).
  - "rotating the key clears the verdict" và "renaming alone keeps the verdict" → **viết lại chạy thật**
    (TC-AICREDENTIALS-032): kết quả kiểm tra được đóng dấu vào DB thay vì gọi `/test` (luật reset chỉ nhìn field của PATCH).
  - "reports chat and embed separately and stores the worse" → chia: hợp đồng + lưu kết quả → `@live-ai`
    TC-AICREDENTIALS-041; hiển thị hai dòng chat/embed khác nhau → UI giả (TC-AICREDENTIALS-024); thứ tự nặng nhất →
    manual TC-AICREDENTIALS-044.
  - "every endpoint → 503" và "providers still works without key" → **xoá**, thành TC manual TC-AICREDENTIALS-045 (Q4).
- **D2 — Bug:** đang mở BUG-AICREDENTIALS-01…06 (xem `src/defects/ai-credentials.md`), mỗi cái một test `test.fail()`.
  BUG-04 (focus khi mở modal) và BUG-05 (nhóm "Run with" không có role) là lệch so với `design.md` §7 row 12 mà suite cũ
  báo đạt vì kiểm bằng `getByLabel`; BUG-06 là nợ #7 đã biết nhưng NFR-A11Y-03 không nằm trong danh sách D4.
- **Kịch bản cũ bỏ đi:** "step 4 shows which provider and model produced the result" và "running a match with a
  since-deleted credential surfaces the error" (kết quả từng card, partial success) thuộc module multi-provider-compare;
  module này chỉ giữ khối "Chạy bằng" của step 3 và snapshot ở tầng API. "testing an existing credential replaces the
  'Not tested' chip" (gọi OpenRouter thật từ UI) → thay bằng TC-AICREDENTIALS-039 (giả + đóng dấu DB) và
  TC-AICREDENTIALS-041 (`@live-ai` ở API).

## Tài khoản test

- **UI:** không dùng user e2e chung. Fixture `aiCredUser` (`src/fixtures/modules/ai-credentials.fixture.ts`) tạo một user
  đã đăng nhập bằng `createSignedInUser()` (`src/utils/sessions.ts`: dòng `User` + `Session`, cookie `mcv_session`),
  thay cookie của context trình duyệt bằng cookie đó, đưa kèm client API của user, rồi xoá user sau test (cascade sang
  credential, tài liệu, kết quả match). Test "không có tài khoản" chạy với storage state rỗng.
- **API:** mỗi file tạo user riêng trong `beforeAll` qua fixture `aiCredData` (`createSignedInUser`, `createGuestUser`,
  `createUser` cho "người khác" chỉ sở hữu dữ liệu) và xoá trong `afterAll`. Credential của người khác được chèn thẳng DB
  với ciphertext ngẫu nhiên (không bao giờ giải mã).
- **Key:** `FAKE_KEY` / `ROTATED_KEY` trong `src/data/test-data/ai-credentials.ts` — đúng cú pháp, không provider nào nhận.
  Không có key thật nào trong repo; test `@live-ai` dựa vào việc provider từ chối key giả.

## Ngoài phạm vi

- Multi-select nhiều provider, step 4 nhiều card, partial success, chạy lại một card → module `multi-provider-compare`.
- Nhánh key hệ thống của `/match` (`credentialId = null`, `provider = openrouter`) → `@live-ai` của `cv-jd-matching-wizard`.
- Credential dạng che trong file export → `data-export` (FR-15). Xoá sạch dữ liệu (FR-16), nhật ký tiết lộ (FR-17) — chưa làm.
- Dùng credential ở CV rewrite / cover letter → `cv-rewrite-assistant`, `cover-letter-generator`.
- Mất / đổi `CREDENTIAL_ENCRYPTION_KEY` làm credential cũ không giải mã được — vận hành.
- Không log token / key (NFR-SEC-02/10) — review code, không phải test hộp đen.
- Màu của tag trạng thái — chỉ là class CSS của antd, không kiểm tự động.
- Luồng đăng nhập Ducker ID → module `auth` (IdP giả, D5); module này chỉ chạm guard "đăng nhập / khách".

## Tech debt liên quan

- **D4:** không có nút đổi ngôn ngữ — tiếng Việt kiểm qua `window.__i18n` (`BasePage.setLanguage`). `GET /ai-credentials`
  không phân trang (REQ-AICREDENTIALS-10 ghi đúng hiện trạng). Swagger bật ở mọi môi trường. Cách gọi "match" trong tiếng
  Việt không thống nhất. Test không khẳng định các điểm này.
- `throttle` của `POST /:id/test` đếm theo IP: TC-AICREDENTIALS-043 làm bucket của route đó bão hoà tới 60 s; client
  dùng chung tự chờ `Retry-After` nên spec chạy sau chỉ chậm đi.
- Test UI cần hiện "kết quả đã lưu" phải đóng dấu DB song song với stub (D1 chặn provider) — nếu server đổi cách lưu
  (vd thêm cột), `aiCredData.setVerdict` phải theo.
