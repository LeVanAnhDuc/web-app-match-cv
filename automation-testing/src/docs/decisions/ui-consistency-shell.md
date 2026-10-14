# UICONSISTENCYSHELL — Quyết định

## Nguồn

Đọc ngày 2026-10-14 (đường dẫn tính từ gốc repo app).

- `automation-testing/src/docs/requirement-sources.md`
- `docs/README.md`, `docs/02-requirements/scope.md`, `docs/02-requirements/nfr.md` (NFR-A11Y-01..05, NFR-I18N-01,
  NFR-SEC-13), `docs/03-design/invariants.md`, `docs/04-state/backlog.md`, `docs/01-product/journeys.md` (US-09)
- `docs/decisions/0022-…`, `docs/decisions/0023-…`
- `docs/specs/ui-consistency-shell/design.md` (§2, §3, §4.1–4.4, §7, §8), `docs/specs/ui-consistency-shell/security-report.md`,
  `docs/specs/home-dashboard-library/design.md` §4.1
- `docs/design-system/match-cv/ux-copy.md`, `docs/01-product/glossary.md`
- Code: `client/src/routes/_app.tsx`, `client/src/routes/__root.tsx`, `client/src/layouts/AppShell/**` (Sidebar, UserCard,
  GuestCard, AccountMenu), `client/src/stores/slices/ui.ts`, `client/src/components/{PageContainer,SectionCard}/index.tsx`,
  `client/src/i18n/config.ts`, `client/src/styles.css`, `client/src/libs/api.ts` (`signInUrl`),
  `client/src/hooks/{useAuth,useReturnTo}.ts`, `client/src/views/{CvLibrary,JdLibrary}/**`,
  `client/src/locales/{en,vi}/translation.json`
- Hệ sinh thái (tham khảo): `web-app-ducker-id/CLAUDE.md`, `web-app-ducker-id/client/src/components/UserMenu/components/LanguageSubmenu/`
- Gợi ý (không phải requirement): suite cũ `client/e2e/ui-consistency-shell/sidebar.e2e.ts` (đã gom về
  `src/tests/e2e/ui-consistency-shell/`), `docs/specs/ui-consistency-shell/e2e.md`, `e2e-bugs.md`.

Quan sát app thật (2026-10-14, script Playwright chỉ đọc, ẩn danh): sidebar 288px → rail 64px, `localStorage` ghi
`"true"`; tooltip rail hiện nhãn; drawer mobile là `dialog` tên "Match CV", nút "Close", đóng bằng Esc và bấm nền;
**drawer vẫn mở sau khi bấm một mục nav** (Q2); với `reducedMotion: "reduce"` `transition-duration` của sidebar vẫn
`0.2s` (Q3); không trang nào cuộn ngang ở 375px; padding PageContainer 16px (375px) / 24px (1440px); link Sign in ở header
trỏ `http://localhost:5200/api/v1/auth/login?returnTo=%2F…`; console không có lỗi hydration (chỉ có cảnh báo antd
`cssVar`, không liên quan).

### Quyết định user (2026-10-14, nguyên văn rút gọn)

- **D1** UI test stub phản hồi AI bằng `page.route`, mọi thứ khác đi backend thật. Không test nào chạm provider trả phí
  hay OIDC thật.
- **D2** Mọi chỗ app lệch requirement là BUG: test assert hành vi ĐÚNG, `test.fail()` + `// BUG: …`, ghi vào defects. Không sửa app.
- **D3** Chỗ draft khuyên "chấp nhận code, sửa doc": code là requirement; docs do agent Docs cập nhật.
- **D4** NFR gap (không có language switcher — vi test qua hook dev `window.__i18n`; …; thuật ngữ tiếng Việt cho
  "match" không thống nhất): nợ backlog, KHÔNG phải bug, test không assert.
- **D5** Auth OIDC: fake IdP cho module auth; module khác vẫn cắm session vào DB.
- **D6** Mọi câu hỏi mở khác: chọn phương án (Khuyến nghị) / (a).

## Quyết định chốt qua hỏi đáp

- **Q1 — Không có nút đổi ngôn ngữ, `<html lang="en">` cứng.** → (a), theo D4 + D6: test bản `vi` bằng
  `BasePage.setLanguage("vi")` (hook dev `window.__i18n`) để kiểm đủ key; thiếu switcher và `html lang` cứng là tech
  debt, không ghi bug, không assert. HDL §4.1 ("header: toggle EN/VI") do agent Docs sửa theo hiện trạng (D3).
  Ảnh hưởng: REQ-UICONSISTENCYSHELL-18.
- **Q2 — Drawer mobile không tự đóng khi bấm một mục nav.** → (a), theo D2 + D6: requirement là drawer đóng sau điều
  hướng; thêm **REQ-UICONSISTENCYSHELL-19**; app hiện lệch → BUG-UICONSISTENCYSHELL-01, test `test.fail()`.
- **Q3 — Sidebar không tôn trọng `prefers-reduced-motion`** (NFR-A11Y-05). → (a), theo D2 + D6: requirement là không có
  chuyển động khi `reduce`; thêm **REQ-UICONSISTENCYSHELL-20**; app hiện lệch → BUG-UICONSISTENCYSHELL-02.
- **Q4 — Thuật ngữ tiếng Việt cho "match" không thống nhất** ("ghép" / "đối chiếu" / "so khớp" / "match"; "Credential AI"
  vs "khoá AI"; `library.empty.*` vẫn "No saved CVs yet"). → (a), theo D4: test chỉ assert đúng key hiện có qua `t()`;
  việc chốt thuật ngữ là task copy riêng (tech debt). REQ-UICONSISTENCYSHELL-04 chỉ phủ nav / tiêu đề `/cv` `/jd` / thẻ
  thống kê, không phủ copy empty-state. Ảnh hưởng: REQ-04, REQ-18.
- **Q5 — Bơm trạng thái không đạt được bằng backend thật** (suy ra từ D1, không có trong draft). Lỗi tải thư viện (5xx)
  và quota khách đã dùng quá giới hạn không tạo được bằng backend thật mà không tốn lượt AI → hai TC đó dùng
  `network.failWith` / `network.stubJson` trên **đúng một** endpoint đọc (GET `/documents`, GET `/auth/me`). Mọi TC khác
  đi backend thật. Ảnh hưởng: REQ-14, REQ-17.
- **Q6 — Empty state cần một user không có tài liệu.** Không dùng user e2e chung (module khác tạo tài liệu cho nó): TC
  tạo user riêng bằng `createSignedInUser()` và xoá ở cuối test (`@creates-data`). Ảnh hưởng: REQ-17.

## Tài khoản test

- **User e2e chung** (project `session`, `src/utils/auth-state.ts`): user `e2e-user` có `fullName` + email, phiên cắm
  thẳng vào DB, browser nhận qua `storageState` `.auth/user.json`. Dùng cho mọi TC "đã đăng nhập". Tên/email đọc lúc chạy
  qua `api.auth.me()`, không chép tay. **Không bấm Sign out** với user này (logout xoá Session row của cả suite) — luồng
  đăng xuất thuộc module `auth`.
- **User riêng từng test**: `createSignedInUser()` / `deleteUsers()` trong `src/utils/sessions.ts`, cookie gắn vào context
  bằng fixture `ucsSignInAs` (slot của module). Dùng cho TC empty state.
- **Ẩn danh**: `test.use({ storageState: { cookies: [], origins: [] } })` trong describe; không gửi request ghi nào nên
  không mint guest.

## Ngoài phạm vi

- Nút đổi dark mode tay, đổi hue thương hiệu (UCS §7 YAGNI).
- Đo pixel từng class Tailwind ngoài các ngưỡng đã nêu (288/64px, 1600px, padding 16/24px, cỡ chữ h1/h2/eyebrow); tương
  phản màu NFR-A11Y-01 (đo tay bằng devtools).
- Hit-area < 44px của nút trong nội dung trang (nợ #7 `docs/04-state/backlog.md`) — chỉ assert control của shell.
- Đăng nhập / đăng xuất thật qua Ducker ID, `AuthErrorToast`, quota khách giảm sau match → module `auth` / `guest-mode`.
  Ở đây chỉ kiểm `href` của link Sign in, không bấm (D1/D5: không chạm OIDC thật).
- Nội dung từng trang (Home, thư viện, wizard…) → module tương ứng; ở đây chỉ assert khung.
- `ResultActionBar` ghim ở shell khi wizard bước 4 → module `cv-jd-matching-wizard`.
- Tầng API: shell không có endpoint riêng (chỉ đọc `GET /auth/me`, đã phủ ở module `auth`) → module này không có spec API.

## Tech debt liên quan

- (D4) Không có language switcher, `<html lang="en">` cứng ở `client/src/routes/__root.tsx`; người dùng thật không xem
  được bản vi. Test đi qua `window.__i18n`.
- (D4) Thuật ngữ tiếng Việt cho "match" không thống nhất; `nav.aiCredentials` vi = "Credential AI" vs `gate.aiCredentials`
  "khoá AI"; `library.empty.cv|jd`, `reuse.cv.title` vẫn dùng "saved CVs/JDs" (follow-up cũ của feature).
- REQ-16 chỉ áp cho h1 khi có. Cập nhật 2026-10-14 (heal): `/cv`, `/jd`, `/my-data` nay có h1 tiêu đề trang;
  thư viện chỉ có SectionCard (không tiêu đề) khi đã có tài liệu → TC-031 đo màu card ở `/my-data`.
- Console dev luôn có cảnh báo antd `[antd: App] When using cssVar…` — không phải hydration, TC-…-019 chỉ lọc lỗi
  hydration.

## Chuyển từ suite cũ

- `src/tests/e2e/ui-consistency-shell/sidebar.e2e.ts` (7 test, chưa có tag, không có `test.fixme`) đã viết lại theo quy
  ước và chia theo chủ đề: `navigation`, `sidebar-collapse`, `responsive`, `account-block`, `layout`, `i18n`. File cũ đã
  xoá. Bỏ `test.use({ viewport: 1440×900 })` ép desktop: test desktop giờ skip trên tablet/mobile, test tự đổi bề rộng
  chỉ chạy ở một project.
- Kịch bản `docs/specs/ui-consistency-shell/e2e.md` → TC: #1 → TC-002/004 (cũ chỉ 4 mục; giờ 6 mục cho user, 2 cho
  khách — REQ-02); #4 → TC-012; #5 → TC-007, TC-032; #6 → TC-017; #8 → TC-006; #9 → TC-034/035/036; #10 → TC-015, TC-033;
  #11 → TC-008, TC-011, TC-021; #12 → TC-014. #2/#3 (AuthN/AuthZ "N/A — chưa có auth") lỗi thời: nay có user/khách →
  TC-003, TC-023..027. #7 N/A.
- Bug log cũ (`e2e-bugs.md` Round 1, 2): đều là lỗi script, không phải lỗi app → bỏ, không thành `BUG-…`.
