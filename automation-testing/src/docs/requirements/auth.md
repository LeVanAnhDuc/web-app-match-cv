# AUTH — Đăng nhập qua Ducker ID, phiên, đăng xuất, phân quyền

**Bắt đầu đăng nhập — `GET /auth/login`**

- **REQ-AUTH-01** `GET /api/v1/auth/login?returnTo=<path>` (public) trả `302` tới `<OIDC_ISSUER>/oauth/authorize` với `response_type=code`, `scope=openid profile email`, `code_challenge` + `code_challenge_method=S256`, `state`, `nonce`, `client_id`, `redirect_uri`.
- **REQ-AUTH-02** Kèm theo là cookie `mcv_oauth` (niêm AES-GCM): `HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=600` (+ `Secure` ở production); cookie không gửi tới path nào khác.
- **REQ-AUTH-03** `returnTo` chỉ nhận đường dẫn tương đối: phải bắt đầu `/`, không `//`, không chứa `\`, không ký tự điều khiển (`\x00-\x1f\x7f`), dài ≤ 2048; mọi giá trị khác (URL tuyệt đối, `//evil.com`, `/\t/evil.com`, rỗng, lặp key) → `/`. Redirect cuối luôn nằm trên `CLIENT_ORIGIN`.
- **REQ-AUTH-04** User đã đăng nhập gọi `/auth/login` → `302` thẳng `CLIENT_ORIGIN + returnTo`, không đi Ducker ID, không set `mcv_oauth`.
- **REQ-AUTH-05** Không bắt đầu được (thiếu `OIDC_*`/`SESSION_SECRET`, discovery của Ducker ID chết) → `302` tới `CLIENT_ORIGIN/?authError=server`, không set `mcv_oauth`, không bao giờ trả JSON thô cho một điều hướng trang.

**Hoàn tất đăng nhập — `GET /auth/callback`**

- **REQ-AUTH-06** Callback hợp lệ (state khớp, chưa quá 10 phút, `iss` khớp `OIDC_ISSUER`, đổi code bằng `client_secret_basic` + PKCE verifier, id_token RS256 hợp lệ theo JWKS/kid, `aud = client_id`, chưa hết hạn, `nonce` khớp) → upsert `User` theo `externalSub = sub`, mirror `email`/`name`/`picture` (claim vắng không xoá giá trị cũ), tạo `Session` mới, set `mcv_session`, xoá `mcv_oauth`, `302` về `CLIENT_ORIGIN + returnTo`.
- **REQ-AUTH-07** Mỗi lỗi callback redirect `CLIENT_ORIGIN/?authError=<code>` không lộ chi tiết và không tạo session/user: thiếu/sai/hết hạn `mcv_oauth`, `state` sai hoặc thiếu `code` → `state`; IdP trả `?error=` (với state đúng) → `denied`; `iss` sai → `iss`; đổi code lỗi (non-2xx, thiếu id_token) → `exchange`; id_token sai chữ ký/kid/alg/aud/iss/exp/nonce → `token`; lỗi khác → `server`.
- **REQ-AUTH-08** `state` dùng một lần: khi state đã khớp thì `mcv_oauth` bị xoá dù kết quả ra sao; callback có state **không** khớp (link của người lạ) **không** xoá `mcv_oauth` của lần đăng nhập đang dở; `?error=` không kèm state đúng không huỷ được lần đăng nhập.
- **REQ-AUTH-09** Đăng nhập luôn cấp session mới và thu hồi session đang có (khách hoặc user cũ) — chống session fixation.
- **REQ-AUTH-10** User mới tạo từ đăng nhập có `role = candidate`, `isGuest = false`; đăng nhập lại cùng `sub` không tạo user thứ hai.
- **REQ-AUTH-11** Mỗi lần đăng nhập chạy dọn lười: xoá user khách đã hết hạn và bộ đếm `GuestUsage` của các ngày UTC trước (giữ ngày hôm nay).

**Session**

- **REQ-AUTH-12** Cookie `mcv_session`: `HttpOnly; SameSite=Lax; Path=/` (+ `Secure` ở production), hạn khớp `Session.expiresAt`; user thật = `SESSION_TTL_DAYS` (mặc định 7 ngày, cố định, không trượt theo request).
- **REQ-AUTH-13** DB chỉ lưu `sha256(token)` làm `Session.id`; token thô và mọi token của Ducker ID (id_token, access token, code) không nằm trong DB, không tới trình duyệt, không có trong log.
- **REQ-AUTH-14** Cookie hết hạn / không có trong DB / bị sửa → request được coi là anonymous và server gửi lệnh xoá `mcv_session`; session hết hạn bị xoá khỏi DB khi chạm tới.

**Đăng xuất — `POST /auth/logout`**

- **REQ-AUTH-15** `POST /auth/logout` (public) trả `204`, xoá row `Session` và clear `mcv_session`; cookie cũ không còn xác thực được. Gọi khi không có session vẫn `204`. Chỉ đăng xuất Match CV, không gọi Ducker ID. `GET /auth/logout` không đăng xuất.
- **REQ-AUTH-16** UI: thẻ user (sidebar desktop) / menu avatar (header mobile-tablet) có nút "Sign out"/"Đăng xuất"; bấm → `POST /auth/logout`, xoá mọi cache query, về `/`, shell chuyển sang giao diện khách.

**Trạng thái — `GET /auth/me`**

- **REQ-AUTH-17** `GET /auth/me` (public) trả `{ status, user, guestQuota }`: user → `status:"user"`, `user {id, email, fullName, avatar}`, `guestQuota: null`; khách → `"guest"`, `user: null`, `guestQuota {limit, used, resetsAt}`; anonymous → `"anonymous"`, `user: null`, `guestQuota` theo IP. Không có field nào chứa token.
- **REQ-AUTH-18** Client gọi API với `credentials: "include"` (cookie phiên đi kèm request sang API khác cổng); `/auth/me` lỗi mạng → client coi như anonymous và hiện giao diện khách (route cần tài khoản hiện màn mời đăng nhập), không kẹt skeleton.

**Ma trận truy cập (guard default-deny)**

- **REQ-AUTH-19** Endpoint không gắn `@Public`/`@AllowGuest` trả `401` + `code: "SIGN_IN_REQUIRED"` + message i18n (`Sign in required.` / `Cần đăng nhập.`) cho cả anonymous lẫn khách: `GET /documents`, `PATCH /documents/:id`, `PATCH /documents/:id/parent`, `DELETE /documents/:id`, `GET /match` (list), mọi `/ai-credentials*` (kể cả `/ai-credentials/providers`), `/cover-letters*`, `/cv-rewrite*`, `/comparisons/*`, `/me/export`.
- **REQ-AUTH-20** Mở cho khách (anonymous → 401 `SIGN_IN_REQUIRED`): `GET /documents/:id`, `GET /documents/:id/file`, `POST /match`, `POST /match/runs`, `GET /match/runs/:id`, `GET /match/:id`.
- **REQ-AUTH-21** Public (mọi trạng thái, không bao giờ 401): `GET /health`, `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`, `GET /auth/me`. `POST /documents` mở cho anonymous bằng cách tạo khách (set `mcv_session` HttpOnly); khách/user gọi thì không tạo khách mới.
- **REQ-AUTH-22** Phân quyền theo chủ sở hữu lấy `userId` từ session, không từ client: user/khách đọc tài liệu, match, run của người khác → `404` (không lộ tồn tại).

**Rate limit / bảo mật**

- **REQ-AUTH-23** `/auth/login` và `/auth/callback` throttle chặt hơn toàn cục: 20 req/60s/IP mỗi route → request thứ 21 trong cửa sổ nhận `429`.
- **REQ-AUTH-24** CORS chỉ cho `CLIENT_ORIGIN` với `credentials: true`; origin lạ không bao giờ được phản chiếu vào `Access-Control-Allow-Origin`.

**Client — điểm đăng nhập và lỗi**

- **REQ-AUTH-25** Mọi nút "Sign in"/"Sign in with Ducker ID" là link điều hướng (không fetch) tới `API_BASE_URL/auth/login?returnTo=<path+query hiện tại>`: header mobile/tablet ("Sign in"), thẻ Guest mode ở sidebar (thu gọn: icon-button có `aria-label` "Sign in with Ducker ID"), màn gate.
- **REQ-AUTH-26** `/?authError=<code>` → một toast lỗi đúng copy `auth.error.<code>` (denied, state, iss, exchange, token, server), mã lạ → `auth.error.generic`; rồi xoá param khỏi URL (reload không hiện lại).
- **REQ-AUTH-27** Sau đăng nhập, shell user: sidebar đủ 6 mục (Dashboard, Match, CV, JD, AI credentials, My data) + thẻ user (avatar chữ cái đầu của tên — hoặc email nếu không có tên —, tên, email, nút Sign out); dưới `lg` header có nút avatar "Account" mở menu với tên, email, Sign out.
- **REQ-AUTH-28** Sáu route cần tài khoản (`/cv`, `/jd`, `/ai-credentials`, `/my-data`, `/compare/:id`, `/cv-rewrite/:id`) với khách/anonymous hiện màn mời đăng nhập đúng tiêu đề `gate.*` + `gate.description` + "Sign in with Ducker ID" + "Back to matching" (về `/wizard`); không redirect âm thầm, không gọi API của trang.
- **REQ-AUTH-29** Copy auth/gate có đủ EN + VI; nút ở màn gate cao 44px.

**Đăng nhập khi đang là khách**

- **REQ-AUTH-30** Chỉ khách đã bắt đầu đăng nhập (id của khách được niêm trong `mcv_oauth`) mới được nhận vào tài khoản ở callback: khi đó callback redirect kèm `claimed=1` và session khách bị thu hồi; một lần đăng nhập bắt đầu ở trình duyệt khác rồi cài sang (cookie `mcv_oauth` + code của kẻ tấn công) đăng nhập được nhưng **không** nhận dữ liệu khách của trình duyệt nạn nhân.
