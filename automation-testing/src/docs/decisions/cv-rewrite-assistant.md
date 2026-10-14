# CVREWRITEASSISTANT — Quyết định

Đi cặp với `src/docs/requirements/cv-rewrite-assistant.md`. Đọc nguồn ngày 2026-10-14; quyết định chốt ngày 2026-10-14.

## 1. Nguồn

**Tài liệu app** (theo `src/docs/requirement-sources.md`):

- `docs/README.md` · `docs/01-product/journeys.md` (US-04, US-07, US-09) · `docs/01-product/glossary.md` · `docs/01-product/overview.md`
- `docs/02-requirements/scope.md` (FR-12) · `docs/02-requirements/nfr.md` (NFR-DATA-04/05, NFR-SEC-01/02/06/07/09/10, NFR-REL-03, NFR-I18N-01, NFR-A11Y-02/04, NFR-COST-01)
- `docs/03-design/invariants.md` (#2, #4, #13, #14, #15, #17, #21) · `docs/04-state/backlog.md`
- `docs/decisions/0013-noi-dung-ai-sinh-grounded-user-duyet.md` (ADR-0013) · ADR-0015 · ADR-0022
- `docs/specs/cv-rewrite-assistant/design.md` (§3, §4.3, §4.4, §5.1–5.3, §7) · `docs/specs/cv-rewrite-assistant/security-report.md`
- `docs/design-system/match-cv/ux-copy.md` · `README.md` (## Features)

**Code app:**

- `server/src/modules/cv-rewrite/{cv-rewrite.controller.ts, cv-rewrite.service.ts, grounding.ts, i18n-messages.ts, dto/*}`
- `server/src/modules/ai/ai.service.ts` · `server/src/modules/ai-credentials/ai-credentials.service.ts`
- `server/src/modules/auth/{auth.guard.ts, decorators.ts}` · `server/src/app.module.ts` (throttler)
- `server/src/modules/documents/documents.service.ts` (`remove`) · `server/prisma/schema.prisma` (`parentId` ON DELETE SET NULL)
- `server/src/i18n/{en,vi}/{cvRewrite,ai,auth,aiCredentials,documents}.json`
- `client/src/routes/_app/cv-rewrite.$matchResultId.tsx` · `client/src/components/{RequireAuth,SignInGate,SectionCard}`
- `client/src/views/CvRewrite/**` (RewriteReview, ChangeCard, RewriteRunWith, SaveRewriteModal)
- `client/src/views/Wizard/{index.tsx, ghosts/OpenRunFromUrl, mains/StepResult, components/MatchResultCard}`
- `client/src/views/Home/mains/RecentMatches` · `client/src/locales/{en,vi}/translation.json`
- `client/node_modules/rc-dialog` (antd Modal: focus vào sentinel của dialog khi mở, không vào ô nhập)

**Gợi ý (không phải requirement), gom về lúc scaffold:** `src/tests/e2e/cv-rewrite-assistant/{helpers,happy-path,
grounding-and-data,error-and-mutation}.e2e.ts`, `src/tests/api/cv-rewrite-assistant/rewrite.api.ts`, mục "Gom từ
`docs/specs/cv-rewrite-assistant/e2e.md`" của `src/test-cases/cv-rewrite-assistant.md`. Không có `e2e-bugs.md` cũ
(bản cũ ghi "không có vòng lặp fail nào").

**User (2026-10-14, nguyên văn các quyết định áp cho mọi module):**

> D1 AI: UI tests stub AI responses with page.route (everything else hits the real backend). API tests cover every
> branch that is decided before the AI/provider call. Add 2-3 tests tagged @live-ai that call the real provider
> (contract + score formula overall=round(0.6*semantic+0.4*keyword); Vietnamese scoring comparisons) — they only run
> when LIVE_AI=1. No other test may reach a paid provider or real OIDC.
>
> D2 Bugs: every place the app deviates from a requirement is a BUG: test asserts the REQUIRED behaviour, marked
> test.fail() with "// BUG: defects/<module>.md#bug-<module>-nn" directly above, and the bug is recorded in
> src/defects/<module>.md. Do NOT change app code (client/, server/).
>
> D3 Where the drafts recommend "accept the code, fix the doc": the code is the requirement; docs get updated (by the
> Docs agent).
>
> D4 NFR gaps (no language switcher — vi is tested through window.__i18n dev hook; no stricter rate limit on POST
> /match and export; no pagination on GET /documents and /match; no server idempotency; /health without DB check;
> Swagger in prod; inconsistent Vietnamese term for "match"): backlog debt, NOT bugs, tests do not assert them.
>
> D5 Auth OIDC: the suite runs a fake IdP (discovery + JWKS + token endpoint, RS256) plus a dedicated Match CV server
> instance whose OIDC_* env points at it; other modules keep planting sessions in the DB.
>
> D6 Every other open question in the drafts: apply the option marked (Khuyến nghị) / (a).

## 2. Quyết định chốt qua hỏi đáp

- **Q1 — Đường sinh đề xuất gọi LLM thật, test thế nào?** → (a) theo **D1**: UI stub `POST /cv-rewrite` ở trình duyệt
  (fixture `network`) cho mọi hình dạng đề xuất; mọi request khác của trang (GET match / document / credentials /
  providers, **POST /cv-rewrite/accept**) đi backend thật trên dữ liệu seed trong DB, nên đề xuất stub phải bám văn bản
  CV đã seed. API phủ live mọi nhánh trước provider (auth, ownership match + credential, match failed, validation,
  throttle) và toàn bộ accept (không gọi provider; chạy cùng hàm grounding với lúc sinh, nên biên 12 ký tự / 4× / 1500 /
  trùng / chồng lấn / whitespace được chứng minh tất định qua accept). Thêm 3 test `@live-ai` (hợp đồng + bất biến
  grounding trên đề xuất thật, CV tiếng Việt, đề xuất thật áp được qua accept). Phần chỉ lúc sinh mới có (cắt 25 phần
  tử đầu vào, bỏ phần tử không phải object, cắt 60/300/25 ký tự) không tạo được tất định qua provider thật → TC manual
  trỏ unit test server `grounding.spec.ts`; test live chỉ kiểm giới hạn đầu ra. → REQ-07, 10, 12, 14, 16, 17, 18.
- **Q2 — Sinh lại khi đã tick có cần hộp xác nhận?** → (a) theo **D3/D6**: code là requirement — không hỏi, đề xuất
  mới thay ngay và xoá mọi tick; `design.md` §7 row 11(i) do Docs agent sửa. → REQ-23.
- **Q3 — Ánh xạ lỗi khi lưu sai.** → (a): tên toàn khoảng trắng phải bị chặn ở client bằng `save.nameRequired`, không
  request (app hiện gửi request, server 400, UI báo nhầm `rewrite.err.notGrounded` → **BUG-CVREWRITEASSISTANT-01**);
  các 400 grounding còn lại giữ câu chung `rewrite.err.notGrounded`. → REQ-24, REQ-29.
- **Q4 — Accessible name của checkbox trùng nhau.** → (a): bug a11y, tên phải phân biệt được giữa các thay đổi; test
  assert tên duy nhất (**BUG-CVREWRITEASSISTANT-02**). → REQ-34.
- **Q5 — Thuật ngữ tiếng Việt cho "match" không thống nhất.** → (a) + **D4**: assert đúng chuỗi trong file locale hiện
  có (`t()` / `serverMessage()` đọc file lúc chạy), không assert sự thống nhất thuật ngữ; là nợ copy. → REQ-33.
- **Q6 (phát sinh khi đọc code, D2) — Skeleton lúc sinh không có `aria-busy`.** `RewriteReview` truyền
  `aria-busy="true"` vào `SectionCard`, nhưng `SectionCard` không nhận/rải prop đó nên thuộc tính không ra DOM. REQ-11
  (design §7 row 12) đòi có → **BUG-CVREWRITEASSISTANT-04**.
- **Q7 (phát sinh khi đọc code, D2) — Focus khi mở modal Save.** antd `Modal` (rc-dialog 9.6) focus vào sentinel của
  dialog, `Input` không có `autoFocus` → focus không vào ô tên như REQ-34 đòi → **BUG-CVREWRITEASSISTANT-03**.
- **Q8 (cách test) — Lỗi accept 5xx.** Backend thật không tạo được 500 theo ý muốn, nên TC-CVREWRITEASSISTANT-060 stub
  `POST /cv-rewrite/accept` trả 500 — ngoại lệ duy nhất của "mọi thứ khác đi backend thật" trong module, chỉ để tiêm lỗi.
  Tương tự TC-047 stub `GET /match/:id` trả 500. → REQ-29, REQ-31.
- **Q9 (cách test) — Throttle.** Client `http` của suite tự chờ `Retry-After` khi gặp 429, nên TC throttle dùng fixture
  `rewriteOnce` (một request, không retry). Throttler của Nest đếm theo IP + route; TC đẩy route vào trạng thái chặn,
  chờ hết chặn (bộ đếm về 0), rồi đếm đúng 10 / 20 request qua và request kế bị 429; sau test chờ hết chặn để test
  sau không dính 429. → REQ-15.
- **Q10 (cách test) — `test.fixme` gom về.** `[EP] proposes only changes anchored in the CV` (cần FakeAiService
  in-process) → thay bằng `@live-ai` TC-029 (bất biến grounding trên đề xuất thật) + các TC accept tất định (TC-011…018).
  Không còn `fixme`. Test cũ `[ST] deleting the original leaves the rewrite in place` (xoá thẳng bằng SQL) → viết lại qua
  `DELETE /documents/:id` (TC-025, TC-026).

## 3. Tài khoản test

- **UI (project `app`, `app-tablet`, `app-mobile`):** user e2e cố định do project `session` seed (`.auth/user.json`,
  `readE2eUserId()`). Mỗi test seed CV + JD + MatchResult (+ MatchRun / AiCredential khi cần) của user này thẳng vào DB
  qua fixture `rewriteData`, rồi xoá đúng các row đó (cả CV con do accept tạo) sau test.
- **Khách / ẩn danh trong UI:** `rewriteUsers.guest()` (`createGuestUser`) + `rewriteBrowser.as(guest)` thay cookie
  của tab; `rewriteBrowser.signOut()` xoá cookie.
- **API:** mỗi test tạo user riêng bằng `rewriteUsers.signedIn()` / `.guest()` (`src/utils/sessions.ts`), client gắn
  sẵn (`apiAs`), xoá user (cascade) sau test. "User khác" = một `signedIn()` thứ hai.
- **`@live-ai`:** như API, nhưng dev server cần `OPENROUTER_API_KEY` (key hệ thống); không dùng credential riêng.
- Không mật khẩu nào trong repo; không OIDC thật (D5).

## 4. Ngoài phạm vi

- Ghép gap / so sánh phiên bản sau khi lưu (`cv-version-comparison`, FR-14); sinh thư (FR-13).
- FR-17 nhật ký tiết lộ dữ liệu (chưa làm) — không test "ghi trước call AI".
- Bịa ở mức ngữ nghĩa trong `replacement` (design §3: không chặn được bằng máy); chất lượng nội dung model; prompt text
  (unit test server `ai.service.spec.ts`).
- Luồng đăng nhập Ducker ID / mang dữ liệu khách vào tài khoản (module `auth` / `guest-mode`); ở đây chỉ cổng vào trang
  + 401 API.
- Lưu lịch sử đề xuất chưa duyệt, sửa tay đề xuất, chạy lại match từ trang rewrite — cố ý không làm (design §1).
- Responsive chi tiết (`ui-consistency-shell` / `wizard-responsive`); spec UI ở đây chạy cả 3 viewport nhưng chỉ assert
  hành vi, không assert bố cục.
- Ghi log nội dung CV / key (REQ-35 phần log): không quan sát được log server qua HTTP → TC manual.

## 5. Tech debt liên quan

- **D4 — thuật ngữ VI cho "match"** không thống nhất (BE `cvRewrite.json` "ghép nối", FE `rewrite.*` "so khớp",
  `ux-copy.md` "đối chiếu"/"ghép"); "Thư ứng tuyển" vs "thư xin việc". Test assert theo locale, không assert thống nhất.
- **D4 — không có nút đổi ngôn ngữ**: `vi` test qua dev hook `window.__i18n` (`BasePage.setLanguage`).
- **D4 — không idempotency phía server**: chặn double-submit của accept chỉ nằm ở client (`confirmLoading`); TC-061
  kiểm qua UI, không có kiểm API (hai request accept song song sẽ tạo hai CV — không phải bug theo D4).
- Docs (D3, Docs agent): `design.md` §7 row 11(i) còn ghi "xác nhận" khi sinh lại — cập nhật theo Q2.
