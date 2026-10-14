# api/

**Trả lời câu hỏi:** gọi backend thế nào (không qua UI)?

```
api/
├── base.client.ts          call() (base URL + header bắt buộc: Origin, CSRF…), Session, bearerHeaders
├── response.ts             đọc envelope chung: errorOf, sessionOf (response login → Session)
├── index.ts                createApiClient: gộp client theo namespace
├── auth.client.ts          ┐ một file một resource, đặt tên theo controller của backend
├── users.client.ts         │
└── billing.client.ts       ┘
```

**Match CV hiện có:** `http.client.ts` — client chung (mỗi call một request context riêng, không theo redirect, tự
chờ `Retry-After` khi throttler trả 429), dùng tạm bởi các spec gom từ `server/test/` qua fixture `http`. Chưa có client
theo resource; `/write-tests <module>` tách dần ra `<resource>.client.ts`.

Nhiều hơn khoảng 10 resource thì gom theo domain: `api/auth/…`, `api/admin/…`, `api/billing/…` (`index.ts` vẫn ở gốc `api/`).

## `index.ts`: một namespace mỗi resource

```ts
export function createApiClient(request: APIRequestContext, urls: SiteUrls) {
  const base = createBaseClient(request, urls);
  return {
    call: base.call,                       // endpoint chưa có client
    storageState: base.storageState,       // cookie jar, để mở phiên thứ hai
    auth: createAuthClient(base),          // ┐ endpoint ẩn danh: cấp ngoài
    signup: createSignupClient(base),      // ┘
    as(session: Session) {                 // endpoint cần đăng nhập: Bearer + tenant
      const headers = bearerHeaders(session);
      return {
        users: createUsersClient(base, headers),
        billing: createBillingClient(base, headers),
      };
    },
  };
}
```

Trong test:

```ts
await api.auth.login(email, password);              // kiểm chính việc login → đọc response
await api.as(session).billing.listInvoices();       // chỉ cần đã đăng nhập → fixture `session`
```

**Không trải phẳng** (`...createAuthClient(base)`): hai resource cùng có `list()` / `create()` sẽ đè nhau mà TypeScript
không báo, và người đọc không biết method thuộc resource nào.

## Quy tắc

| Tình huống | Làm gì |
|---|---|
| Endpoint mới của resource đã có | Thêm method vào đúng `<resource>.client.ts`. Tên method không lặp tên resource (`users.exists`, không `users.userExists`) |
| Resource mới | File `<resource>.client.ts` + một dòng namespace trong `index.ts` |
| Endpoint không cần đăng nhập | Cấp ngoài: `api.<resource>` |
| Endpoint cần đăng nhập | Trong `as(session)`: `api.as(session).<resource>` |
| Logic đọc response dùng chung | `response.ts`, không lặp trong client hay spec |

- **Chỉ HTTP.** Không import `pages/`, `components/`, `fixtures/`. Không `expect`: method trả `APIResponse` thô để spec tự
  kiểm status, header, body. Helper như `sessionOf` được ném lỗi rõ ràng (không phải assertion) khi tiền điều kiện hỏng.
- Spec không gọi `request` trần: mọi request đi qua client (fixture `api`), để header bắt buộc không bị quên.
- Backend có rate limit → client chờ gate (`utils/rate-gate.ts`) trước request bị giới hạn; thêm biến thể `…Ungated`
  cho test chính rate limit.
- Fixture: `api` (client trên `request` của test), `newApi()` (client với cookie jar riêng, phiên thứ hai),
  `session` (tài khoản cố định đã đăng nhập sẵn trên `api`).

Mẫu đầy đủ: `D:\quapp-project\automation-testing\quapp-functions\api\` và `fixtures\{api,session}.fixture.ts`.
