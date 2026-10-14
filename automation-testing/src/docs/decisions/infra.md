# INFRA — Quyết định

## Nguồn

Đọc ngày 2026-10-13 / 2026-10-14 (đường dẫn tính từ thư mục gốc repo test).

- Tài liệu: `src/docs/requirement-sources.md`, `../docs/README.md`, `../docs/02-requirements/nfr.md` (NFR-SEC-01, -06,
  -07, -09, -10, NFR-I18N-01), `../docs/03-design/architecture.md` (module `health` "Báo app còn sống", helmet,
  throttler), `../docs/03-design/invariants.md` (#17), `../docs/04-state/backlog.md`, `../README.md` ("Swagger at
  /api/v1/docs"), `../docs/specs/ducker-id-sign-in/design.md` §5.2, §6.1, §9, `../docs/specs/data-export/security-report.md`.
- Code: `../server/src/main.ts` (prefix `api/v1`, helmet, CORS, `ValidationPipe({ whitelist, transform })`, Swagger),
  `../server/src/app.module.ts` (Throttler 100/60s, I18n `QueryResolver(lang)` + `AcceptLanguageResolver`, fallback
  `en`), `../server/src/modules/health/health.controller.ts`, `../server/src/modules/auth/session.middleware.ts`,
  `../server/src/modules/documents/dto/*`, `../server/src/i18n/{en,vi}/auth.json`, `../server/prisma/schema.prisma`,
  `../client/src/libs/api.ts` (`credentials: "include"`), `../client/src/hooks/useAuth.ts`.
- Quan sát app đang chạy (2026-10-14, chỉ GET/OPTIONS): `/api/v1/health` 200 `{"status":"ok"}` + header helmet +
  `X-RateLimit-Limit: 100`, không Set-Cookie; `/health` 404; CORS cố định `Access-Control-Allow-Origin:
  http://localhost:5300` cho mọi Origin (origin lạ không bao giờ được phản hồi lại); `/api/v1/docs` 200 "Swagger UI";
  `/api/v1/docs-json` 31 operation, ví dụ `apiKey` là placeholder `sk-xxxx…`, `writeOnly`; `?lang=vi` /
  `Accept-Language: vi` → "Cần đăng nhập.", `?lang=fr` → en. Console của trang web ở chế độ dev rất ồn (log server
  Vite chuyển sang `console.error`), nên không dùng làm tiêu chí.
- Gợi ý (không phải requirement): `src/tests/api/infra/{health,swagger-docs,database}.api.ts`,
  `src/tests/e2e/infra/reachability.e2e.ts` gom về lúc scaffold. Module infra không có mục `## Gom từ …` trong
  `test-cases/` hay `defects/` (không có `e2e.md` / `e2e-bugs.md` cũ).
- User (2026-10-14, chép nguyên văn phần áp cho module này):
  - D1 "UI tests stub AI responses with page.route (everything else hits the real backend). API tests cover every
    branch that is decided before the AI/provider call. … No other test may reach a paid provider or real OIDC."
  - D2 "every place the app deviates from a requirement is a BUG: test asserts the REQUIRED behaviour, marked
    test.fail() …"
  - D3 "Where the drafts recommend 'accept the code, fix the doc': the code is the requirement; docs get updated."
  - D4 "NFR gaps (… no stricter rate limit on POST /match and export; … /health without DB check; Swagger in prod; …):
    backlog debt, NOT bugs, tests do not assert them."
  - D6 "Every other open question in the drafts: apply the option marked (Khuyến nghị) / (a)."

## Quyết định chốt

- **Q1** `/health` không kiểm datastore (Ducker ID thì có) → (a) liveness-only như architecture.md; test chỉ ghim
  `200 {status:"ok"}`, không assert trạng thái DB. Căn cứ D4 + D6. Ảnh hưởng REQ-INFRA-01.
- **Q2** Hai test cũ `database.api.ts` (Prisma connect, đếm bảng `User`, `test.fixme`) → (a) xóa hẳn: chúng chỉ chạm DB
  qua `pg`, không chạm hành vi server; độ sẵn sàng DB đã được mọi test API (và project `session`) chứng minh gián
  tiếp. Căn cứ D6. Không REQ nào.
- **Q3** Swagger mở ở mọi môi trường → (a) chấp nhận; chỉ kiểm ở dev, "tắt/chặn Swagger ở production" là nợ backlog.
  Căn cứ D4 + D6. Ảnh hưởng REQ-INFRA-03.
- **Q4** (người viết test, theo quan sát) "message theo i18n" của REQ-INFRA-08 trong bản nháp: message lỗi DTO là
  message mặc định của class-validator (tiếng Anh, không qua nestjs-i18n); message nghiệp vụ mới đi qua i18n
  (REQ-INFRA-09). REQ-INFRA-08 ghim envelope `400` + tên field, không ghim ngôn ngữ của message DTO. Ghi nhận như
  khoảng trống NFR-I18N-01 ở Tech debt, không phải bug. Ảnh hưởng REQ-INFRA-08.
- **Q5** CORS "origin khác không được phép": server dùng origin cố định nên luôn trả `Access-Control-Allow-Origin:
  <CLIENT_ORIGIN>`, kể cả cho origin lạ — trình duyệt chặn vì không khớp. Requirement là "origin lạ không bao giờ được
  phản hồi lại, không `*`", không đòi server từ chối preflight. Ảnh hưởng REQ-INFRA-07.
- **Q6** Lỗi `500`: không có cách gây 500 an toàn qua HTTP mà không sửa app (D2 cấm) → TC-INFRA-023 manual.
  Ảnh hưởng REQ-INFRA-10.
- **Q7** Rate limit: kiểm trên `/health` (route không ghi DB, throttler tính theo route) bằng probe một-phát của slot
  infra (client chung tự chờ `Retry-After` rồi thử lại, sẽ che mất 429). Sau test, `/health` bị chặn ~60 s với IP
  chạy test; các test khác gọi `/health` chỉ chậm đi (client chung tự chờ). Ảnh hưởng REQ-INFRA-05.
- **Q8** UI infra chỉ chạy project `app` (desktop): `playwright.config.ts` đã bỏ `e2e/infra/` khỏi `app-tablet` /
  `app-mobile` — reachability không phụ thuộc viewport. Ảnh hưởng REQ-INFRA-07, -11.
- Không REQ nào của infra chạm AI hay OIDC (D1, D5 không áp).

## Tài khoản test

- UI (`tests/e2e/infra/`): phiên e2e đã seed bởi project `session` (`.auth/user.json`).
- API: `anonApi` (ẩn danh) cho mọi case public / 401 / header / CORS / i18n; user và khách dùng-một-lần qua fixture
  `infraUsers` (`src/utils/sessions.ts` `createSignedInUser` / `createGuestUser`, xóa cùng dữ liệu khi test kết thúc)
  cho case cần phiên (health có phiên, whitelist, 400 DTO, 404 tài liệu).
- Không mật khẩu, không OIDC thật.

## Ngoài phạm vi

- p95 latency (NFR-PERF-02), N+1 (NFR-PERF-03), index (NFR-PERF-04): cần môi trường gần production / review migration.
- `pnpm audit` (NFR-SEC-05), grep secret trong repo (NFR-SEC-04): kiểm ở CI / review, không qua HTTP.
- Backup / migration ngược (NFR-DATA-03): thử tay một lần theo nfr.md.
- `trust proxy` (backlog #11): chưa deploy.
- Console error của trang web: dev server forward log server vào console trình duyệt, không phân biệt được lỗi thật.
- Kết nối Prisma in-process (hai test `database.api.ts` cũ): Q2.

## Tech debt liên quan

- (D4) `/health` không kiểm PostgreSQL — khác quy ước `/health` của Ducker ID.
- (D4) Swagger được mount cả ở `NODE_ENV=production`.
- (D4) Không có rate limit chặt hơn cho endpoint gọi AI (`POST /match`, …) và `GET /me/export` (NFR-SEC-07 vế sau).
- (D4) Không có pagination cho `GET /documents`, `GET /match`; không idempotency phía server.
- (Q4) Message lỗi DTO của `ValidationPipe` không qua i18n (luôn tiếng Anh), lệch tinh thần NFR-I18N-01.
- Tag operation `Health` viết hoa, các tag khác viết thường (thẩm mỹ Swagger).
