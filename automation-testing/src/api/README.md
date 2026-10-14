# api/

**Trả lời câu hỏi:** gọi backend thế nào (không qua UI)?

```
api/
├── http.client.ts            createHttp(request, apiUrl) → HttpFactory: mỗi call một request context mới (không cookie
│                             jar), không theo redirect, tự chờ Retry-After khi throttler trả 429. Spec cũ dùng qua `http`
├── base.client.ts            createBaseClient: identity (Cookie) + Accept-Language + ApiResponse<T> (json(), error()),
│                             Loose<T>, FilePart, query(), withOptions()
├── index.ts                  createApiClient(factory, identity?, opts?) → namespace theo resource, .as(), .lang()
├── health.client.ts          ┐
├── docs.client.ts            │
├── auth.client.ts            │ một file một controller của server/src/modules/**
├── documents.client.ts       │
├── match.client.ts           │
├── ai-credentials.client.ts  │
├── cover-letters.client.ts   │
├── cv-rewrite.client.ts      │
├── comparisons.client.ts     │
└── me.client.ts              ┘
```

## Namespace và method (phủ **mọi** endpoint của server, đối chiếu `GET /docs-json`)

| Namespace | Method → endpoint |
|---|---|
| `health` | `check()` GET /health |
| `docs` | `ui()` GET /docs · `json()` GET /docs-json |
| `auth` | `login({ returnTo })` GET /auth/login · `callback(query)` GET /auth/callback · `logout()` POST /auth/logout · `me()` GET /auth/me |
| `documents` | `create(body)` POST /documents (JSON, dán text) · `upload({ kind, save, title?, file?, sourceText? })` POST /documents (multipart) · `list({ kind?, saved? })` · `get(id)` · `rename(id, title \| body)` PATCH /:id · `setParent(id, parentId \| null \| body)` PATCH /:id/parent · `remove(id)` · `file(id, { download? })` GET /:id/file |
| `match` | `create(body)` POST /match (**gọi AI**) · `list()` · `get(id)` · `createRun(body)` POST /match/runs · `getRun(id)` GET /match/runs/:id |
| `aiCredentials` | `providers()` · `list()` · `create(body)` · `update(id, body)` · `remove(id)` · `test(id)` POST /:id/test (**gọi AI**) |
| `coverLetters` | `generate(body)` POST (**gọi AI**) · `list(matchResultId)` · `update(id, content \| body)` · `remove(id)` |
| `cvRewrite` | `generate(body)` POST /cv-rewrite (**gọi AI**) · `accept(body)` POST /cv-rewrite/accept |
| `comparisons` | `get(documentId, { jdDocumentId? })` |
| `me` | `export()` GET /me/export (zip, đọc `raw`) |

Ngoài ra trên mọi client: `raw` (`Http` không type, cùng identity: `raw.get("/path")`), `cookie()`, `as(identity, opts?)`,
`lang("vi")`. Mọi method nhận thêm `options?: CallOptions` cuối cùng (header, params thêm).

## Gọi với tư cách ai

Match CV kiểm quyền theo route (`@Public` / `@AllowGuest` / cần đăng nhập) trên **cùng path**, nên mọi namespace có ở
mọi client: client ẩn danh là cách spec chứng minh 401.

```ts
await api.documents.list();                              // user e2e đã seed (fixture `api`)
await anonApi.match.create({ cvDocumentId, jdDocumentId }); // ẩn danh (fixture `anonApi`)
const u = await createSignedInUser();                    // @/utils/sessions
await apiAs(u).documents.get(id);                        // user khác (fixture `apiAs`), hoặc api.as(u)
await api.as([oauthCookie, guest.cookie]).auth.callback({ code, state });
await api.lang("vi").documents.get(badId);               // message server tiếng Việt (Accept-Language)
```

Identity: `"mcv_session=…"` · `["a=1", "b=2"]` · `{ cookie }` (SeededUser) · `() => string` (đọc lười) · `undefined`.

Server thứ hai (vd Match CV trỏ vào fake IdP của module auth): `createApiClient(createHttp(playwright.request, otherApiUrl))`.

## Response

Method trả `ApiResponse<T>` = `HttpResponse` (`status`, `headers` chữ thường, `setCookies`, `raw`, `body`, `text`) +
`json(): T` (ép kiểu DTO, **không** kiểm runtime — assert `status` trước) + `error(): ApiErrorBody`
(`{ code?, statusCode?, message: string | string[], error? }`).

Input dùng `Loose<DTO>`: gợi ý key của DTO nhưng nhận mọi giá trị, để spec validation gửi body sai qua cùng method.

## Quy tắc

| Tình huống | Làm gì |
|---|---|
| Endpoint mới của resource đã có | Thêm method vào đúng `<resource>.client.ts`. Tên method không lặp tên resource |
| Resource / controller mới | File `<resource>.client.ts` + một dòng namespace trong `bind()` của `index.ts` |
| Body sai kiểu / thiếu field | Truyền thẳng vào method (`Loose<T>`), không cần `raw` |
| Path lạ / method không tồn tại | `client.raw.call("PUT", "/documents/x")` |

- **Chỉ HTTP.** Không import `pages/`, `components/`, `fixtures/`. Không `expect`: spec tự kiểm status/header/body.
- Spec không gọi `request` / `fetch` trần: mọi request đi qua client (fixture `api` / `anonApi` / `apiAs`, hoặc `http` cũ).
- **AI (D1):** method đánh dấu **gọi AI** chỉ được gọi trong spec API thường cho nhánh quyết định TRƯỚC khi gọi provider
  (401, 400 validation, 404 sở hữu, 429 quota…). Nhánh cần provider thật → test gắn `@live-ai`.
- Throttle: global 100/phút; `auth/login|callback` 20, `ai-credentials/:id/test`, `cover-letters` POST, `cv-rewrite` POST 10,
  `cv-rewrite/accept` 20. `http.client.ts` tự chờ 429 có `Retry-After` (tối đa 2 lần) và cộng thời gian chờ vào timeout.
