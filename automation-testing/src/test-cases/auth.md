# AUTH — Test cases

Requirement: `src/docs/requirements/auth.md` · quyết định: `src/docs/decisions/auth.md`.
"Instance riêng" = server Match CV chạy riêng cho module này, `OIDC_*` trỏ vào IdP giả (D5); "dev" = dev server `:5200`.

## Bắt đầu đăng nhập

### TC-AUTH-001 — login chuyển tới trang authorize của IdP với đủ tham số OIDC và PKCE

- **Requirement:** REQ-AUTH-01
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** instance riêng, người gọi ẩn danh
- **Bước:** `GET /auth/login?returnTo=/wizard` hai lần
- **Mong đợi:** `302` tới `<issuer>/oauth/authorize` với `response_type=code`, `scope=openid profile email`, `client_id`, `redirect_uri` = callback của instance, `code_challenge` (43 ký tự base64url), `code_challenge_method=S256`, `state`, `nonce`; hai lần gọi khác `state`/`nonce`/`code_challenge`
- **Kiểm chứng thêm:** `mcv_oauth` giải niêm ra đúng `state`, `nonce`, `returnTo`
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-002 — cookie mcv_oauth chỉ sống 10 phút, HttpOnly, SameSite=Lax và chỉ gửi về /api/v1/auth

- **Requirement:** REQ-AUTH-02
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** instance riêng (dev, `NODE_ENV=development`)
- **Bước:** `GET /auth/login`, đọc `Set-Cookie: mcv_oauth`
- **Mong đợi:** `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=600`, không `Secure` (dev); giá trị niêm không lộ `state`/verifier
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-003 — returnTo là đường dẫn tương đối hợp lệ được giữ nguyên, kể cả dài đúng 2048 ký tự

- **Requirement:** REQ-AUTH-03
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** dev, user đã đăng nhập (nhánh tắt — lọc chạy trước, không chạm IdP)
- **Bước:** `GET /auth/login?returnTo=` với `/`, `/wizard?runId=r1`, `/cv`, `/compare/abc?jd=x%20y`, chuỗi 2048 ký tự
- **Mong đợi:** `302` tới `CLIENT_ORIGIN + returnTo` nguyên vẹn (biên trên 2048 vẫn giữ)
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-004 — returnTo không an toàn luôn rơi về / trên CLIENT_ORIGIN

- **Requirement:** REQ-AUTH-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** dev, user đã đăng nhập
- **Bước:** `returnTo` = URL tuyệt đối, `//evil.test/x`, `/\evil.test`, `/<tab>/evil.test`, có `\n`, có `\x7f`, không bắt đầu `/`, `javascript:`, rỗng, lặp key, 2049 ký tự; và không có `returnTo`
- **Mong đợi:** mọi trường hợp `302` tới `CLIENT_ORIGIN/`
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-005 — returnTo niêm trong mcv_oauth cũng được lọc, redirect cuối luôn nằm trên CLIENT_ORIGIN

- **Requirement:** REQ-AUTH-03
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** instance riêng, IdP giả
- **Bước:** đăng nhập đầy đủ với `returnTo=//evil.test/x`, rồi với `/wizard?runId=r1`
- **Mong đợi:** cookie niêm `returnTo="/"`, callback về `CLIENT_ORIGIN/`; lần hai về `CLIENT_ORIGIN/wizard?runId=r1`
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-006 — user đã đăng nhập gọi login được đưa thẳng về returnTo, không đi IdP, không có mcv_oauth

- **Requirement:** REQ-AUTH-04
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** dev, user đã đăng nhập
- **Bước:** `GET /auth/login?returnTo=/wizard?runId=r1`
- **Mong đợi:** `302` tới `CLIENT_ORIGIN/wizard?runId=r1`, không có `Set-Cookie: mcv_oauth`
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-007 — IdP không truy cập được thì login về /?authError=server, không set mcv_oauth

- **Requirement:** REQ-AUTH-05
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** instance dùng một lần, `OIDC_ISSUER` trỏ vào cổng đóng (discovery chết)
- **Bước:** `GET /auth/login?returnTo=/wizard`
- **Mong đợi:** `302` tới `CLIENT_ORIGIN/?authError=server`, không `mcv_oauth`, không JSON
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

### TC-AUTH-008 — server chưa cấu hình OIDC thì login và callback về /?authError=server

- **Requirement:** REQ-AUTH-05
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** instance dùng một lần, không có nhóm `OIDC_*`
- **Bước:** `GET /auth/login`; `GET /auth/callback?code=c&state=s`
- **Mong đợi:** login `302 /?authError=server` không `mcv_oauth`; callback vẫn là redirect `/?authError=…`, không 503/JSON (Q2)
- **Automated:** `tests/api/auth/sign-in-start.api.ts`

## Hoàn tất đăng nhập

### TC-AUTH-009 — callback hợp lệ tạo user candidate, cấp session mới, xoá mcv_oauth và về returnTo

- **Requirement:** REQ-AUTH-06, REQ-AUTH-10
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Tiền điều kiện:** instance riêng; danh tính IdP mới có `email`, `name`, `picture`
- **Bước:** login → code → `GET /auth/callback?code&state&iss`
- **Mong đợi:** `302` về `CLIENT_ORIGIN/wizard?runId=r1`, `mcv_session` mới, `mcv_oauth` bị xoá; `User` `role=candidate`, `isGuest=false`, mirror email/tên/ảnh
- **Kiểm chứng thêm:** session dùng được trên dev server (`/auth/me` → `user`)
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-010 — đổi code bằng client_secret_basic và PKCE verifier khớp code_challenge

- **Requirement:** REQ-AUTH-06
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** instance riêng
- **Bước:** đăng nhập đầy đủ, đọc request `/oauth/token` IdP giả nhận được
- **Mong đợi:** `Authorization: Basic client_id:secret`, `grant_type=authorization_code`, `redirect_uri` đúng, `code_verifier` = verifier niêm, S256 khớp challenge; secret không nằm trong body
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-011 — đăng nhập lại cùng sub cập nhật hồ sơ, claim vắng không xoá giá trị cũ, không tạo user thứ hai

- **Requirement:** REQ-AUTH-06, REQ-AUTH-10
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** đăng nhập với tên + ảnh; đăng nhập lại cùng `sub` với email mới, không có `name`/`picture`
- **Mong đợi:** một row `User` duy nhất, cùng id; email cập nhật, tên + ảnh giữ nguyên
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-012 — callback thiếu, hỏng hoặc hết hạn mcv_oauth về /?authError=state, không tạo session

- **Requirement:** REQ-AUTH-07
- **Layer:** api · **Priority:** P1
- **Bước:** callback với code + state đúng nhưng cookie: không có / bị sửa / niêm hợp lệ nhưng `exp` đã qua / niêm bằng secret khác / rác
- **Mong đợi:** mọi biến thể `302 /?authError=state`, không `mcv_session`
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-013 — state không khớp về /?authError=state và giữ mcv_oauth của lần đăng nhập đang dở

- **Requirement:** REQ-AUTH-07, REQ-AUTH-08
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Bước:** login; callback với `state=forged`; rồi callback thật
- **Mong đợi:** lần giả `302 /?authError=state`, không đụng `mcv_oauth`, IdP không nhận request token; lần thật vẫn hoàn tất
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-014 — error kèm state giả không huỷ được lần đăng nhập đang dở

- **Requirement:** REQ-AUTH-08
- **Layer:** api · **Priority:** P1
- **Bước:** login; callback `?error=access_denied&state=forged`
- **Mong đợi:** `/?authError=state` (không phải `denied`), không xoá `mcv_oauth`
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-015 — IdP từ chối kèm đúng state về /?authError=denied và xoá mcv_oauth

- **Requirement:** REQ-AUTH-07, REQ-AUTH-08
- **Layer:** api · **Priority:** P1
- **Bước:** login; callback `?error=access_denied&state=<đúng>`
- **Mong đợi:** `302 /?authError=denied`, `mcv_oauth` bị xoá, không session
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-016 — iss khác OIDC_ISSUER về /?authError=iss

- **Requirement:** REQ-AUTH-07
- **Layer:** api · **Priority:** P1
- **Bước:** callback với code + state đúng, `iss=http://evil.test`
- **Mong đợi:** `302 /?authError=iss`, `mcv_oauth` bị xoá, code không được đổi
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-017 — thiếu code dù state đúng về /?authError=state

- **Requirement:** REQ-AUTH-07
- **Layer:** api · **Priority:** P2
- **Bước:** callback chỉ có `state` đúng
- **Mong đợi:** `302 /?authError=state`, không session
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-018 — đổi code thất bại về /?authError=exchange, xoá mcv_oauth, không tạo session

- **Requirement:** REQ-AUTH-07, REQ-AUTH-08
- **Layer:** api · **Priority:** P1
- **Bước:** IdP giả trả `/oauth/token` lỗi: 400, 500, 200 không có `id_token`
- **Mong đợi:** mỗi lỗi `302 /?authError=exchange`, `mcv_oauth` bị xoá, không session, không user
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-019 — id_token không hợp lệ về /?authError=token và không tạo user

- **Requirement:** REQ-AUTH-07
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** IdP giả trả id_token: ký bằng khoá khác, `kid` lạ, `alg=HS256`, `aud` khác, `iss` khác, đã hết hạn, `nonce` khác
- **Mong đợi:** mỗi trường hợp `302 /?authError=token`, không session, không user
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-020 — đăng nhập thu hồi session đang có và cấp token mới

- **Requirement:** REQ-AUTH-09
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Tiền điều kiện:** một session user hợp lệ đi kèm callback (session cài sẵn)
- **Bước:** callback hợp lệ gửi kèm cookie phiên cũ
- **Mong đợi:** `mcv_session` mới khác cũ; phiên cũ không còn resolve được, phiên mới resolve được
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-021 — đăng nhập dọn khách hết hạn và bộ đếm GuestUsage của ngày trước

- **Requirement:** REQ-AUTH-11
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** một khách hết hạn, một khách còn hạn, `GuestUsage` hôm qua và hôm nay (UTC)
- **Bước:** đăng nhập đầy đủ
- **Mong đợi:** khách hết hạn và dòng hôm qua bị xoá; khách còn hạn và dòng hôm nay còn
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-022 — khách bắt đầu đăng nhập được nhận vào tài khoản và session khách bị thu hồi

- **Requirement:** REQ-AUTH-30, REQ-AUTH-09
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Tiền điều kiện:** khách tạo bằng `POST /documents` ẩn danh trên dev
- **Bước:** login (kèm cookie khách) → callback (kèm cookie khách + `mcv_oauth`)
- **Mong đợi:** `mcv_oauth` niêm id khách; redirect `…/wizard?claimed=1`; session mới khác session khách; session khách bị thu hồi; tài liệu khách thuộc user mới
- **Automated:** `tests/api/auth/callback.api.ts`

### TC-AUTH-023 — đăng nhập cài từ trình duyệt khác không nhận dữ liệu khách của nạn nhân

- **Requirement:** REQ-AUTH-30
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Bước:** kẻ tấn công login không có khách; cài `mcv_oauth` + code/state của mình lên trình duyệt có cookie khách của nạn nhân → callback
- **Mong đợi:** `302` về `CLIENT_ORIGIN/` (không `claimed=1`); tài liệu vẫn thuộc khách nạn nhân, chưa lưu
- **Automated:** `tests/api/auth/callback.api.ts`

## Session, đăng xuất, `/auth/me`

### TC-AUTH-024 — cookie mcv_session HttpOnly, SameSite=Lax, Path=/, hạn 7 ngày khớp Session.expiresAt và không trượt

- **Requirement:** REQ-AUTH-12
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** đăng nhập đầy đủ trên instance riêng; gọi `/auth/me` trên dev bằng cookie mới
- **Mong đợi:** cookie `HttpOnly; SameSite=Lax; Path=/`, không `Secure` (dev), `Expires` = `Session.expiresAt` (±1 s) ≈ now + 7 ngày; dùng phiên không gửi lại cookie và không đổi `expiresAt`
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-025 — DB chỉ lưu sha256 của token phiên; token của IdP không ra DB, trình duyệt hay log

- **Requirement:** REQ-AUTH-13
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Bước:** đăng nhập đầy đủ; quét row `User`/`Session` của user, response callback + `/auth/me`, log stdout/stderr của instance
- **Mong đợi:** `Session.id = sha256(token)`, không row nào có id = token thô; code / id_token / access token / token thô không có trong DB, không tới trình duyệt, không có trong log (log cũng không có email)
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-026 — cookie phiên lạ, bị sửa hoặc hết hạn bị coi là ẩn danh và bị xoá

- **Requirement:** REQ-AUTH-14
- **Layer:** api · **Priority:** P1
- **Bước:** `/auth/me` và `GET /documents` trên dev với token lạ, token sửa một ký tự, token của session đã hết hạn
- **Mong đợi:** `status:"anonymous"`, `Set-Cookie: mcv_session=` (xoá), `/documents` 401; row hết hạn bị xoá khỏi DB; phiên thật không bị ảnh hưởng
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-053 — cookie phiên không giải mã được cũng bị coi là ẩn danh và bị xoá

- **Requirement:** REQ-AUTH-14
- **Layer:** api · **Priority:** P2
- **Bước:** `/auth/me` với `Cookie: mcv_session=%%%` (percent-encoding hỏng)
- **Mong đợi:** `status:"anonymous"` và `Set-Cookie: mcv_session=` (xoá)
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-027 — đăng xuất trả 204, xoá phiên và cookie cũ không còn xác thực được

- **Requirement:** REQ-AUTH-15
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** user riêng gọi `/documents` (200) → `POST /auth/logout` → gọi lại bằng cookie cũ
- **Mong đợi:** `204`, `Set-Cookie: mcv_session=`, row `Session` bị xoá; cookie cũ: `/documents` 401, `/auth/me` anonymous
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-028 — đăng xuất khi không có phiên vẫn 204; GET /auth/logout không đăng xuất

- **Requirement:** REQ-AUTH-15
- **Layer:** api · **Priority:** P2
- **Bước:** `POST /auth/logout` ẩn danh hai lần; user riêng gọi `GET /auth/logout`
- **Mong đợi:** hai lần `204`; GET trả lỗi 4xx và phiên vẫn dùng được
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-029 — đăng xuất chỉ đăng xuất Match CV, không gọi Ducker ID

- **Requirement:** REQ-AUTH-15
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Bước:** đăng nhập trên instance riêng → `POST /auth/logout`
- **Mong đợi:** `204`, phiên bị thu hồi, IdP giả không nhận request nào sau đó
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-030 — /auth/me cho người ẩn danh trả quota khách theo IP

- **Requirement:** REQ-AUTH-17
- **Layer:** api · **Priority:** P1
- **Mong đợi:** `200`, `status:"anonymous"`, `user:null`, `guestQuota {limit, used (số), resetsAt (ngày hợp lệ)}`
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-031 — /auth/me cho user trả hồ sơ, không có field token nào

- **Requirement:** REQ-AUTH-17
- **Layer:** api · **Priority:** P1
- **Mong đợi:** `{status:"user", user:{id, email, fullName, avatar}, guestQuota:null}` — đúng các khoá đó, không token / secret / sub
- **Automated:** `tests/api/auth/session.api.ts`

### TC-AUTH-032 — /auth/me cho khách trả guest và quota

- **Requirement:** REQ-AUTH-17
- **Layer:** api · **Priority:** P1
- **Mong đợi:** `status:"guest"`, `user:null`, `guestQuota` có `limit`, `used`; không lộ token
- **Automated:** `tests/api/auth/session.api.ts`

## Ma trận truy cập

### TC-AUTH-033 — endpoint chỉ dành cho user trả 401 SIGN_IN_REQUIRED cho người ẩn danh và khách

- **Requirement:** REQ-AUTH-19
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** mọi endpoint trong REQ-AUTH-19 (19 method+path) gọi bằng ẩn danh, khách, user
- **Mong đợi:** ẩn danh và khách: `401`, `code:"SIGN_IN_REQUIRED"`, message `serverMessage("auth.errors.signInRequired")`; user: không 401
- **Automated:** `tests/api/auth/access-matrix.api.ts`

### TC-AUTH-034 — 401 trả message theo ngôn ngữ của request

- **Requirement:** REQ-AUTH-19
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /documents` ẩn danh và khách với `Accept-Language: vi` rồi `en`
- **Mong đợi:** `Cần đăng nhập.` / `Sign in required.` (đọc từ `server/src/i18n`)
- **Automated:** `tests/api/auth/access-matrix.api.ts`

### TC-AUTH-035 — endpoint mở cho khách: người ẩn danh 401, khách và user qua được guard

- **Requirement:** REQ-AUTH-20
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** 6 endpoint trong REQ-AUTH-20 (id không tồn tại / body rỗng — dừng ở validation, không tới AI)
- **Mong đợi:** ẩn danh `401 SIGN_IN_REQUIRED`; khách và user không 401
- **Automated:** `tests/api/auth/access-matrix.api.ts`

### TC-AUTH-036 — endpoint public không bao giờ trả 401 dù ở trạng thái nào

- **Requirement:** REQ-AUTH-21
- **Layer:** api · **Priority:** P1
- **Bước:** ẩn danh / khách / user gọi `/health`, `/auth/me`, `/auth/callback` (không cookie) trên dev; `POST /auth/logout` ẩn danh + khách riêng; `/auth/login` ẩn danh + khách trên instance riêng, user trên dev
- **Mong đợi:** `200` / `200` / `302` / `204` / `302`, không lần nào `401`
- **Automated:** `tests/api/auth/access-matrix.api.ts`

### TC-AUTH-037 — POST /documents ẩn danh tạo khách mới; khách và user gọi thì không tạo khách

- **Requirement:** REQ-AUTH-21
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Mong đợi:** ẩn danh: `201`, `Set-Cookie: mcv_session` HttpOnly, chủ tài liệu là khách, cookie đó vẫn 401 ở `/documents`; khách/user: `201`, tài liệu thuộc chính họ, không cookie mới
- **Automated:** `tests/api/auth/access-matrix.api.ts`

### TC-AUTH-038 — không đọc được tài liệu, match hay run của người khác (404, không lộ tồn tại)

- **Requirement:** REQ-AUTH-22
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Tiền điều kiện:** user khác sở hữu CV, JD, match, run (seed thẳng DB)
- **Bước:** khách và user gọi `GET /documents/:id`, `/documents/:id/file`, `/match/:id`, `/match/runs/:id` của người đó
- **Mong đợi:** `404`, giống hệt khi id không tồn tại; chủ sở hữu vẫn đọc được
- **Automated:** `tests/api/auth/access-matrix.api.ts`

## Rate limit, CORS

### TC-AUTH-039 — login và callback chặn 429 sau 20 request trong một phút

- **Requirement:** REQ-AUTH-23
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** instance dùng một lần (bộ đếm riêng)
- **Bước:** 21 lần `GET /auth/callback`, rồi 21 lần `GET /auth/login` (không tự chờ khi 429)
- **Mong đợi:** 20 lần đầu `302`, lần 21 `429`; `/auth/me` vẫn `200`
- **Automated:** `tests/api/auth/security.api.ts`

### TC-AUTH-040 — CORS chỉ cho CLIENT_ORIGIN kèm credentials, không phản chiếu origin lạ

- **Requirement:** REQ-AUTH-24
- **Layer:** api · **Priority:** P1
- **Bước:** `/auth/me` với `Origin` = web, `http://evil.test`, `http://localhost:5999`, `null`
- **Mong đợi:** origin web: `Access-Control-Allow-Origin` = web + `Allow-Credentials: true`; origin lạ: không bao giờ được phản chiếu, không `*`
- **Automated:** `tests/api/auth/security.api.ts`

## Giao diện

### TC-AUTH-041 — nút đăng nhập trên shell dẫn tới API login kèm đường dẫn hiện tại

- **Requirement:** REQ-AUTH-25
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** không có phiên
- **Bước:** mở `/wizard?from=e2e`; dưới lg đọc nút "Sign in" ở header rồi mở drawer; từ lg đọc thẻ Guest mode
- **Mong đợi:** mọi nút là link `href = <API>/auth/login?returnTo=%2Fwizard%3Ffrom%3De2e`
- **Automated:** `tests/e2e/auth/sign-in-entry.e2e.ts`

### TC-AUTH-042 — sidebar thu gọn vẫn có nút đăng nhập dạng icon với nhãn đọc được

- **Requirement:** REQ-AUTH-25
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** desktop (sidebar chỉ có từ lg — tablet/mobile skip), không có phiên
- **Bước:** thu gọn sidebar
- **Mong đợi:** icon-link `aria-label` "Sign in with Ducker ID", đúng `href`; thẻ Guest mode ẩn
- **Automated:** `tests/e2e/auth/sign-in-entry.e2e.ts`

### TC-AUTH-043 — đăng nhập đầy đủ từ màn mời đăng nhập qua IdP giả quay về đúng trang với giao diện user

- **Requirement:** REQ-AUTH-06, REQ-AUTH-25, REQ-AUTH-27
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Tiền điều kiện:** không có phiên; `/auth/login` của dev API được chuyển sang instance riêng (IdP giả tự đồng ý)
- **Bước:** mở `/cv` → bấm "Sign in with Ducker ID"
- **Mong đợi:** về `<web>/cv`, màn gate biến mất, shell hiện tên + email của danh tính IdP; `User` được tạo
- **Automated:** `tests/e2e/auth/sign-in-entry.e2e.ts`

### TC-AUTH-044 — sáu route cần tài khoản hiện màn mời đăng nhập và không gọi API của trang

- **Requirement:** REQ-AUTH-28, REQ-AUTH-25
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không có phiên
- **Bước:** mở lần lượt `/cv`, `/jd`, `/ai-credentials`, `/my-data`, `/compare/<id>`, `/cv-rewrite/<id>`
- **Mong đợi:** tiêu đề `gate.*` đúng route, `gate.description`, link "Sign in with Ducker ID" (`returnTo` = route), "Back to matching"; URL giữ nguyên; request API duy nhất là `/auth/me`
- **Automated:** `tests/e2e/auth/sign-in-gate.e2e.ts`

### TC-AUTH-045 — khách cũng thấy màn mời đăng nhập và Quay lại đối chiếu về /wizard

- **Requirement:** REQ-AUTH-28
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** cookie của một khách riêng
- **Bước:** mở `/my-data` → "Back to matching"
- **Mong đợi:** màn gate `gate.myData`; bấm về `/wizard`
- **Automated:** `tests/e2e/auth/sign-in-gate.e2e.ts`

### TC-AUTH-046 — màn mời đăng nhập có bản tiếng Việt và nút cao 44px

- **Requirement:** REQ-AUTH-29, REQ-AUTH-28
- **Layer:** e2e · **Priority:** P2
- **Bước:** mở `/ai-credentials`, đổi `vi` qua `window.__i18n` (D4)
- **Mong đợi:** tiêu đề, mô tả, hai nút hiện bằng tiếng Việt; "Sign in with Ducker ID" và "Back to matching" cao 44px
- **Automated:** `tests/e2e/auth/sign-in-gate.e2e.ts`

### TC-AUTH-047 — authError hiện đúng một toast cho từng mã, mã lạ hiện thông báo chung

- **Requirement:** REQ-AUTH-26
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/?authError=` với `denied`, `state`, `iss`, `exchange`, `token`, `server`, `teapot`
- **Mong đợi:** đúng một toast `auth.error.<code>`; mã lạ → `auth.error.generic`
- **Automated:** `tests/e2e/auth/auth-error-toast.e2e.ts`

### TC-AUTH-048 — authError bị xoá khỏi URL và tải lại không hiện lại toast

- **Requirement:** REQ-AUTH-26
- **Layer:** e2e · **Priority:** P2
- **Bước:** mở `/?authError=denied` → chờ URL sạch → reload
- **Mong đợi:** URL không còn `authError`; sau reload không có toast auth nào
- **Automated:** `tests/e2e/auth/auth-error-toast.e2e.ts`

### TC-AUTH-049 — toast authError hiện bằng tiếng Việt

- **Requirement:** REQ-AUTH-26, REQ-AUTH-29
- **Layer:** e2e · **Priority:** P2
- **Bước:** trình duyệt ngôn ngữ vi mở `/?authError=denied`
- **Mong đợi:** toast "Đã huỷ đăng nhập."
- **Automated:** manual — toast bắn ở lần render đầu, trước khi dev hook `window.__i18n` kịp đổi ngôn ngữ và app không có nút đổi ngôn ngữ (D4, quyết định T4); bản dịch có mặt được kiểm gián tiếp ở TC-AUTH-046

### TC-AUTH-050 — shell của user hiện đủ 6 mục điều hướng và danh tính tài khoản

- **Requirement:** REQ-AUTH-27, REQ-AUTH-18
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e đã seed (chỉ đọc)
- **Bước:** mở `/wizard`; dưới lg mở drawer, rồi mở menu "Account"
- **Mong đợi:** `/auth/me` của client trả `user` (cookie đi kèm request khác cổng); 6 mục Dashboard → My data đúng thứ tự; avatar chữ cái đầu, tên, email, nút Sign out
- **Automated:** `tests/e2e/auth/account.e2e.ts`

### TC-AUTH-051 — đăng xuất từ shell về trang chủ ở giao diện khách

- **Requirement:** REQ-AUTH-16, REQ-AUTH-15
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke, @creates-data
- **Tiền điều kiện:** user riêng (không bao giờ là user e2e dùng chung)
- **Bước:** mở `/cv` → Sign out (thẻ user desktop / menu Account dưới lg) → mở lại `/cv`
- **Mong đợi:** về `/`; shell khách (nút đăng nhập, chỉ 2 mục điều hướng); row `Session` bị xoá; `/cv` hiện màn gate
- **Automated:** `tests/e2e/auth/account.e2e.ts`

### TC-AUTH-052 — /auth/me lỗi mạng thì hiện giao diện khách, không kẹt skeleton

- **Requirement:** REQ-AUTH-18
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** không có phiên; mọi request `/auth/me` bị abort ở mức mạng
- **Bước:** mở `/cv`
- **Mong đợi:** sau khi React Query hết lượt thử lại (≈7 s), màn gate `gate.cv` hiện và skeleton biến mất
- **Automated:** `tests/e2e/auth/account.e2e.ts`
