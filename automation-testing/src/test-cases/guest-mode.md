# GUESTMODE — Test cases

Requirement: `docs/requirements/guest-mode.md` · quyết định: `docs/decisions/guest-mode.md`.
Lăng kính (CLAUDE.md, theo thứ tự): 1 truy vết · 2 phân vùng tương đương · 3 giá trị biên · 4 chuyển trạng thái ·
5 đoán lỗi / negative · 6 bảo mật & ngoài lề. Mỗi TC ghi lăng kính chính của nó.
UI spec chạy ở project `app-guest` (desktop) và `app-guest-mobile` (không cookie); `POST /match` luôn stub (D1) trừ
TC-GUESTMODE-042 (429 thật nhờ cắm bộ đếm) và TC-GUESTMODE-025 (`@live-ai`).

## Tạo khách và vòng đời

### TC-GUESTMODE-001 — POST /documents ẩn danh tạo khách 24h kèm cookie phiên HttpOnly, SameSite=Lax, Path=/

- **Requirement:** REQ-GUESTMODE-01
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data · **Lăng kính:** 1
- **Tiền điều kiện:** không cookie
- **Bước:** `POST /documents` (JSON dán JD, `save: false`)
- **Mong đợi:** 201; chủ tài liệu là user `isGuest = true`, `role = candidate`, `guestExpiresAt` ≈ now + 24h (±5s);
  `Set-Cookie: mcv_session=…; HttpOnly; SameSite=Lax; Path=/`, `Expires` = `guestExpiresAt` (±1s)
- **Kiểm chứng thêm:** row `Session` hết hạn cùng lúc `guestExpiresAt`; `GET /auth/me` bằng cookie đó trả `status: guest`
- **Automated:** `tests/api/guest-mode/guest-lifecycle.api.ts`

### TC-GUESTMODE-002 — Các endpoint khác gọi ẩn danh không tạo khách

- **Requirement:** REQ-GUESTMODE-01
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 2
- **Tiền điều kiện:** không cookie
- **Bước:** gọi ẩn danh `GET /auth/me`, `GET /documents/:id`, `GET /documents/:id/file`, `POST /match/runs`,
  `GET /match/runs/:id`, `POST /match`, `GET /match/:id`
- **Mong đợi:** không response nào set `mcv_session` sống; các endpoint `@AllowGuest` trả 401; số user khách không đổi
- **Automated:** `tests/api/guest-mode/guest-lifecycle.api.ts`

### TC-GUESTMODE-003 — Khách hoặc user đã có phiên gọi POST /documents không tạo khách mới

- **Requirement:** REQ-GUESTMODE-02
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 2
- **Tiền điều kiện:** một khách và một user có phiên (cắm DB)
- **Bước:** mỗi người gọi `POST /documents`
- **Mong đợi:** 201, tài liệu thuộc chính người gọi, không có `mcv_session` mới, số khách không đổi
- **Automated:** `tests/api/guest-mode/guest-lifecycle.api.ts`

### TC-GUESTMODE-004 — Tạo khách mới dọn khách đã hết hạn cùng dữ liệu của họ, giữ khách còn hạn

- **Requirement:** REQ-GUESTMODE-03
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data · **Lăng kính:** 4
- **Tiền điều kiện:** khách hết hạn 1 phút có CV, JD, run, kết quả, session; một khách còn hạn
- **Bước:** `POST /documents` ẩn danh (tạo khách mới)
- **Mong đợi:** user hết hạn, tài liệu và session của họ biến mất; khách còn hạn còn nguyên
- **Automated:** `tests/api/guest-mode/guest-lifecycle.api.ts`

### TC-GUESTMODE-005 — Tạo khách mới xoá bộ đếm quota của ngày UTC trước, giữ bộ đếm hôm nay

- **Requirement:** REQ-GUESTMODE-03
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data · **Lăng kính:** 3
- **Tiền điều kiện:** dòng `GuestUsage` (hash ngẫu nhiên) cho hôm qua và cho hôm nay
- **Bước:** `POST /documents` ẩn danh
- **Mong đợi:** dòng hôm qua bị xoá, dòng hôm nay còn
- **Automated:** `tests/api/guest-mode/guest-lifecycle.api.ts`

### TC-GUESTMODE-006 — Phiên khách hết hạn thành ẩn danh, cookie bị xoá và tài liệu cũ không đọc được

- **Requirement:** REQ-GUESTMODE-04
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 4
- **Tiền điều kiện:** khách có `guestExpiresAt` và session đã qua; có tài liệu
- **Bước:** `GET /auth/me` rồi `GET /documents/:id` bằng cookie cũ
- **Mong đợi:** `/auth/me` trả `status: anonymous` và `Set-Cookie: mcv_session=` (clear); tài liệu trả 401
  `SIGN_IN_REQUIRED` với `auth.errors.signInRequired`
- **Automated:** `tests/api/guest-mode/guest-lifecycle.api.ts`

## Quyền và cô lập

### TC-GUESTMODE-007 — Khách dùng được mọi endpoint của wizard

- **Requirement:** REQ-GUESTMODE-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 1
- **Tiền điều kiện:** khách có phiên
- **Bước:** dán CV, upload JD (PDF), đọc tài liệu và file, mở run, đọc run, đọc kết quả (cắm DB)
- **Mong đợi:** 201 / 200 cho cả bảy endpoint wizard (`POST /match` của khách được qua guard: xem TC-GUESTMODE-012, 020)
- **Automated:** `tests/api/guest-mode/guest-access.api.ts`

### TC-GUESTMODE-008 — Khách gọi endpoint cần tài khoản nhận 401 SIGN_IN_REQUIRED

- **Requirement:** REQ-GUESTMODE-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 2
- **Tiền điều kiện:** khách có phiên
- **Bước:** gọi 19 endpoint ngoài wizard (documents list/rename/parent/delete, match list, ai-credentials ×6,
  cover-letters ×4, cv-rewrite ×2, comparisons, me/export); một lần với `Accept-Language: vi`
- **Mong đợi:** mọi lời gọi 401 `{ code: "SIGN_IN_REQUIRED", message: auth.errors.signInRequired }`, message VI khi
  hỏi tiếng Việt; không endpoint gọi AI nào chạy (guard trả lời trước)
- **Automated:** `tests/api/guest-mode/guest-access.api.ts`

### TC-GUESTMODE-009 — Khách không đọc được tài liệu, file, run và kết quả của khách khác

- **Requirement:** REQ-GUESTMODE-06
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 6
- **Tiền điều kiện:** khách A; khách B có run + kết quả (cắm DB) và một file PDF
- **Bước:** A đọc tài liệu, file, run, kết quả của B
- **Mong đợi:** cả bốn trả 404
- **Automated:** `tests/api/guest-mode/guest-access.api.ts`

### TC-GUESTMODE-010 — Khách và user không đọc được dữ liệu của nhau

- **Requirement:** REQ-GUESTMODE-06
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 6
- **Tiền điều kiện:** một khách và một user, mỗi người có run + kết quả
- **Bước:** mỗi bên đọc CV, JD, run, kết quả của bên kia
- **Mong đợi:** 404 cả hai chiều
- **Automated:** `tests/api/guest-mode/guest-access.api.ts`

### TC-GUESTMODE-011 — Khách không mở được run trên tài liệu của người khác

- **Requirement:** REQ-GUESTMODE-06
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 5
- **Tiền điều kiện:** khách A và B, mỗi người một cặp tài liệu
- **Bước:** A `POST /match/runs` với cặp của B, rồi với CV của A + JD của B
- **Mong đợi:** 400 `matching.errors.documentNotOwned` cả hai lần, không tạo run (mã theo REQ-MULTIPROVIDERCOMPARE-08)
- **Automated:** `tests/api/guest-mode/guest-access.api.ts`

## Key hệ thống và quota

### TC-GUESTMODE-012 — Khách gửi credentialId bị chặn 403 GUEST_FORBIDDEN_CREDENTIAL và không tốn lượt

- **Requirement:** REQ-GUESTMODE-07
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 5
- **Tiền điều kiện:** khách có cặp tài liệu; bộ đếm IP loopback trống
- **Bước:** `POST /match` có `credentialId` (EN rồi VI)
- **Mong đợi:** 403 `GUEST_FORBIDDEN_CREDENTIAL`, message `matching.errors.guestCredential` đúng ngôn ngữ;
  `GET /auth/me` vẫn `used: 0`
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-013 — Quota mặc định 5 lượt/ngày, đếm theo HMAC của IP, không lưu IP thô

- **Requirement:** REQ-GUESTMODE-08
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 6
- **Tiền điều kiện:** bộ đếm loopback trống
- **Bước:** `GET /auth/me`; cắm `count = 2` dưới `HMAC-SHA256(SESSION_SECRET, ip)`; `GET /auth/me`; đọc bảng `GuestUsage`
- **Mong đợi:** `limit: 5, used: 0` rồi `used: 2` (server tra đúng khoá HMAC); mọi `ipHash` là 64 ký tự hex, không dòng
  nào là IP thô
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-014 — POST /match/runs không tính lượt

- **Requirement:** REQ-GUESTMODE-09
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 2
- **Tiền điều kiện:** khách có cặp tài liệu, bộ đếm trống
- **Bước:** `POST /match/runs` ba lần
- **Mong đợi:** 201 ×3, `used` vẫn 0
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-015 — POST /match trên tài liệu không thuộc khách trả 400 documentNotOwned và không tốn lượt

- **Requirement:** REQ-GUESTMODE-09, REQ-GUESTMODE-06
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 5
- **Tiền điều kiện:** khách A, cặp tài liệu của khách B, bộ đếm trống
- **Bước:** A `POST /match` với cặp của B
- **Mong đợi:** 400 `matching.errors.documentNotOwned` (REQ-CVJDMATCHINGWIZARD-32) và `used` vẫn 0 (không gọi AI)
- **Kiểm chứng thêm:** đang đỏ — BUG-GUESTMODE-01 (lượt bị trừ trước khi kiểm sở hữu)
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-016 — POST /match với runId của cặp tài liệu khác trả 400 và không tốn lượt

- **Requirement:** REQ-GUESTMODE-09
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 5
- **Tiền điều kiện:** khách có hai cặp tài liệu, một run mở trên cặp thứ hai
- **Bước:** `POST /match` cặp thứ nhất + `runId` của cặp thứ hai
- **Mong đợi:** 400 `matching.errors.runDocumentMismatch`, `used` vẫn 0
- **Kiểm chứng thêm:** đang đỏ — BUG-GUESTMODE-01
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-017 — POST /match với body sai trả 400 và không tốn lượt

- **Requirement:** REQ-GUESTMODE-09
- **Layer:** api · **Priority:** P2 · **Lăng kính:** 5
- **Tiền điều kiện:** khách, bộ đếm trống
- **Bước:** `POST /match` với `cvDocumentId` không phải uuid; với body thiếu `cvDocumentId`
- **Mong đợi:** 400 cả hai, `used` vẫn 0
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-018 — User đã đăng nhập gọi POST /match không bị trừ lượt khách

- **Requirement:** REQ-GUESTMODE-09
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 2
- **Tiền điều kiện:** user có phiên, cặp tài liệu không thuộc user (để server dừng trước call AI), bộ đếm trống
- **Bước:** user `POST /match`
- **Mong đợi:** 400 `matching.errors.documentNotOwned` (REQ-CVJDMATCHINGWIZARD-32), bộ đếm của IP vẫn 0
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-019 — Một lần chạy mà provider lỗi vẫn tốn một lượt

- **Requirement:** REQ-GUESTMODE-09
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 5
- **Tiền điều kiện:** khách còn lượt; provider của key hệ thống trả lỗi (key sai / hết quota / timeout)
- **Bước:** `POST /match`
- **Mong đợi:** 201 với `status: failed`, `errorCode` thuộc tập đóng; `used` tăng 1
- **Automated:** manual — dev server dùng key hệ thống thật và không có đường nào làm provider lỗi theo yêu cầu mà
  không đổi env/code của server (D1 cấm); TC-GUESTMODE-025 (`@live-ai`) tự kiểm nhánh này khi provider lỗi thật

### TC-GUESTMODE-020 — Lượt thứ limit+1 trả 429 GUEST_QUOTA_EXCEEDED với limit, resetsAt và không tạo kết quả

- **Requirement:** REQ-GUESTMODE-10
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 3
- **Tiền điều kiện:** khách có cặp + run; bộ đếm loopback cắm = `limit`, xác nhận qua `/auth/me` trước khi gọi
- **Bước:** `POST /match` (có `runId`)
- **Mong đợi:** 429 body đúng `{ statusCode: 429, code: "GUEST_QUOTA_EXCEEDED", message: matching.errors.guestQuota,
  limit, resetsAt: 00:00 UTC ngày mai }`, không `Retry-After`; run không có kết quả; `used` vẫn = `limit`
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-021 — Khách mới (cookie khác) trên cùng IP vẫn hết lượt

- **Requirement:** REQ-GUESTMODE-10
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 6
- **Tiền điều kiện:** bộ đếm cắm = `limit`
- **Bước:** hai khách mới, mỗi khách `POST /match` trên cặp của mình
- **Mong đợi:** 429 `GUEST_QUOTA_EXCEEDED` cả hai
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-022 — Thông báo hết lượt theo ngôn ngữ của request

- **Requirement:** REQ-GUESTMODE-10
- **Layer:** api · **Priority:** P2 · **Lăng kính:** 2
- **Tiền điều kiện:** bộ đếm cắm = `limit`
- **Bước:** `POST /match` với `Accept-Language: vi`
- **Mong đợi:** 429, message = `matching.errors.guestQuota` bản VI
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-023 — Bộ đếm của ngày UTC trước không còn tính sang hôm nay

- **Requirement:** REQ-GUESTMODE-11
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 3
- **Tiền điều kiện:** bộ đếm loopback của **hôm qua** = 5, hôm nay trống
- **Bước:** `GET /auth/me`
- **Mong đợi:** `guestQuota = { limit: 5, used: 0, resetsAt: 00:00 UTC ngày mai }`
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-024 — GET /auth/me trả guestQuota cho ẩn danh và khách, null cho user

- **Requirement:** REQ-GUESTMODE-12
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 2
- **Tiền điều kiện:** bộ đếm trống
- **Bước:** `/auth/me` ẩn danh; cắm `used = 3`; `/auth/me` của khách; `/auth/me` của user
- **Mong đợi:** ẩn danh `{ status: anonymous, user: null, guestQuota: { 5, 0, resetsAt } }`; khách `status: guest`,
  `used: 3`; user `guestQuota: null`
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

### TC-GUESTMODE-025 — Khách chạy match thật trên key hệ thống tốn đúng một lượt

- **Requirement:** REQ-GUESTMODE-09, REQ-GUESTMODE-12
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai · **Lăng kính:** 1
- **Tiền điều kiện:** `LIVE_AI=1`; khách có cặp + run; bộ đếm trống
- **Bước:** `POST /match` thật (provider thật, key hệ thống)
- **Mong đợi:** 201, `credentialId: null`, đúng `runId`; `used` = 1; nếu `succeeded` thì
  `overallScore = round(0.6 × semantic + 0.4 × keyword)`, nếu `failed` thì có `errorCode` (vẫn tốn lượt)
- **Automated:** `tests/api/guest-mode/guest-quota.api.ts`

## Claim khi đăng nhập (IdP giả của module auth — D5)

### TC-GUESTMODE-026 — Đăng nhập từ phiên khách chuyển tài liệu, run, kết quả sang tài khoản và về returnTo kèm claimed=1

- **Requirement:** REQ-GUESTMODE-13
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data · **Lăng kính:** 1
- **Tiền điều kiện:** khách có CV, JD, run, kết quả; instance Match CV của module auth trỏ IdP giả
- **Bước:** `/auth/login?returnTo=/wizard?runId=<id>` bằng cookie khách → code → `/auth/callback`
- **Mong đợi:** 302 về `<web>/wizard?runId=<id>&claimed=1` với `mcv_session` mới; CV, JD thuộc user, `isSaved = true`;
  run và kết quả thuộc user; user khách và session khách biến mất; user đọc được run bằng phiên mới
- **Automated:** `tests/api/guest-mode/claim.api.ts`

### TC-GUESTMODE-027 — Đăng nhập không khởi động từ khách này thì không claim dữ liệu của khách

- **Requirement:** REQ-GUESTMODE-14
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 6
- **Tiền điều kiện:** khách nạn nhân có run; login bắt đầu ẩn danh (mcv_oauth không niêm guest id)
- **Bước:** callback mang cookie của nạn nhân + mcv_oauth đó
- **Mong đợi:** 302 không có `claimed`; khách nạn nhân và dữ liệu (2 tài liệu, 1 run, 1 kết quả) còn nguyên
- **Automated:** `tests/api/guest-mode/claim.api.ts`

### TC-GUESTMODE-028 — Khách đã hết hạn lúc callback thì bỏ qua claim, đăng nhập vẫn thành công

- **Requirement:** REQ-GUESTMODE-14
- **Layer:** api · **Priority:** P1 · **Lăng kính:** 4
- **Tiền điều kiện:** khách bắt đầu login (guest id niêm trong mcv_oauth), rồi `guestExpiresAt` chuyển về quá khứ
- **Bước:** hoàn tất callback
- **Mong đợi:** 302 về `/wizard` không có `claimed`; user được tạo, không nhận tài liệu/run/kết quả nào
- **Automated:** `tests/api/guest-mode/claim.api.ts`

### TC-GUESTMODE-029 — Gọi lại callback sau khi đã claim không nhân đôi dữ liệu

- **Requirement:** REQ-GUESTMODE-14
- **Layer:** api · **Priority:** P2 · **Lăng kính:** 5
- **Tiền điều kiện:** khách đã đăng nhập và được claim (2 tài liệu, 1 run, 1 kết quả)
- **Bước:** hoàn tất lại cùng lần login (cùng state, cookie khách cũ, code mới cho cùng danh tính)
- **Mong đợi:** 302 không có `claimed`; số tài liệu/run/kết quả của user không đổi
- **Automated:** `tests/api/guest-mode/claim.api.ts`

## Đăng nhập thất bại

### TC-GUESTMODE-030 — Đăng nhập bị từ chối đưa về app với authError=denied, khách giữ nguyên phiên và dữ liệu

- **Requirement:** REQ-GUESTMODE-15
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 4
- **Tiền điều kiện:** khách có tài liệu; `mcv_oauth` niêm state + guest id (khoá của dev server)
- **Bước:** `/auth/callback?error=access_denied&state=<state>`
- **Mong đợi:** 302 `<web>/?authError=denied`, không `mcv_session` mới; khách vẫn `status: guest`, vẫn đọc và sở
  hữu tài liệu
- **Automated:** `tests/api/guest-mode/sign-in-failure.api.ts`

### TC-GUESTMODE-031 — Callback với state không khớp đưa về authError=state, khách giữ nguyên

- **Requirement:** REQ-GUESTMODE-15
- **Layer:** api · **Priority:** P2 · **Lăng kính:** 5
- **Tiền điều kiện:** như TC-GUESTMODE-030
- **Bước:** callback với `state` khác state đã niêm
- **Mong đợi:** 302 `<web>/?authError=state`, không phiên mới, khách còn nguyên
- **Automated:** `tests/api/guest-mode/sign-in-failure.api.ts`

### TC-GUESTMODE-038 — Đăng nhập thất bại về trang chủ với toast lỗi, khách vẫn ở chế độ khách

- **Requirement:** REQ-GUESTMODE-15
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 4
- **Tiền điều kiện:** trình duyệt mang cookie của một khách cắm DB
- **Bước:** mở `/?authError=denied`
- **Mong đợi:** toast `auth.error.denied`; `authError` biến khỏi URL; hero khách và nút "Sign in with Ducker ID" còn
- **Automated:** `tests/e2e/guest-mode/guest-home.e2e.ts`

### TC-GUESTMODE-050 — Khách huỷ đăng nhập ở IdP quay về app với toast lỗi và vẫn là khách

- **Requirement:** REQ-GUESTMODE-15
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 4
- **Tiền điều kiện:** khách có tài liệu; link Sign in đi tới instance auth + IdP giả ở chế độ `deny`
- **Bước:** bấm "Sign in" (header) / "Sign in with Ducker ID" (sidebar)
- **Mong đợi:** về trang chủ với toast `auth.error.denied`; API: khách vẫn `guest`, tài liệu vẫn đọc được
- **Automated:** `tests/e2e/guest-mode/sign-in-roundtrip.e2e.ts`

## UI — shell và trang chủ

### TC-GUESTMODE-032 — Sidebar khách chỉ có Dashboard và CV ↔ JD Matching, kèm thẻ Chế độ khách và thanh quota

- **Requirement:** REQ-GUESTMODE-16
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 1
- **Tiền điều kiện:** không cookie, bộ đếm trống
- **Bước:** mở `/` (mobile: mở drawer)
- **Mong đợi:** đúng 2 link nav (Dashboard, CV ↔ JD Matching); thẻ có eyebrow, pitch, "Free matches today",
  "5 / 5 left"; "Sign in with Ducker ID" trỏ `auth/login?returnTo=%2F`
- **Automated:** `tests/e2e/guest-mode/guest-shell.e2e.ts`

### TC-GUESTMODE-033 — Nút đăng nhập mang đường dẫn hiện tại làm returnTo

- **Requirement:** REQ-GUESTMODE-16
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 4
- **Bước:** mở `/wizard`
- **Mong đợi:** link Sign in của header (mobile) và của thẻ khách trỏ `auth/login?returnTo=%2Fwizard`
- **Automated:** `tests/e2e/guest-mode/guest-shell.e2e.ts`

### TC-GUESTMODE-034 — Header mobile/tablet của khách có nút Sign in

- **Requirement:** REQ-GUESTMODE-16
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 2
- **Bước:** mở `/` ở viewport dưới lg (desktop: skip — không có header)
- **Mong đợi:** link "Sign in" ở header trỏ `auth/login?returnTo=%2F`, không có nút Account
- **Automated:** `tests/e2e/guest-mode/guest-shell.e2e.ts`

### TC-GUESTMODE-035 — Route cần tài khoản hiện màn gate đăng nhập thay cho nội dung

- **Requirement:** REQ-GUESTMODE-16
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 4
- **Bước:** mở thẳng `/cv`
- **Mong đợi:** gate "Sign in to see your saved CVs", "Sign in with Ducker ID" trỏ `returnTo=%2Fcv`, "Back to matching"
- **Automated:** `tests/e2e/guest-mode/guest-shell.e2e.ts`

### TC-GUESTMODE-036 — Thẻ khách và thanh quota hiển thị tiếng Việt

- **Requirement:** REQ-GUESTMODE-16, REQ-GUESTMODE-23
- **Layer:** e2e · **Priority:** P2 · **Lăng kính:** 2
- **Bước:** mở `/`, chuyển `vi` (dev hook `window.__i18n` — D4)
- **Mong đợi:** "Chế độ khách", "Lượt đối chiếu miễn phí hôm nay", "Còn 5 / 5"
- **Automated:** `tests/e2e/guest-mode/guest-shell.e2e.ts`

### TC-GUESTMODE-037 — Trang chủ khách có hero với limit runtime và thẻ quyền lợi, không có thống kê hay kết quả gần đây

- **Requirement:** REQ-GUESTMODE-17
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 1
- **Tiền điều kiện:** không cookie; `limit` đọc từ `GET /auth/me`
- **Bước:** mở `/`, rồi bấm "Start matching →"
- **Mong đợi:** eyebrow, tiêu đề, note với `{{limit}}` runtime, "Sign in"; thẻ "Everything stays in one place" đủ 4
  dòng; không "Total matches", không "Recent matches"; CTA đưa tới `/wizard`
- **Automated:** `tests/e2e/guest-mode/guest-home.e2e.ts`

## UI — wizard khách

### TC-GUESTMODE-039 — Bước 1–2 của khách chỉ có Upload/Paste kèm ghi chú giữ 24 giờ, không có lưu hay tài liệu đã lưu

- **Requirement:** REQ-GUESTMODE-18
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 1
- **Bước:** mở `/wizard`; ở bước 1 rồi bước 2 kiểm tab, dán text
- **Mong đợi:** đúng 2 tab Upload file / Paste text; ghi chú `input.guestNote` có link "Sign in" →
  `returnTo=%2Fwizard`; không "Or reuse a saved …", không "Save for reuse" kể cả khi đã nhập
- **Automated:** `tests/e2e/guest-mode/guest-wizard.e2e.ts`

### TC-GUESTMODE-040 — Nhóm tab Upload/Paste cách vùng thả file ít nhất 16px

- **Requirement:** REQ-GUESTMODE-18
- **Layer:** e2e · **Priority:** P2 · **Lăng kính:** 3
- **Bước:** mở `/wizard`, đo khoảng cách đáy radiogroup → đỉnh drop zone
- **Mong đợi:** ≥ 16px
- **Automated:** `tests/e2e/guest-mode/guest-wizard.e2e.ts`

### TC-GUESTMODE-041 — Khách chạy match một lần trên key hệ thống và thấy kết quả giữ 24 giờ

- **Requirement:** REQ-GUESTMODE-19, REQ-GUESTMODE-20
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 1
- **Tiền điều kiện:** stub `POST /match` (kết quả `succeeded`, `credentialId: null`)
- **Bước:** dán JD → Next → dán CV → Next → Run match
- **Mong đợi:** bước 3 không "Run with", nút "Run match" (không dạng "· N providers"); bước 4 thẻ "System key · …",
  không "Improve my CV" / "Write cover letter"; thẻ "Kept for 24 hours, then deleted" + body + "Sign in to keep it" trỏ
  `auth/login?returnTo=/wizard?runId=<id của POST /match/runs>`; thanh dưới chỉ một nút "Start over"
- **Automated:** `tests/e2e/guest-mode/guest-wizard.e2e.ts`

### TC-GUESTMODE-042 — Hết lượt thật hiện thẻ quota với đếm ngược, đăng nhập, về trang chủ và sidebar còn 0 lượt

- **Requirement:** REQ-GUESTMODE-21, REQ-GUESTMODE-10
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 3
- **Tiền điều kiện:** bộ đếm loopback cắm = `limit`, xác nhận qua `/auth/me` (không stub — server trả 429 trước call AI)
- **Bước:** đi hết wizard, Run match
- **Mong đợi:** `POST /match` 429; thẻ "You have used today's {{limit}} free matches" + mô tả + "Resets in …" +
  "Sign in with Ducker ID" + "Back to home"; không thẻ giữ 24h; thanh quota "0 / {{limit}} left"
- **Automated:** `tests/e2e/guest-mode/guest-wizard.e2e.ts`

### TC-GUESTMODE-043 — Thẻ quota đếm ngược tới resetsAt và tải lại quota sau 429

- **Requirement:** REQ-GUESTMODE-21
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 3
- **Tiền điều kiện:** stub `POST /match` 429 với `limit: 3`, `resetsAt` = now + 2h29m59s
- **Bước:** Run match
- **Mong đợi:** tiêu đề với 3, "Resets in 2 h 30 min"; có thêm `GET /auth/me` sau 429
- **Automated:** `tests/e2e/guest-mode/guest-wizard.e2e.ts`

### TC-GUESTMODE-044 — Quota được tải lại sau một lần match thành công

- **Requirement:** REQ-GUESTMODE-21
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 4
- **Tiền điều kiện:** stub `POST /match` thành công
- **Bước:** Run match
- **Mong đợi:** thẻ kết quả hiện; có thêm `GET /auth/me` sau khi match xong
- **Automated:** `tests/e2e/guest-mode/guest-wizard.e2e.ts`

### TC-GUESTMODE-045 — Sau đăng nhập về /wizard?runId&claimed=1 mở bước 4 của run và hiện banner đã lưu, đóng banner bỏ claimed

- **Requirement:** REQ-GUESTMODE-22
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke · **Lăng kính:** 4
- **Tiền điều kiện:** user có phiên + run có kết quả (cắm DB), cookie đặt vào trình duyệt
- **Bước:** mở `/wizard?runId=<id>&claimed=1`, đóng banner
- **Mong đợi:** bước 4 (điểm tổng) của run; banner "Saved to your account." + body; đóng → `claimed` rời URL,
  banner mất, kết quả còn
- **Automated:** `tests/e2e/guest-mode/claimed-return.e2e.ts`

### TC-GUESTMODE-046 — Khách mở lại run qua ?runId thấy bước 4 với thẻ giữ 24 giờ nhưng không có banner claimed

- **Requirement:** REQ-GUESTMODE-22, REQ-GUESTMODE-20
- **Layer:** e2e · **Priority:** P2 · **Lăng kính:** 6
- **Tiền điều kiện:** khách có run + kết quả, cookie khách trong trình duyệt
- **Bước:** mở `/wizard?runId=<id>&claimed=1`
- **Mong đợi:** thẻ "System key · …" và thẻ giữ 24h; không banner (banner chỉ cho user)
- **Automated:** `tests/e2e/guest-mode/claimed-return.e2e.ts`

### TC-GUESTMODE-049 — Khách bấm Sign in to keep it, đăng nhập qua IdP giả và quay lại bước 4 với banner đã lưu

- **Requirement:** REQ-GUESTMODE-13, REQ-GUESTMODE-22
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke @creates-data · **Lăng kính:** 1
- **Tiền điều kiện:** link Sign in đi tới instance auth + IdP giả (auto-consent); stub `POST /match`
- **Bước:** wizard khách tới bước 4 → "Sign in to keep it"
- **Mong đợi:** về `/wizard?…claimed=1` với banner "Saved to your account."; run thuộc user mới; user khách bị xoá
- **Automated:** `tests/e2e/guest-mode/sign-in-roundtrip.e2e.ts`

## UI — copy và kích thước

### TC-GUESTMODE-047 — Copy khách có đủ EN/VI, nói rõ 24 giờ và hiển thị tiếng Việt với limit runtime

- **Requirement:** REQ-GUESTMODE-23
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 2
- **Bước:** kiểm `home.guest.note`, `input.guestNote`, `result.keep.title` ở EN và VI; mở `/` và `/wizard?runId=`
  (khách cắm DB) ở `vi`, Start over về bước 1
- **Mong đợi:** cả 6 chuỗi nêu "24"; hero VI với `{{limit}}` runtime; thẻ giữ 24 giờ VI + nút; ghi chú khách VI ở bước 1
- **Automated:** `tests/e2e/guest-mode/guest-copy-layout.e2e.ts`

### TC-GUESTMODE-048 — Nút trên màn khách cao 44px và full-width dưới md

- **Requirement:** REQ-GUESTMODE-23
- **Layer:** e2e · **Priority:** P1 · **Lăng kính:** 3
- **Bước:** đo các nút: hero (Start matching, Sign in), Sign in của header/thẻ khách, gate `/cv` (Sign in, Back to
  matching), "Sign in to keep it"
- **Mong đợi:** cao 44px; dưới 768px rộng bằng khối cha (trừ nút Sign in trong header)
- **Automated:** `tests/e2e/guest-mode/guest-copy-layout.e2e.ts`
