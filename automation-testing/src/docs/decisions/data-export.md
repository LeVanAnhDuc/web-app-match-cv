# DATAEXPORT — quyết định

## Nguồn

Đọc ngày 2026-10-13 / 2026-10-14 (đường dẫn tính từ gốc app `web-app-match-cv/`):

- Tài liệu: `automation-testing/src/docs/requirement-sources.md`, `docs/README.md`, `docs/02-requirements/scope.md`
  (FR-15, FR-16, FR-17), `docs/02-requirements/nfr.md` (NFR-SEC-06/07/09/10/11, NFR-DATA-04, NFR-REL-03,
  NFR-A11Y-02/04, NFR-I18N-01), `docs/03-design/invariants.md` (#4, #12, #17, #21), `docs/03-design/architecture.md`,
  `docs/01-product/journeys.md` (US-08, US-09), `docs/04-state/backlog.md`, `README.md` (Features),
  `docs/specs/data-export/design.md` (§4–§9), `docs/specs/data-export/security-report.md`,
  `docs/specs/ducker-id-sign-in/design.md` (§5.2, §6.2, §6.3), `docs/design-system/match-cv/ux-copy.md` (§9).
- Code server: `server/src/modules/me/{me.controller,me.service,export-manifest,i18n-messages}.ts`,
  `server/src/i18n/{en,vi}/me.json`, `server/src/modules/auth/auth.guard.ts`, `server/src/app.module.ts`,
  `server/src/main.ts`, `server/prisma/schema.prisma` (User, Document, MatchRun, CoverLetter).
- Code client: `client/src/routes/_app/my-data.tsx`, `client/src/views/MyData/**`, `client/src/hooks/{useMyData,useAuth}.ts`,
  `client/src/requests/myData.ts`, `client/src/components/{RequireAuth,SignInGate}`,
  `client/src/layouts/AppShell/components/Sidebar`, `client/src/locales/{en,vi}/translation.json`, `client/src/i18n`.
- Test gom về lúc scaffold (gợi ý, không phải requirement): `src/tests/e2e/data-export/export.e2e.ts` (6 test),
  `src/tests/api/data-export/export.api.ts` (6 test, port từ `server/test/me.e2e-spec.ts`),
  `src/test-cases/data-export.md` mục "Gom từ `docs/specs/data-export/e2e.md`". Không có bug log cũ, không có `test.fixme`.
- Quyết định của user (2026-10-14, nguyên văn rút gọn, ràng buộc toàn bộ suite):
  - **D1** UI stub AI bằng `page.route`, mọi thứ khác đi backend thật; API phủ mọi nhánh quyết định trước khi gọi
    provider; chỉ `@live-ai` chạm provider thật.
  - **D2** App lệch requirement là BUG: test assert hành vi ĐÚNG, `test.fail()` + `// BUG: …`, ghi `defects/<module>.md`.
    Không sửa code app.
  - **D3** Chỗ draft khuyên "chấp nhận code, sửa doc": code là requirement.
  - **D4** Nợ NFR (không có language switcher — `vi` test qua `window.__i18n`; không rate limit riêng cho POST /match và
    export; không phân trang; không idempotency; /health không check DB; Swagger ở prod; thuật ngữ "match" tiếng Việt
    chưa thống nhất): backlog, KHÔNG phải bug, test không assert.
  - **D5** Auth OIDC: module auth chạy fake IdP riêng; module khác cắm session thẳng vào DB.
  - **D6** Câu hỏi mở còn lại: chọn phương án (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1 — Export chưa "toàn bộ dữ liệu"** (FR-15 nói toàn bộ, nhưng `export-manifest.ts` bỏ `CoverLetter`, `MatchRun`,
  `Document.parentId`, `User.email/fullName/avatar`). → **(a)** theo D6: coi là thiếu sót, requirement đòi export thêm
  các phần đó và `schemaVersion = 2`; test đỏ có chủ đích (`test.fail()`), ghi BUG-DATAEXPORT-01 / 02 (D2).
  REQ ảnh hưởng: REQ-DATAEXPORT-34 (mới); REQ-DATAEXPORT-07 nới thành "`schemaVersion` nguyên dương" để test hợp đồng
  hiện tại không đỏ lây vì cùng một thiếu sót.
- **Q2 — Rate limit riêng cho export** → **(a)** theo D6 + D4: giữ throttle toàn cục 100/60s; suite chỉ ghim throttle
  toàn cục (REQ-DATAEXPORT-25). Thiếu `@Throttle` riêng là nợ backlog, không phải bug.
- **Q3 — Ca không kiểm được bằng black-box HTTP** (lỗi DB giữa stream, client ngắt giữa chừng, đọc nhất quán khi upload
  đồng thời) → **(a)** theo D6: để unit test phía server, ngoài phạm vi suite; suite kiểm biên 10 MB / 200 tài liệu bằng
  seed DB. REQ-DATAEXPORT-24 thành TC manual. Cùng lý do: ký tự NUL trong `rawText` (REQ-DATAEXPORT-21) không seed được
  vì cột `text` của PostgreSQL không chứa được `\u0000` → TC manual; thuộc unit test của `export-manifest.ts`
  (`export-manifest.spec.ts` hiện chưa có ca NUL — báo lại cho phía server).
- **Q4 — i18n `vi` không có đường người dùng thật** → **(a)** theo D6 + D4: test `vi` qua dev hook `window.__i18n`
  (`BasePage.setLanguage`), thiếu language switcher là nợ backlog. REQ ảnh hưởng: REQ-DATAEXPORT-33.
- **Q5 — Throttle 429 thật** (suy ra khi viết TC): client HTTP của suite tự chờ `Retry-After` rồi gọi lại khi gặp
  `429`, và đốt hết 100 lượt / phút của route sẽ làm test export khác trong cùng phút bị chờ. → TC tự động chỉ kiểm
  header `X-RateLimit-Limit: 100` + `X-RateLimit-Remaining` giảm dần trên `/me/export` (chứng minh guard toàn cục áp
  cho route); lần vượt ngưỡng → `429` là TC manual. REQ ảnh hưởng: REQ-DATAEXPORT-25.
- **Q6 — Cờ UTF-8 của entry** (suy ra khi viết TC): slug đã bỏ dấu nên tên entry luôn là ASCII; `archiver` chỉ bật bit 11
  khi tên có byte ngoài ASCII. Requirement chốt là "không mojibake: thuần ASCII hoặc có cờ UTF-8" (REQ-DATAEXPORT-19)
  thay vì đòi bit 11 trên mọi entry. Theo D3 (code là requirement khi tài liệu chỉ là cách diễn đạt).
- **Q7 — Tên dành riêng Windows** (design §7 dòng 8 nói "giải nén được"): suite không giải nén trên Windows thật; TC chốt
  là tên entry không bao giờ là tên dành riêng trần (luôn có hậu tố `-<id6>.<ext>`). REQ-DATAEXPORT-17.
- **Q8 — Test cũ đã đổi** khi chuẩn hóa:
  - `export.e2e.ts` → tách thành `tests/e2e/data-export/{access,download,a11y-i18n}.e2e.ts`; bỏ `loadTranslation`,
    `waitHydrated`, `switchLanguage` tự viết (thay bằng `t()`, `waitForAppReady()`, `setLanguage()`); bỏ
    `elementHandle` + `page.route` thô (thay bằng `MyDataPage` và fixture `dataExportNetwork`). Ca "[a11y] Tab + Enter"
    mở rộng thêm Space và focus indicator.
  - `export.api.ts` → tách thành `tests/api/data-export/{access,archive-contract,leak-isolation,entry-naming,edge-data,
    http-edge,completeness}.api.ts`; bỏ `http(cookie)` thô và `beforeEach` xóa bảng của user dùng chung (thay bằng user
    riêng mỗi test qua `dataExportUsers`). Ca "wrong method 404" nới thành `404 | 405` theo design §7 dòng 4.
  - Không ca cũ nào bị xóa vì ngoài phạm vi.

## Tài khoản test

- **UI (project `app`, `app-tablet`, `app-mobile`)**: user e2e đã seed sẵn (`.auth/user.json`, tạo bởi project `session`
  qua `src/utils/auth-state.ts`) — trang `/my-data` và download chạy dưới user này; data.json được so với
  `readE2eUserId()`.
- **UI anonymous / khách**: context trình duyệt mới không cookie (anonymous), hoặc cookie `mcv_session` của một khách
  tạo bằng `createGuestUser()` (`src/utils/sessions.ts`), qua fixture `dataExportVisitor`; khách bị xóa sau test.
- **API**: mỗi test tạo user đăng nhập riêng bằng `createSignedInUser()` (+ `createUser()` / `createGuestUser()` cho
  "user khác") qua fixture `dataExportUsers`, seed dữ liệu thẳng vào DB (`src/utils/db.ts` + SQL riêng trong
  `fixtures/modules/data-export.fixture.ts` cho `createdAt` cố định và seed hàng loạt), xóa toàn bộ user sau test
  (cascade). Gọi API qua `apiAs(user)` / `anonApi`. Không mật khẩu nào (session cắm thẳng vào DB, D5).

## Ngoài phạm vi

- FR-16 xóa sạch dữ liệu (`DELETE /me/data`) và FR-17 nhật ký tiết lộ — `scope.md` trạng thái "chưa".
- In / lưu PDF báo cáo (design §11 roadmap) — chưa có.
- Hit-area 44px của nút "Download my data" (antd `size="large"` = 40px) — nợ backlog #7.
- "Server bind 0.0.0.0 khi chưa có auth" (security-report #3) — tiền đề đã đổi vì FR-18 có auth.
- Fault-injection giữa stream, client ngắt giữa chừng ở phía server, đọc nhất quán khi upload đồng thời (Q3).
- Giải nén thật trên Windows với tên dành riêng (Q7).
- Đăng nhập OIDC thật (D5) — "đã đăng nhập" ở module này luôn là session cắm vào DB.

## Tech debt liên quan

- Không có rate limit riêng cho `GET /me/export` (security-report "Còn tồn tại" #2): chỉ throttle toàn cục 100/60s,
  không chặn nhiều export song song (D4, Q2).
- Không có language switcher; `vi` chỉ đổi được qua dev hook `window.__i18n` (D4, Q4).
- Tên file download do client tự đặt theo ngày UTC của máy người dùng vì `Content-Disposition` không được expose qua
  CORS — có thể lệch một ngày so với server (ghi trong `client/src/requests/myData.ts`), không phải bug.
