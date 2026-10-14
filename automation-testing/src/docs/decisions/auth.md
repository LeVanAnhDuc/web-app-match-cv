# AUTH — Quyết định

## Nguồn

Đọc ngày 2026-10-14 (đường dẫn tính từ gốc app `web-app-match-cv/`):

- `automation-testing/src/docs/requirement-sources.md`
- `docs/README.md`, `docs/02-requirements/scope.md` (FR-18), `docs/02-requirements/nfr.md` (NFR-SEC-01, -02, -12, -13,
  NFR-I18N-01, NFR-A11Y-03, NFR-DATA-04), `docs/03-design/invariants.md` (#2, #4, #20, #21),
  `docs/03-design/architecture.md`, `docs/01-product/journeys.md` (US-09), `docs/01-product/glossary.md`,
  `docs/04-state/backlog.md` (#12, #13, #14), `README.md`
- `docs/decisions/0022-dang-nhap-bff-session-rieng.md` (ADR-0022), `docs/decisions/0023-che-do-khach-user-tam-24h.md` (ADR-0023)
- `docs/specs/ducker-id-sign-in/design.md` (§2, §3.2–3.4, §4, §5.1–5.2, §6.1–6.4, §9, §10)
- `docs/design-system/match-cv/ux-copy.md` §9
- Server: `server/src/modules/auth/{auth.controller,auth.guard,auth.module,auth.service,decorators,return-to,session.service,session.middleware,guest.service,guest-usage.service}.ts`,
  `oidc/{oidc-client.service,id-token,pkce,sealed-cookie}.ts`, `dto/auth-me.dto.ts`, `server/src/common/http/cookies.ts`,
  `server/src/config/env.validation.ts`, `server/src/main.ts`, `server/src/app.module.ts`,
  `server/src/i18n/{en,vi}/auth.json`, `documents.controller.ts`, `matching.controller.ts`, `server/prisma/schema.prisma`
- Client: `client/src/hooks/{useAuth,useReturnTo}.ts`, `client/src/libs/{api,query-client}.ts`, `client/src/requests/auth.ts`,
  `client/src/components/{AuthErrorToast,RequireAuth,SignInGate,UserAvatar}`, `client/src/layouts/AppShell/**`,
  `client/src/routes/_app.tsx`, `client/src/routes/_app/*.tsx`, `client/src/utils/auth.ts`, `client/src/locales/{en,vi}/translation.json`
- Ducker ID: `web-app-ducker-id/CLAUDE.md` (OIDC core) — chỉ để biết hình dạng discovery/JWKS/token mà IdP giả phải có.
- Test gom về lúc scaffold (gợi ý, không phải requirement): `src/tests/api/auth/{access-matrix,sign-in-flow}.api.ts`
  (từ `server/test/{access-matrix,auth-flow}.e2e-spec.ts`). Không có `src/test-cases/auth.md` / `src/defects/auth.md` gom
  về (không có `docs/specs/*/e2e.md` nào cho auth), nên không có mục `## Gom từ …` để chuyển.

Nguồn gốc từng REQ: REQ-01, 06 (design §3.2, ADR-0022, `auth.service.ts` / `oidc-client.service.ts`); REQ-02 (§3.2, §9);
REQ-03 (NFR-SEC-13, `return-to.ts`); REQ-04 (§3.2); REQ-05 (`auth.controller.ts`, Q2); REQ-07 (§3.2, §10); REQ-08 (§9,
nhánh "không xoá" chỉ thấy trong code — giữ theo D3); REQ-09 (NFR-SEC-12, §3.3); REQ-10 (§4); REQ-11 (ADR-0023, §3.4);
REQ-12, 13 (NFR-SEC-12, NFR-SEC-02, invariant #20); REQ-14 (§3.3, `session.middleware.ts`); REQ-15 (§2, §3.3, §9,
README Features); REQ-16 (§6.2, `useSignOut`); REQ-17 (§5.1, `auth-me.dto.ts`); REQ-18 (§6.1, `useAuth.ts` — nhánh lỗi chỉ
thấy trong code, comment của hook nói rõ ý định); REQ-19–21 (§5.2, invariant #21, `auth.guard.ts`); REQ-22 (invariants #2,
#4, NFR-SEC-01, NFR-DATA-04); REQ-23 (NFR-SEC-13, backlog #14, `AUTH_THROTTLE`); REQ-24 (§9, `main.ts`); REQ-25 (§6.1–6.2,
`signInUrl`, `useReturnTo`); REQ-26 (§6.1, ux-copy §9.2, `AuthErrorToast`); REQ-27 (§6.2, `UserCard`, `AccountMenu`,
`getInitials`); REQ-28 (§6.3, ux-copy §9.3, `RequireAuth`); REQ-29 (NFR-I18N-01, NFR-A11Y-03, §6.4); REQ-30 (ADR-0023,
comment `OAuthState.guestUserId` trong `auth.service.ts`, test cũ "a login planted from another browser…").

## Quyết định chốt qua hỏi đáp

Người dùng chốt ngày 2026-10-14 (D1–D6, áp cho cả bộ test):

- **Q1 — Kiểm luồng OIDC thật thế nào?** → **(a)** theo **D5**: suite tự chạy một IdP giả (`src/utils/fake-idp.ts`:
  discovery + JWKS + `/oauth/authorize` tự đồng ý + `/oauth/token`, ký RS256) và một instance server Match CV riêng
  (`src/tests/setup/auth-server.ts`, chạy `server/dist/src/main.js` trên cổng trống, `OIDC_*` trỏ vào IdP giả, cùng DB
  dev, cwd rỗng nên không nạp `server/.env` và không có key AI). Các module khác vẫn cắm session thẳng vào DB.
  Ảnh hưởng: REQ-AUTH-01, 02, 05–11, 13, 15, 23, 30 tự động được. Dev server `:5200` không bao giờ được yêu cầu bắt đầu
  đăng nhập cho user chưa đăng nhập (nó trỏ Ducker ID thật). UI đăng nhập đầy đủ: spec chặn `GET <API>/auth/login` của
  dev server và chuyển hướng sang cùng path trên instance riêng; cookie `mcv_session` host `localhost` dùng được cho cả
  dev server vì hai instance chung DB.
- **Q2 — Thiếu cấu hình OIDC trả gì?** → **(a)** theo **D3/D6**: hành vi của code là requirement — `302
  /?authError=server`, không 503. README và comment trong `server/.env.example` ("answer 503") là tài liệu lệch, Docs
  agent sửa; không phải bug. Ảnh hưởng: REQ-AUTH-05.
- **D2 — Bug:** app lệch requirement → test khẳng định hành vi ĐÚNG + `test.fail()` + `// BUG:` và ghi
  `src/defects/auth.md`. Đang mở: BUG-AUTH-01 (REQ-AUTH-18, `/auth/me` lỗi mạng kẹt skeleton) và BUG-AUTH-02
  (REQ-AUTH-14, cookie phiên không giải mã được không bị xoá).
- **D1 — AI:** module auth không gọi AI; không có test `@live-ai` (không có hợp đồng AI nào thuộc auth). Instance riêng
  không có key AI nào.
- **D4 — NFR gap là nợ, không phải bug:** không có nút đổi ngôn ngữ (tiếng Việt kiểm qua `window.__i18n`); `/health`
  không kiểm DB; Swagger bật ở prod — test không khẳng định các điểm đó.
- **D6:** mọi câu hỏi mở còn lại lấy phương án (Khuyến nghị)/(a). Không còn câu hỏi mở nào khác trong nháp auth.

Quyết định riêng của người viết test (trong khuôn D1–D6):

- **T1 — REQ-AUTH-30 (claim ràng theo khách):** phần "chuyển dữ liệu khách sang tài khoản" là của module guest-mode, nhưng
  ràng buộc ở callback (chỉ khách đã bắt đầu đăng nhập mới được claim, `claimed=1`, session khách bị thu hồi, login cài
  từ trình duyệt khác không claim) chỉ kiểm được qua IdP giả nên đặt ở auth. Hai test cũ tương ứng được giữ ở đây.
  Fixture `authFlow` dùng chung được cho guest-mode nếu cần.
- **T2 — Rate limit (REQ-AUTH-23) và "không cấu hình"/"discovery chết" (REQ-AUTH-05)** chạy trên instance riêng, mỗi
  test một instance mới (fixture `authSpawnServer`), để bộ đếm 20/phút không làm chậm các test luồng khác và không chạm
  dev server.
- **T3 — `returnTo` (REQ-AUTH-03)** được kiểm bằng nhánh "user đã đăng nhập" trên dev server (lọc chạy trước nhánh đó,
  Location lộ kết quả, không chạm IdP); thêm một case qua callback thật trên instance riêng để chứng minh giá trị niêm
  trong `mcv_oauth` cũng được lọc.
- **T4 — Toast `authError` bằng tiếng Việt** không tự động được: toast bắn ở lần render đầu, trước khi dev hook
  `window.__i18n` kịp đổi ngôn ngữ (D4: không có nút đổi ngôn ngữ). Bản dịch tiếng Việt của gate được kiểm ở TC-AUTH-046; toast VI là TC-AUTH-049 (manual).
- **T5 — "không có trong log" (REQ-AUTH-13)** kiểm trên stdout/stderr của instance riêng (suite giữ log của process đó).

## Tài khoản test

- **Không dùng tài khoản Ducker ID thật** nào (D5); `account` (`DEV_USER_*`) không dùng.
- **User e2e đã seed** (`.auth/user.json`, project `session`): chỉ dùng để ĐỌC shell user (TC-AUTH-050) và gọi API
  không làm đổi phiên. Không bao giờ đăng xuất nó.
- **User/khách riêng mỗi test**: `createSignedInUser()` / `createGuestUser()` / `createUser()` trong `src/utils/sessions.ts`,
  xoá bằng `deleteUsers()` (cascade). Đăng xuất UI luôn dùng user riêng.
- **User sinh từ đăng nhập qua IdP giả**: `sub` ngẫu nhiên `auth-e2e-<hex>` (fixture `authFlow.identity()`), email
  `<sub>@auth.test`; fixture xoá theo `externalSub` sau mỗi test.

## Ngoài phạm vi

- Đăng ký tài khoản, consent screen, refresh token, back-channel logout, đăng xuất toàn hệ sinh thái — design §1, Ducker ID
  chưa có.
- Login CSRF qua cookie same-site (backlog #12), cache JWKS không cooldown (#14), một `SESSION_SECRET` dùng hai mục đích
  (#13) — nợ đã ghi, chưa có hành vi để kiểm.
- Vòng lặp `/login` ↔ `/authorize` sau khi đăng ký ở Ducker ID (design §7) — thuộc Ducker ID.
- `/auth/me` khi thiếu `SESSION_SECRET` (503 từ HMAC IP) — cấu hình hỏng, không phải hành vi người dùng.
- Khách: tạo, quota, 24 giờ, nội dung claim (tài liệu/match/run chuyển chủ) — module guest-mode (ngoại trừ REQ-AUTH-30).
- `Secure` trên cookie ở production — chỉ có môi trường dev (`NODE_ENV=development`); test khẳng định KHÔNG có `Secure`
  ở dev, nhánh production không chạy được.
- Replay cùng một `mcv_oauth` niêm trong 10 phút bởi kẻ đã lấy được cookie — server không lưu state phía mình theo thiết
  kế (ADR-0022); code IdP dùng một lần là lớp chặn, thuộc IdP.

## Tech debt liên quan

- (D4) Không có nút đổi ngôn ngữ — tiếng Việt của gate kiểm qua `window.__i18n`; toast VI thành manual (T4).
- (D4) Không có rate limit chặt hơn cho `POST /match` và export; `/health` không kiểm DB — không liên quan trực tiếp auth,
  test không khẳng định.
- README + `server/.env.example` nói `/auth/login` / `/auth/callback` trả 503 khi thiếu `OIDC_*` — code redirect
  `/?authError=server` (Q2). Docs agent sửa tài liệu.
- Backlog #12/#13/#14 như mục Ngoài phạm vi.
