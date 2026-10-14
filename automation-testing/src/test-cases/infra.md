# INFRA — Test cases

Health, Swagger và hạ tầng HTTP dùng chung. Requirement: `docs/requirements/infra.md`; quyết định: `docs/decisions/infra.md`.

## Health

### TC-INFRA-001 — health ẩn danh trả 200 status ok và không set cookie

- **Requirement:** REQ-INFRA-01
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** `GET /api/v1/health`
- **Mong đợi:** `200`, `Content-Type` JSON, body đúng `{"status":"ok"}`
- **Kiểm chứng thêm:** không có `Set-Cookie` nào (không mint khách, không `mcv_session`)
- **Automated:** `tests/api/infra/health.api.ts`

### TC-INFRA-002 — health trả 200 với phiên user và phiên khách mà không đổi cookie

- **Requirement:** REQ-INFRA-01
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** một user đăng nhập và một khách dùng-một-lần (`infraUsers`)
- **Bước:** `GET /api/v1/health` với cookie của từng người
- **Mong đợi:** cả hai `200 {"status":"ok"}`, không `Set-Cookie`
- **Automated:** `tests/api/infra/health.api.ts`

### TC-INFRA-003 — health vẫn 200 khi cookie phiên giả

- **Requirement:** REQ-INFRA-01
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** cookie `mcv_session=<token không tồn tại>`
- **Bước:** `GET /api/v1/health`
- **Mong đợi:** `200 {"status":"ok"}` (cookie hỏng không làm health lỗi)
- **Automated:** `tests/api/infra/health.api.ts`

### TC-INFRA-004 — đường dẫn ngoài tiền tố api v1 trả 404

- **Requirement:** REQ-INFRA-02
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /health`, `GET /api/v2/health` trên origin của API; đối chứng `GET /api/v1/health`
- **Mong đợi:** hai đường dẫn ngoài tiền tố `404`; đối chứng `200`
- **Automated:** `tests/api/infra/health.api.ts`

## Swagger / hợp đồng API

### TC-INFRA-005 — Swagger UI phục vụ tại api v1 docs

- **Requirement:** REQ-INFRA-03
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /api/v1/docs` (theo tối đa 1 redirect)
- **Mong đợi:** `200`, `Content-Type` HTML, trang Swagger UI
- **Automated:** `tests/api/infra/swagger-docs.api.ts`

### TC-INFRA-006 — OpenAPI liệt kê đủ endpoint đang ship dưới đúng tag

- **Requirement:** REQ-INFRA-03
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /api/v1/docs-json`
- **Mong đợi:** `info.title` = `match-cv API`; mọi operation trong `SHIPPED_OPERATIONS` có mặt; tập tag operation chứa
  `auth`, `documents`, `match`, `ai-credentials`, `cover-letters`, `cv-rewrite`, `comparisons`, `me`
- **Automated:** `tests/api/infra/swagger-docs.api.ts`

### TC-INFRA-007 — OpenAPI không lộ trường mã hóa hay token AI

- **Requirement:** REQ-INFRA-04
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `GET /api/v1/docs-json`
- **Mong đợi:** không chuỗi `encryptedKey` / `keyIv` / `keyTag`; không ví dụ nào trông như key thật (`sk-…`, `AIza…`
  ngoài placeholder `x`); `apiKey` của `CreateAiCredentialDto` / `UpdateAiCredentialDto` là `writeOnly`;
  `AiCredentialDto` không có `apiKey`
- **Automated:** `tests/api/infra/swagger-docs.api.ts`

### TC-INFRA-008 — OpenAPI khai export dữ liệu là application zip không kèm schema

- **Requirement:** REQ-INFRA-04
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /api/v1/docs-json`, đọc `paths["/api/v1/me/export"].get.responses["200"]`
- **Mong đợi:** content chỉ có `application/zip`, không `schema`
- **Automated:** `tests/api/infra/swagger-docs.api.ts`

## Rate limit

### TC-INFRA-009 — response API báo hạn mức 100 request mỗi phút

- **Requirement:** REQ-INFRA-05
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /api/v1/auth/me` ẩn danh
- **Mong đợi:** header `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining` là số trong `[0, 100)`
- **Automated:** `tests/api/infra/rate-limit.api.ts`

### TC-INFRA-010 — vượt 100 request trong 60 giây trên health trả 429 kèm Retry-After

- **Requirement:** REQ-INFRA-05, REQ-INFRA-10
- **Layer:** api · **Priority:** P1
- **Bước:** gửi tuần tự tối đa 101 `GET /api/v1/health` (probe một-phát, không retry)
- **Mong đợi:** mọi response trước 429 đều `200`; có `429` sau không quá 100 request thành công; `Retry-After` là số
  giây trong `(0, 60]`
- **Kiểm chứng thêm:** body 429 không chứa stack / SQL / tên bảng (biên trên của REQ-INFRA-10)
- **Automated:** `tests/api/infra/rate-limit.api.ts`

## Header bảo mật, CORS

### TC-INFRA-011 — response API có header helmet và không có X-Powered-By

- **Requirement:** REQ-INFRA-06
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /api/v1/health` (200), `GET /api/v1/me/export` ẩn danh (401), `GET /api/v1/no-such-route` (404)
- **Mong đợi:** mỗi response có đủ `HELMET_HEADERS` với giá trị mặc định, không có `X-Powered-By`
- **Automated:** `tests/api/infra/security-headers.api.ts`

### TC-INFRA-012 — CORS cho phép origin web kèm credentials

- **Requirement:** REQ-INFRA-07
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `GET /api/v1/health` với `Origin: <web origin>`; preflight `OPTIONS /api/v1/documents` với
  `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: content-type`
- **Mong đợi:** cả hai `Access-Control-Allow-Origin` = web origin, `Access-Control-Allow-Credentials: true`; preflight
  `204` cho phép `POST`, `PATCH`, `DELETE`
- **Automated:** `tests/api/infra/cors.api.ts`

### TC-INFRA-013 — CORS không phản hồi lại origin lạ

- **Requirement:** REQ-INFRA-07
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /api/v1/health` và preflight `OPTIONS /api/v1/documents` với từng origin: `https://evil.example`,
  web origin + `.evil.example` (tiền tố giống), cùng host khác cổng, `null`
- **Mong đợi:** `Access-Control-Allow-Origin` không bao giờ bằng origin gửi lên và không là `*`
- **Automated:** `tests/api/infra/cors.api.ts`

### TC-INFRA-014 — trình duyệt ở origin web gọi được API kèm cookie phiên

- **Requirement:** REQ-INFRA-07
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** phiên e2e đã seed
- **Bước:** mở `/`
- **Mong đợi:** `GET /api/v1/auth/me` từ trình duyệt trả `200`; shell hiện trạng thái đã đăng nhập (Sign out / avatar),
  không hiện link đăng nhập của khách
- **Automated:** `tests/e2e/infra/reachability.e2e.ts`

## Validation

### TC-INFRA-015 — field lạ trong body bị loại và không ghi đè id hay chủ sở hữu

- **Requirement:** REQ-INFRA-08
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** user A, user B dùng-một-lần
- **Bước:** A `POST /api/v1/documents` (JSON, `kind: CV`, `save: true`, title, text) kèm field lạ `id`, `userId` = B,
  `parentId`, `isGuest`
- **Mong đợi:** `201`; `id` khác id gửi lên; `parentId` null; A đọc được tài liệu, B nhận `404`
- **Automated:** `tests/api/infra/validation.api.ts`

### TC-INFRA-016 — body sai DTO trả 400 nêu tên field

- **Requirement:** REQ-INFRA-08
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** user `POST /api/v1/documents` với `kind: "RESUME"` và `title` dài 201 ký tự (trên biên 200)
- **Mong đợi:** `400`, `error: "Bad Request"`, `statusCode: 400`, `message` là mảng có mục nhắc `kind` và mục nhắc `title`
- **Automated:** `tests/api/infra/validation.api.ts`

### TC-INFRA-017 — JSON hỏng trả 400 không phải 5xx

- **Requirement:** REQ-INFRA-08, REQ-INFRA-10
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Bước:** user `POST /api/v1/documents`, `Content-Type: application/json`, body `{"kind": "CV",`
- **Mong đợi:** `400`, body không chứa stack / đường dẫn file
- **Automated:** `tests/api/infra/validation.api.ts`

## Ngôn ngữ message server

### TC-INFRA-018 — message server theo tham số lang

- **Requirement:** REQ-INFRA-09
- **Layer:** api · **Priority:** P1
- **Bước:** ẩn danh `GET /api/v1/me/export?lang=vi`
- **Mong đợi:** `401`, `code: SIGN_IN_REQUIRED`, `message` = `auth.errors.signInRequired` (vi)
- **Automated:** `tests/api/infra/i18n.api.ts`

### TC-INFRA-019 — message server theo Accept-Language khi không có lang

- **Requirement:** REQ-INFRA-09
- **Layer:** api · **Priority:** P1
- **Bước:** ẩn danh `GET /api/v1/me/export`, `Accept-Language: vi`
- **Mong đợi:** `401`, message tiếng Việt
- **Automated:** `tests/api/infra/i18n.api.ts`

### TC-INFRA-020 — tham số lang thắng Accept-Language

- **Requirement:** REQ-INFRA-09
- **Layer:** api · **Priority:** P2
- **Bước:** ẩn danh `GET /api/v1/me/export?lang=en`, `Accept-Language: vi`
- **Mong đợi:** message tiếng Anh
- **Automated:** `tests/api/infra/i18n.api.ts`

### TC-INFRA-021 — ngôn ngữ thiếu hoặc không hỗ trợ rơi về tiếng Anh

- **Requirement:** REQ-INFRA-09
- **Layer:** api · **Priority:** P2
- **Bước:** ẩn danh `GET /api/v1/me/export` không lang, rồi `?lang=fr`, rồi `Accept-Language: fr`
- **Mong đợi:** cả ba message tiếng Anh
- **Automated:** `tests/api/infra/i18n.api.ts`

## Envelope lỗi

### TC-INFRA-022 — lỗi 400 401 404 không lộ stack, tên bảng hay SQL

- **Requirement:** REQ-INFRA-10
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** user dùng-một-lần
- **Bước:** 400 DTO (`POST /documents` sai kind), 400 `ParseUUIDPipe` (`PATCH /ai-credentials/not-a-uuid`), 401
  (`GET /me/export` ẩn danh), 404 route lạ, 404 tài liệu uuid không tồn tại, id không phải uuid (`GET /documents/not-a-uuid`)
- **Mong đợi:** đúng status (id không phải uuid: 4xx); không body nào khớp `LEAK_PATTERNS`
- **Automated:** `tests/api/infra/error-envelope.api.ts`

### TC-INFRA-023 — lỗi 500 không lộ stack, tên bảng hay SQL

- **Requirement:** REQ-INFRA-10
- **Layer:** api · **Priority:** P1
- **Bước:** gây lỗi 500 (vd tắt DB khi server đang chạy) rồi gọi một route đọc DB
- **Mong đợi:** `{"statusCode":500,"message":"Internal server error"}`, không chi tiết Prisma
- **Automated:** manual — không có cách gây 500 an toàn qua HTTP mà không sửa app hay làm sập DB dev dùng chung (Q6)

## Web client

### TC-INFRA-024 — web client trả lời ở origin web và hydrate

- **Requirement:** REQ-INFRA-11
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** mở `/`
- **Mong đợi:** document `< 400`, HTML; app hydrate (`window.__i18n`), `<main>` hiện
- **Automated:** `tests/e2e/infra/reachability.e2e.ts`

### TC-INFRA-025 — tải trang gốc không có response 5xx

- **Requirement:** REQ-INFRA-11
- **Layer:** e2e · **Priority:** P1
- **Bước:** ghi mọi response ≥ 500 trên tab, mở `/`, chờ network idle
- **Mong đợi:** không có response `5xx` nào (document, asset, API)
- **Automated:** `tests/e2e/infra/reachability.e2e.ts`
