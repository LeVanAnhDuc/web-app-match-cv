# ADR-0022 · Đăng nhập qua Ducker ID theo mẫu BFF, Match CV tự cấp session

> **Ngày:** 2026-10-04
> **Trạng thái:** accepted
> **Liên quan:** FR-18 · NFR-SEC-12 · NFR-SEC-13 · ADR-0007 · ADR-0009 · supersedes ADR-0006

## 1. Bối cảnh

Ducker ID đã có OIDC core: authorization code + PKCE S256, id_token/access token RS256
sống **15 phút**, **không có refresh token**, không revoke, không introspect. Match CV có
backend riêng và đang chạy bằng mock user (ADR-0006). Cookie trên `localhost` dùng chung
giữa các cổng, và Ducker ID đã chiếm tên `sid`, `refreshToken`.

## 2. Quyết định

Server NestJS là **confidential client** (`client_secret_basic` + PKCE). Nó tự làm
`/auth/login` → `/auth/callback`, kiểm id_token **một lần**, rồi cấp **session của chính
Match CV**: token ngẫu nhiên trong cookie httpOnly `mcv_session`, DB lưu `sha256(token)`
ở bảng `Session`, hạn 7 ngày. Token của Ducker ID không được lưu và không tới trình duyệt.
Kiểm chữ ký bằng `node:crypto` + JWKS cache theo `kid`, **không thêm dependency**.
`CurrentUserService.getUserId()` giữ chữ ký, đọc từ `AsyncLocalStorage` do middleware điền.
Sign out chỉ huỷ session Match CV.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| SPA tự làm PKCE, gửi `Bearer` lên server | Token ở JS (XSS lấy được); không refresh ⇒ đá user ra mỗi 15 phút; phải mở CORS của Ducker ID. Bản thực hành tốt nhất cho browser-based app của IETF xếp BFF là mẫu an toàn nhất |
| Session là JWT tự ký trong cookie, không bảng | Logout không thu hồi được trước khi hết hạn; khách và claim cần trạng thái server-side đằng nào cũng có |
| `openid-client` / `jose` | Pure ESM — Jest CommonJS của server chết lúc load (đã xảy ra, ghi ở `server/.claude/CLAUDE.md`). Phần cần dùng (verify RS256 theo JWK) là ~50 dòng `node:crypto` |
| Request-scoped provider / `nestjs-cls` cho user hiện tại | Request scope lan khắp cây DI; `nestjs-cls` là dependency cho thứ `node:async_hooks` đã có |
| Sign out luôn cả Ducker ID | User chọn hành vi kiểu "logout Notion không thoát Google" |

## 4. Hệ quả

**Được:**
- Phiên Match CV độc lập với hạn 15 phút của Ducker ID; logout thu hồi ngay.
- Rò DB không dùng lại được session (chỉ có hash).
- Precondition của ADR-0009 ("không deploy public trước khi có auth") được gỡ.

**Mất / phải chấp nhận:**
- Một truy vấn `Session` mỗi request có cookie.
- User bị khoá ở Ducker ID vẫn dùng Match CV tới khi session hết hạn (≤ 7 ngày) — không
  có back-channel logout hay introspect để biết sớm hơn.
- Tự viết phần verify id_token ⇒ phải có test cho từng nhánh từ chối.

**Điều kiện xem lại quyết định này:** Ducker ID có back-channel logout hoặc introspect;
hoặc Match CV cần gọi API của Ducker ID thay user (lúc đó mới cần giữ access token).
