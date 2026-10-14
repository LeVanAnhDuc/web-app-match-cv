# DOCUMENTS — Quyết định

## Nguồn

Đọc ngày 2026-10-14 (nháp requirement do agent viết, user chốt các câu hỏi cùng ngày).

- `src/docs/requirement-sources.md`
- Docs: `docs/README.md`, `docs/01-product/journeys.md`, `docs/01-product/glossary.md`, `docs/02-requirements/scope.md`
  (FR-02, FR-07), `docs/02-requirements/nfr.md`, `docs/03-design/invariants.md`, `docs/04-state/backlog.md`,
  `docs/decisions/0019-preview-tai-lieu-chay-client-side.md`, `0022-dang-nhap-bff-session-rieng.md`,
  `0023-che-do-khach-user-tam-24h.md`, `docs/specs/home-dashboard-library/design.md` (HDL), `security-report.md`,
  `docs/specs/seed-mock-documents/design.md` §1–4, `docs/design-system/match-cv/ux-copy.md`
- Code server: `server/src/modules/documents/*` (controller, service, `dto/*`, `parsing.ts`, `i18n-messages.ts`),
  `server/src/i18n/{en,vi}/documents.json`, `server/src/modules/auth/{auth.guard,guest.service}.ts`, `server/src/main.ts`,
  `server/src/app.module.ts`, `server/prisma/schema.prisma`,
  `server/prisma/migrations/20261004000000_auth_sessions_and_guests/migration.sql`
- Code client: `client/src/routes/_app/{cv,jd}.tsx`, `client/src/views/{CvLibrary,JdLibrary}/**`,
  `client/src/hooks/{useCvLibrary,useJdLibrary,useDocuments}.ts`, `client/src/requests/documents.ts`,
  `client/src/components/{DocumentRow,DocumentPreview,DocumentPreviewModal,DocumentRenameModal,RequireAuth,SignInGate}/index.tsx`,
  `client/src/libs/api.ts`, `client/src/locales/{en,vi}/translation.json`
- Gợi ý (không phải nguồn): `src/tests/api/documents/documents.api.ts` (gom từ `server/test/documents.e2e-spec.ts`),
  `src/tests/e2e/home-dashboard-library/library.e2e.ts`, `src/test-cases/home-dashboard-library.md`
- Quan sát app chạy thật (2026-10-14, chỉ GET): `GET /api/v1/documents` không cookie → 401
  `{"code":"SIGN_IN_REQUIRED","message":"Sign in required."}` (vi: "Cần đăng nhập."), có `X-Content-Type-Options: nosniff`;
  `/cv` trả 200.
- Quyết định của user (2026-10-14, nguyên văn rút gọn — áp cho cả 12 module):
  - **D1** UI test stub AI bằng `page.route`, mọi thứ khác đi backend thật. API test phủ mọi nhánh quyết định trước khi gọi AI. Chỉ test `@live-ai` chạm provider thật.
  - **D2** Mọi chỗ app lệch requirement là BUG: test assert hành vi YÊU CẦU, `test.fail()` + `// BUG: …`, ghi vào `src/defects/<module>.md`. Không sửa code app.
  - **D3** Chỗ nháp đề xuất "chấp nhận code, sửa doc": code là requirement; docs do agent Docs cập nhật.
  - **D4** Lỗ hổng NFR (không có nút đổi ngôn ngữ — vi test qua `window.__i18n`; không phân trang `GET /documents`; …): nợ backlog, KHÔNG phải bug, test không assert.
  - **D5** Auth OIDC: suite có fake IdP riêng cho module auth; các module khác cắm session thẳng vào DB.
  - **D6** Mọi câu hỏi mở khác trong nháp: chọn phương án (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1** Xoá tài liệu chỉ được `MatchRun` tham chiếu (FK `ON DELETE NO ACTION`, `remove()` chỉ đếm `MatchResult`) → 500.
  → (a) theo D6 + D2: test kỳ vọng không 5xx (409 `inUseByMatch` hoặc 204 xoá kèm run rỗng), `test.fail()`, ghi
  BUG-DOCUMENTS-01. → REQ-DOCUMENTS-34.
- **Q2** `GET /documents` không phân trang (lệch NFR-PERF-01). → (a) theo D4: HDL coi là ngoại lệ có chủ đích, test không
  assert phân trang; nợ backlog. → REQ-DOCUMENTS-07 (không đổi).
- **Q3** Xem trước PDF chỉ vẽ trang 1. → (a) theo D6: là defect (thấp). Theo D2 requirement là hiện mọi trang; test dùng
  PDF 3 trang kỳ vọng 3 canvas, `test.fail()`, BUG-DOCUMENTS-02. Test thường chỉ assert trang 1 có canvas. →
  REQ-DOCUMENTS-26, REQ-DOCUMENTS-35.
- **Q4** Modal xem trước quay vô hạn khi `GET /documents/:id` lỗi. → (a): kỳ vọng `preview.error`, `test.fail()`,
  BUG-DOCUMENTS-03. → REQ-DOCUMENTS-36.
- **Q5** Lỗi tải danh sách không có nút thử lại (HDL §6, §8 #10 đòi retry). → (a): test assert thông báo lỗi
  (REQ-DOCUMENTS-25); nút retry là defect thấp, test `test.fail()`, BUG-DOCUMENTS-04. → REQ-DOCUMENTS-37.
- **Q6** Tên file tải về mất dấu tiếng Việt (sanitize ASCII, không có `filename*`). → (a): test khẳng định sanitize hiện
  tại an toàn header (REQ-DOCUMENTS-14) + defect thấp đề xuất `filename*=UTF-8''…`, `test.fail()`, BUG-DOCUMENTS-05. →
  REQ-DOCUMENTS-38.
- **Q7** Message 400 của `ValidationPipe` / `ParseUUIDPipe` luôn tiếng Anh. → (a): test API chỉ assert status cho các ca
  validation DTO; lệch NFR-I18N-01 ghi là nợ (không phải bug). Message do service tự ném (`titleRequiredWhenSaving`,
  `emptyText`, `unsupportedFileType`, `fileTooLarge`, `notFound`, `noOriginalFile`, `inUseByMatch`) vẫn assert cả en và vi.
  → REQ-DOCUMENTS-04, 08, 11, 15, 32.
- **Q8** Đổi tên không optimistic (HDL §4.3, §8 #11 nói optimistic + revert). → (a) theo D3: code là requirement, HDL
  được sửa theo code; test assert title đổi sau khi server trả về. → REQ-DOCUMENTS-29.
- **Q9** (phát sinh khi viết REQ) Nhánh `"Untitled"` của `deriveTitle` không đạt được: text rỗng bị chặn 400
  `emptyText` trước, file không có text bị 400 `parseFailed`. → bỏ khỏi REQ-DOCUMENTS-03, nhánh 400 `emptyText` chuyển
  vào REQ-DOCUMENTS-04.
- **Q10** (phát sinh) Biên đúng 10 MB của file: `MaxFileSizeValidator` của Nest dùng `size < maxSize`, và không có PDF
  hợp lệ đúng 10 MiB trong bộ test → chỉ test "trên biên" (10 MiB + 1 byte → `fileTooLarge`). → REQ-DOCUMENTS-04.
- **Q11** (phát sinh) Trạng thái loading/lỗi của UI cần điều khiển mạng: chỉ ở các case đó (`library.loadError`,
  loading, `preview.error`, `rename.failed`, `delete.failed`, khoá nút khi đang xoá) spec stub đúng một request không phải
  AI bằng fixture `network` (`failWith` / `stubJson` + `delayMs`); mọi case khác đi backend thật (D1).
- **Q12** (phát sinh) Claim tài liệu của khách khi đăng nhập (phần sau của REQ-DOCUMENTS-06) cần callback OIDC → chỉ fake
  IdP của module auth chạy được (D5). TC ghi `manual` trỏ sang module auth / guest-mode; module này phủ phần tạo khách.

## Test `test.fixme` đã gom

Không có: `src/tests/api/documents/documents.api.ts` (gom từ `server/test/documents.e2e-spec.ts`) không gọi AI nên chạy
thật toàn bộ. File đó đã được tách theo chủ đề (`create`, `list`, `read`, `rename`, `delete`) và xoá; không có
`helpers.ts`, không có mục `## Gom từ …` trong `test-cases/documents.md` / `defects/documents.md`.

Case cũ thay đổi khi chuẩn hóa:

- "upload wrong type .txt / .png → 400" giờ assert thêm message `unsupportedFileType` (REQ-DOCUMENTS-04).
- "save=true without title → 400" assert thêm message en + vi.
- Các assert theo thứ tự `createdAt` dùng user riêng của test (fixture `docOwner`), không còn phụ thuộc dữ liệu module khác.

## Tài khoản test

- **API**: mỗi test có user đăng nhập riêng (`docOwner` = `createSignedInUser()` trong `src/utils/sessions.ts`, xoá ở
  teardown, cascade mọi document/match/run). "User khác" = `docStranger` (user đăng nhập riêng sở hữu một CV PDF có file
  gốc). Khách = `createGuestUser()`; ẩn danh = `anonApi`.
- **UI**: tab trình duyệt dùng cookie `mcv_session` của `docOwner` (fixture `docSignInAs` thay cookie của user e2e seed
  trong `.auth/user.json`), để số đếm, thứ tự và trạng thái rỗng chính xác. Cổng đăng nhập: `docSignInAs("anonymous")`
  (xoá cookie) hoặc `docSignInAs("guest")` (user khách mới).
- Không dùng user e2e cố định, không ghi mật khẩu (Match CV không có mật khẩu — đăng nhập qua Ducker ID).

## Ngoài phạm vi

- Luồng nạp file / dán text trên UI wizard, parse PDF/DOCX ở bước Review, preview ở step 3 → module
  `cv-jd-matching-wizard` (FR-01, FR-03). Ở đây chỉ hợp đồng `POST /documents` liên quan tới lưu.
- `PATCH /documents/:id/parent`, modal "Mark as a new version of…", trang "Compare versions" → module
  `cv-version-comparison` (FR-14). Ở đây chỉ assert mục menu có/không.
- Search/filter, phân trang thư viện (HDL §1; Q2).
- FR-16 (xoá sạch dữ liệu), FR-17 (nhật ký tiết lộ) — chưa có.
- NFR-PERF-02 (p95) — cần môi trường gần production.
- Hit-area 44px của nút "Actions" (32px) — nợ #7 ở `docs/04-state/backlog.md`.
- Khách hết hạn 24h / lazy purge, quota khách → module `guest-mode`. Claim khi đăng nhập → module `auth` (Q12).
- Màn hình home dashboard → module `home-dashboard-library` (module đó có spec gom về cũng chạm `/cv`; hai bộ độc lập).

## Tech debt liên quan

- Không phân trang `GET /documents` (NFR-PERF-01; D4, Q2).
- Không có nút đổi ngôn ngữ: tiếng Việt test qua dev hook `window.__i18n` (D4).
- Message validation DTO / `ParseUUIDPipe` không i18n (NFR-I18N-01; Q7).
- `/health` không kiểm DB, Swagger bật ở prod, không có idempotency phía server (D4) — không assert ở module này.
