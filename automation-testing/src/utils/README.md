# utils/

**Trả lời câu hỏi:** tiện ích kỹ thuật nào không biết gì về UI và môi trường?

Hàm thuần hoặc client dịch vụ ngoài, dùng được ở fixture, spec, setup. Hàm thuần kèm `*.test.ts` nằm cạnh (`pnpm test:unit`).

| File | Nội dung |
|---|---|
| `db.ts` | Truy cập trực tiếp Postgres dev (`E2E_DATABASE_URL`): `sql(text, params)`, `utc()`, `countRows(table)`; seed/đọc row không endpoint nào tạo: `insertDocument` / `findDocument` / `deleteDocuments`, `insertMatchResult` / `findMatchResult` / `deleteMatchResults`, `insertMatchRun`, `insertAiCredential` / `findAiCredential`, `insertCoverLetter`. Timestamp luôn ghi UTC |
| `sessions.ts` | User + phiên như `SessionService` của server (row lưu sha256(token), cookie `mcv_session=<token>`): `createUser(opts)`, `createSignedInUser({ email? })` / `createGuestUser()` → `SeededUser { userId, cookie }`, `deleteUsers(ids)` (cascade hết dữ liệu), `documentOwner(id)`, `resolveSession(token)`, `sessionIdFor(token)`, `liveCookie(setCookies, name)`, `setCookiesNamed(setCookies, name)`, `SESSION_COOKIE` |
| `auth-state.ts` | Phiên của user e2e cố định cho project `session`: `seedSignedInSession()` (ghi `.auth/user.json`), `removeSignedInSession()`, `readE2eUserId()`, `sessionCookieHeader()` (`{ Cookie }`), `resetGuestUsage()` |
| `db-cleanup.ts` | `cleanDocuments()` — xóa MatchResult, MatchRun, Document (global setup) |
| `fake-idp.ts` | IdP OIDC giả cho module auth (quyết định D5): `FakeIdp` (discovery, JWKS, `/oauth/token` ký RS256, lỗi token có chủ đích qua `TOKEN_FAULTS`), `startAuthServer(env)` chạy một instance server Match CV riêng (`server/dist/src/main.js`, cổng trống, không đọc `server/.env`) trỏ `OIDC_ISSUER` vào IdP giả; `sealOAuthState` / `unsealOAuthState`, `s256`, `decodeJwt`, `freePort` |
| `glob.ts` | `globToRegExp(glob)`, `urlMatches(matcher, url)` — cùng ngữ nghĩa glob với `page.route` (fixture `network` dùng) |

**Dọn dữ liệu:** user tạo bằng `createSignedInUser` / `createGuestUser` / `createUser` → `deleteUsers([...])` trong
`afterAll`/`afterEach` (cascade). Row gắn với user e2e cố định (`readE2eUserId()`) → xóa đích danh bằng `delete*`.
Global setup xóa toàn bộ Document/Match của DB dev mỗi lượt chạy — DB dùng chung, đừng chạy suite song song với người khác.

| Cần thêm | Chép từ `D:\quapp-project\automation-testing\quapp-functions\utils\` |
|---|---|
| Hộp thư tạm nhận email | `mailtm.ts` + `otp.ts`, kèm fixture `inbox` |
| Không vượt rate limit khi chạy song song | `rate-gate.ts` + `fixtures\gates.fixture.ts` |
| Theo dõi request / response / lỗi console trên page | `browser.ts` |

**Quy tắc:** không import `pages/`, `components/`, `api/`, `fixtures/`; `.env` chỉ đọc qua `config/`
(`db.ts` lấy URL từ `config/database.ts`). Chỉ thêm khi có test thật sự cần.
