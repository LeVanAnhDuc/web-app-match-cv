# HOMEDASHBOARDLIBRARY — Quyết định

## Nguồn

Đọc ngày 2026-10-14. Đường dẫn tính từ gốc app (`web-app-match-cv/`).

- `automation-testing/src/docs/requirement-sources.md`
- Docs: `docs/README.md`, `docs/01-product/journeys.md` (US-02, US-07, US-09), `docs/02-requirements/scope.md` (FR-06,
  FR-08), `docs/02-requirements/nfr.md` (NFR-COST-02, NFR-COST-04, NFR-DATA-04, NFR-I18N-01, NFR-I18N-02, NFR-PERF-01,
  NFR-REL-03, NFR-REL-04), `docs/03-design/invariants.md` (#1, #4, #19, #21), `docs/04-state/backlog.md`,
  `docs/decisions/0022-…`, `docs/decisions/0023-…` (ADR-0023 claim khách)
- Spec feature: `docs/specs/home-dashboard-library/design.md` (§1, §3.2, §3.3, §4.2, §6, §8), `security-report.md`
  (M3, M5); `docs/specs/ui-consistency-shell/design.md` §4.4; `docs/design-system/match-cv/ux-copy.md` §9.4
- Server: `server/src/modules/matching/matching.controller.ts`, `matching.service.ts` (`list`, `getById`, nhánh
  `failed`), `dto/match-summary.dto.ts`, `server/src/i18n/{en,vi}/matching.json`, `auth.json`,
  `server/prisma/schema.prisma` (MatchResult, MatchRun), `server/src/modules/auth/auth.guard.ts`
- Client: `client/src/routes/_app/index.tsx`, `client/src/views/Home/**` (HeroCta, AccountPerks, StatCards,
  RecentMatches), `client/src/hooks/{useMatch,useDocuments,useAuth}.ts`, `client/src/requests/match.ts`,
  `client/src/locales/{en,vi}/translation.json`, `client/src/views/Wizard/mains/StepResult/index.tsx`
- Test cũ (gợi ý, không phải nguồn): `src/tests/e2e/home-dashboard-library/library.e2e.ts`,
  `src/test-cases/home-dashboard-library.md` mục "Gom từ docs/specs/home-dashboard-library/e2e.md"
- Quan sát app đang chạy (2026-10-14, chỉ đọc): `GET /match` và `GET /match/<uuid>` ẩn danh → 401
  `{"code":"SIGN_IN_REQUIRED","message":"Sign in required."}`; `GET /auth/me` ẩn danh → `status: "anonymous"`,
  `guestQuota.limit = 5`.

Quyết định của user (2026-10-14, áp cho toàn bộ suite):

- **D1** AI: UI test stub response AI bằng `page.route`, mọi thứ khác đi backend thật. API test phủ mọi nhánh quyết định
  trước khi gọi AI/provider. 2–3 test `@live-ai` gọi provider thật, chỉ chạy khi `LIVE_AI=1`.
- **D2** App lệch requirement là BUG: test assert hành vi đúng, `test.fail()` + `// BUG: …`, ghi vào
  `defects/<module>.md`. Không sửa code app.
- **D3** Chỗ draft khuyên "chấp nhận code, sửa doc": code là requirement; docs do agent Docs cập nhật.
- **D4** Khoảng trống NFR (không có nút đổi ngôn ngữ — vi test qua `window.__i18n`; không phân trang `GET /documents`,
  `GET /match`; …) là nợ backlog, không phải bug, test không assert.
- **D5** Auth OIDC: suite chạy fake IdP + một server Match CV riêng; các module khác tiếp tục cài phiên vào DB.
- **D6** Mọi câu hỏi mở khác: chọn phương án đánh dấu (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1** Kết quả `failed` (mỗi provider lỗi vẫn lưu `MatchResult status=failed, overallScore=0`) đang bị tính vào
  "Total matches", kéo avg và hiện dòng `0%` đỏ → **(a)** thống kê + bảng chỉ tính `succeeded`, vẫn đếm theo từng
  `MatchResult` (chạy 3 provider = 3). App hiện lệch → test `test.fail()` + BUG-HOMEDASHBOARDLIBRARY-01 (D2, D6).
  → REQ-HOMEDASHBOARDLIBRARY-19 (và -09, -11).
- **Q2** Lỗi `GET /documents` / `GET /match` bị che thành `0` / "No matches yet" (HDL §6, §8 #10 đòi error UI + retry,
  NFR-REL-03) → **(a)** test kỳ vọng trạng thái lỗi, `test.fail()` + BUG-HOMEDASHBOARDLIBRARY-02 (D2, D6).
  → REQ-HOMEDASHBOARDLIBRARY-20. Để tạo lỗi, spec cho `GET /match` / `GET /documents` trả 500 bằng fixture `network`
  (ngoại lệ có chủ đích của "mọi thứ khác đi backend thật" ở D1: lỗi server không tái tạo được theo cách khác).
- **Q3** Dữ liệu `MatchResult` cho test → **(a)** seed thẳng vào DB qua `utils/db.ts` (`insertMatchResult`), tất định,
  không call AI (D1, D6). → REQ-HOMEDASHBOARDLIBRARY-01, -03, -04, -09…-14, -18, -19.
- **Q4** `GET /match` không phân trang (lệch NFR-PERF-01) → **(a)** nợ có chủ đích của FR-08, test không assert phân
  trang (D4, D6). → Tech debt.
- **Q5** (từ test cũ) Các case thư viện `/cv` (liệt kê, xem trước, đổi tên, xoá bị chặn 409, xoá) và bug cũ `922722e`
  (crash xem trước PDF khi đổi ngôn ngữ) → thuộc module `documents` (REQ-DOCUMENTS-22…31, -28); xoá khỏi spec của module
  này. Case "đổi nav sang tiếng Việt" và "hamburger mobile" → thuộc `ui-consistency-shell`; ở đây thay bằng case i18n và
  responsive của chính trang chủ.
- **Q6** Trạng thái loading (REQ-HOMEDASHBOARDLIBRARY-06, -10) → làm chậm request thật (`route.continue()` sau một độ
  trễ, fixture `homeLatency`), không stub body.
- **Q7** REQ-HOMEDASHBOARDLIBRARY-05 (claim khách khi đăng nhập) chỉ kích hoạt qua `/auth/callback`; theo D5 chỉ module
  `auth` có fake IdP → TC manual ở đây, phủ tự động ở module `auth` / `guest-mode`.

## Tài khoản test

- Không dùng user e2e đã seed (`.auth/user.json`) cho kỳ vọng đếm: DB dev dùng chung với 12 module, số liệu sẽ lệch.
  Mỗi test tự tạo user bằng `src/utils/sessions.ts`: `createSignedInUser()` (user), `createGuestUser()` (khách),
  `createUser()` (user khác chỉ để sở hữu dữ liệu), qua fixture `homeData`; `deleteUsers` dọn sau test (cascade
  Document / MatchResult).
- UI: fixture `homeSession` thay cookie `mcv_session` của browser context bằng cookie của user / khách vừa tạo, hoặc
  xoá hết cookie để thành người chưa đăng nhập. Vì vậy spec chạy ở project `app`, `app-tablet`, `app-mobile` (storage
  state đã đăng nhập) nhưng không phụ thuộc user e2e.
- Tài liệu và kết quả seed thẳng DB (`insertDocument`, `insertMatchResult`); timestamp UTC.

## Ngoài phạm vi

- FR-08 phần chưa ship: trang `/history`, link sidebar, lọc theo CV/JD, sắp xếp, `DELETE /match/:id`.
- Nội dung báo cáo bước 4 (breakdown, gaps, cover letter, rewrite) → `cv-jd-matching-wizard`, `multi-provider-compare`,
  `cover-letter-generator`, `cv-rewrite-assistant`. Ở đây chỉ assert mở đúng báo cáo của match đã chọn.
- Thư viện `/cv`, `/jd` (kể cả case cũ của file `library.e2e.ts`) → `documents`. Sidebar / drawer / nav → `ui-consistency-shell`.
- Quota khách, đếm lượt còn lại, chi tiết claim → `guest-mode`, `auth`.
- NFR-PERF-02 (p95), NFR-A11Y-01 (tương phản), hit-area 44px (nợ #7 backlog).
- FR-16, FR-17, FR-19 — chưa có.
- Không có test `@live-ai` ở module này: trang chủ và lịch sử không gọi AI.

## Tech debt liên quan

- `GET /match` (và `GET /documents`) không phân trang (NFR-PERF-01); trang chủ tải toàn bộ lịch sử để tính thống kê ở
  client (HDL §3.2 không có `/stats`) — D4 / Q4.
- Không có nút đổi ngôn ngữ trong app; tiếng Việt kiểm qua dev hook `window.__i18n` (D4).
- "View all" là chữ tĩnh cho tới khi có trang `/history` (REQ-HOMEDASHBOARDLIBRARY-12).
- Thuật ngữ tiếng Việt cho "match" chưa thống nhất ("ghép" ở trang chủ, "match" ở thư viện) — D4, không assert.
