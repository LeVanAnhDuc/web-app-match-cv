# GUESTMODE — Quyết định

Đi cặp với `docs/requirements/guest-mode.md`. Truy vết phía app: FR-21 · US-09 · ADR-0023 · NFR-COST-04.

## Nguồn

Đọc ngày 2026-10-13 → 2026-10-14 (đường dẫn tính từ gốc app `web-app-match-cv/`).

- **Tài liệu:** `automation-testing/src/docs/requirement-sources.md`, `docs/README.md`, `docs/02-requirements/scope.md`
  (FR-21), `docs/02-requirements/nfr.md` (NFR-COST-04, NFR-DATA-01/04, NFR-I18N-01, NFR-A11Y-03),
  `docs/03-design/invariants.md` (#1, #4, #21), `docs/01-product/journeys.md` (US-09 + "Điều gì có thể sai"),
  `docs/01-product/overview.md`, `docs/01-product/glossary.md`, `docs/03-design/architecture.md`,
  `docs/04-state/backlog.md` (#9–#14), `README.md`, `docs/decisions/0023-che-do-khach-user-tam-24h.md`,
  `docs/decisions/0022-dang-nhap-bff-session-rieng.md`, `docs/specs/ducker-id-sign-in/design.md` (§3.3–3.5, §5.1–5.2,
  §6.2–6.4, §9, §10), `docs/design-system/match-cv/ux-copy.md` §9.
- **Code server:** `server/src/modules/auth/{auth.guard,decorators,guest.service,guest-usage.service,session.service,
  session.middleware,auth.service,auth.controller}.ts`, `server/src/modules/auth/oidc/sealed-cookie.ts`,
  `server/src/modules/matching/{matching.controller,matching.service}.ts`,
  `server/src/modules/documents/documents.controller.ts`, `server/src/config/env.validation.ts`,
  `server/prisma/schema.prisma` (GuestUsage, cascade), `server/src/i18n/{en,vi}/{auth,matching}.json`.
- **Code client:** `client/src/routes/_app.tsx`, `client/src/routes/_app/wizard.tsx`, `client/src/views/Wizard/**`
  (DocumentInputStep, UploadPasteTabs, StepReview, StepResult, MatchResultCard, KeepResultCallout, ResultActionBar,
  ClaimedNotice, OpenRunFromUrl), `client/src/views/Home/**` (HeroCta, AccountPerks), `client/src/layouts/AppShell/**`
  (Sidebar, GuestCard), `client/src/components/{SignInGate,AuthErrorToast,SectionCard,Readout}`,
  `client/src/hooks/{useAuth,useMatch,useReturnTo}.ts`, `client/src/utils/auth.ts` (timeUntil),
  `client/src/libs/api.ts` (signInUrl, ApiError), `client/src/locales/{en,vi}/translation.json`.
- **Test đã gom (gợi ý, không phải requirement):** `src/tests/e2e/guest-mode/guest.e2e.ts` (5 test),
  `src/tests/api/guest-mode/guest-quota.api.ts` (1 chạy thật + 1 `test.fixme`). Không có `test-cases/guest-mode.md`
  hay `defects/guest-mode.md` gom về (không có mục `## Gom từ …`).
- **Quan sát app thật (bước 5, chỉ đọc):** `GET /api/v1/auth/me` ẩn danh → `{status: anonymous, user: null,
  guestQuota: {limit: 5, used: 0, resetsAt}}`; snapshot aria của `/` và `/wizard` ẩn danh ở 1280px và 390px: sidebar
  `complementary` có `navigation` 2 link + "Guest mode" + "5 / 5 left"; header mobile có link "Sign in"; wizard có
  `radiogroup` (Upload file / Paste text), drop zone là `button`, ghi chú khách có link "Sign in" →
  `…/auth/login?returnTo=%2Fwizard`.
- **User (2026-10-14, nguyên văn quyết định ràng buộc của lượt viết test):**
  - D1 AI: UI tests stub AI responses with page.route (everything else hits the real backend). API tests cover every
    branch that is decided before the AI/provider call. Add 2-3 tests tagged @live-ai that call the real provider
    (contract + score formula overall=round(0.6*semantic+0.4*keyword); Vietnamese scoring comparisons) — they only run
    when LIVE_AI=1. No other test may reach a paid provider or real OIDC.
  - D2 Bugs: every place the app deviates from a requirement is a BUG: test asserts the REQUIRED behaviour, marked
    test.fail() with "// BUG: defects/<module>.md#bug-<module>-nn" directly above, and the bug is recorded in
    src/defects/<module>.md. Do NOT change app code (client/, server/).
  - D3 Where the drafts recommend "accept the code, fix the doc": the code is the requirement; docs get updated (by the
    Docs agent).
  - D4 NFR gaps (no language switcher — vi is tested through window.__i18n dev hook; no stricter rate limit on POST
    /match and export; no pagination on GET /documents and /match; no server idempotency; /health without DB check;
    Swagger in prod; inconsistent Vietnamese term for "match"): backlog debt, NOT bugs, tests do not assert them.
  - D5 Auth OIDC: the suite runs a fake IdP (discovery + JWKS + token endpoint, RS256) plus a dedicated Match CV server
    instance whose OIDC_* env points at it; other modules keep planting sessions in the DB.
  - D6 Every other open question in the drafts: apply the option marked (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1 — Quota bị trừ trước khi kiểm quyền sở hữu** (`createMatch` gọi `consume()` trước `requireOwnedPair` /
  `requireRunMatches`, nên 404 / 400 vẫn tốn lượt). → **(a) bug** (D6, D2): lượt chỉ trừ sau khi request hợp lệ nhưng
  vẫn trước call AI; request `4xx` không tốn lượt. Ghi BUG-GUESTMODE-01, test `test.fail()`.
  → REQ-GUESTMODE-09 (TC-GUESTMODE-015, 016; TC-GUESTMODE-017 là nhánh 400 do ValidationPipe, đang đúng).
- **Q2 — Kiểm quota mà không đốt key hệ thống** → **(a)** (D6, D1): API cắm dòng `GuestUsage` = `limit` dưới
  `HMAC-SHA256(SESSION_SECRET, ip)` cho mọi dạng IP loopback (`::1`, `127.0.0.1`, `::ffff:127.0.0.1`), rồi `POST /match`
  với cặp hợp lệ → server trả 429 trước call AI. Trước mỗi `POST /match` có thể chạm AI nếu cắm trượt, test đọc
  `GET /auth/me` và dừng nếu `used ≠ limit`. UI: stub `POST /match` bằng fixture `network` cho bước 4 / 429 dựng sẵn;
  riêng TC-GUESTMODE-042 để server trả 429 thật (bộ đếm đã cắm). Một ca `@live-ai` (TC-GUESTMODE-025) gọi provider thật.
  → REQ-GUESTMODE-08, 09, 10, 11, 12, 21.
- **Q3 — Kiểm claim** → **(a)** theo module auth = IdP giả (D5, D6). Claim kiểm tự động end-to-end qua fixture của
  module auth (`authFlow`, `authBrowser`, `fixtures/modules/auth.fixture.ts`): instance Match CV riêng trỏ IdP giả, dùng
  chung DB dev nên khách cắm ở đây chính là khách instance đó thấy. → REQ-GUESTMODE-13, 14, 15, 22
  (TC-GUESTMODE-026…029, 049, 050).
- **Q4 — Nhánh thất bại của callback trên dev server** (phát sinh khi viết test): `error=access_denied` / state lệch được
  quyết định trước khi chạm IdP, nên chạy thẳng trên dev server với cookie `mcv_oauth` tự niêm (AES-256-GCM, khoá
  `sha256(SESSION_SECRET)`, giống `sealed-cookie.ts`) — không có lưu lượng OIDC nào (D1, D5). → REQ-GUESTMODE-15
  (TC-GUESTMODE-030, 031).
- **Q5 — `SESSION_SECRET` của dev server** (cần cho HMAC quota và niêm `mcv_oauth`): fixture `guestModeQuota` /
  `guestModeOAuth` đọc lúc chạy từ `process.env.SESSION_SECRET`, nếu không có thì từ `../server/.env` (file env của chính
  dev server đang chạy). Không chép secret vào repo này.
- **Q6 — Bước 4 của user sau claim** (phát sinh): với user, tiêu đề thẻ là nhãn provider (`OpenRouter · …`), không
  phải "System key" — đúng thiết kế (`providerLabel`), nên REQ-GUESTMODE-22 kiểm bước 4 qua thanh điểm tổng, không qua
  tên thẻ. → REQ-GUESTMODE-22.
- **Q7 — Ngưỡng 16px giữa tab và vùng nhập** chỉ đo ở bước 1 (vùng drop của tab Upload, mặc định) — phần Paste dùng cùng
  `gap-4` của `UploadPasteTabs`. → REQ-GUESTMODE-18.
- **Q8 — Copy VI dùng "lượt ghép" ở `home.guest.note`** trong khi chỗ khác dùng "lượt đối chiếu": thuật ngữ không thống
  nhất là nợ D4, test không assert. → REQ-GUESTMODE-23.

## Tài khoản test

Không dùng tài khoản cố định nào; mọi người dùng là row cắm thẳng DB dev qua fixture `guestModeData`
(`fixtures/modules/guest-mode.fixture.ts`, dựa trên `src/utils/sessions.ts` + `src/utils/db.ts`):

- **Khách sống:** `createGuestUser()` — `isGuest`, `guestExpiresAt` = now + 24h, session cùng hạn.
- **Khách hết hạn:** user `isGuest` với `guestExpiresAt` và session đã qua (`expiredGuest()`), hoặc khách sống bị
  `expireGuest()` lùi hạn giữa login và callback.
- **User đăng nhập:** `createSignedInUser()` (externalSub ngẫu nhiên, session 1 ngày).
- **Khách do UI tạo:** `POST /documents` ẩn danh của trình duyệt sinh khách; `guestModeBrowser.adoptGuest()` nhận diện
  qua cookie để xoá sau test.
- **User do IdP giả tạo:** danh tính `authFlow.identity()` (sub ngẫu nhiên), module auth xoá sau test.
- Mọi user test tạo hoặc ghi nhận đều bị `deleteUsers` (cascade tài liệu, run, kết quả, session) sau test. Bộ đếm
  `GuestUsage` của IP loopback bị xoá trước và sau mỗi test dùng `guestModeQuota`. User e2e cố định của project
  `session` không dùng trong module này (UI chạy ở `app-guest*` không cookie).

## Ngoài phạm vi

- Chống bot / CAPTCHA, `trust proxy` sau reverse proxy (backlog #11) — chưa deploy; IP trong test luôn là loopback.
- Khách rác được tạo trước khi body được validate (backlog #10) — nợ đã chấp nhận, không test.
- Khách hết hạn nằm lại DB > 24h khi không ai tạo khách mới (backlog #9) — hệ quả đã chấp nhận của dọn lười.
- Nội dung chấm điểm của wizard (FR-03/04/05) và luồng wizard của user — module `cv-jd-matching-wizard`.
- Ma trận quyền đầy đủ anonymous / guest / user cho mọi route và chi tiết OIDC (state, PKCE, nonce, iss, token) —
  module `auth`; ở đây chỉ phần khách.
- `GUEST_MATCH_LIMIT_PER_DAY` / `GUEST_TTL_HOURS` khác mặc định — dev server chạy mặc định (5 / 24h); test đọc `limit`
  từ `/auth/me` khi giá trị không phải điều đang kiểm.
- Provider lỗi vẫn tốn lượt (TC-GUESTMODE-019) — manual: không làm provider lỗi theo yêu cầu được mà không đổi server.
- Viewport tablet: `playwright.config.ts` chỉ chạy spec khách ở `app-guest` (desktop) và `app-guest-mobile`; nhánh
  "header mobile/tablet" được kiểm ở mobile.

## Tech debt liên quan

- (D4) Không có nút đổi ngôn ngữ — tiếng Việt kiểm qua dev hook `window.__i18n` (`setLanguage("vi")`).
- (D4) `POST /match` không có rate limit chặt hơn global 100/phút — quota khách là chốt chặn chi phí duy nhất.
- (D4) Không idempotency phía server cho `POST /match` — double click / retry của khách tốn thêm lượt.
- (D4) Thuật ngữ VI cho "match" chưa thống nhất ("lượt ghép" ở `home.guest.note` vs "lượt đối chiếu").
- Bộ test đọc `SESSION_SECRET` của dev server từ `../server/.env` (Q5): nếu suite chạy với server ở máy khác thì cần
  đặt `SESSION_SECRET` trong môi trường của Playwright.
