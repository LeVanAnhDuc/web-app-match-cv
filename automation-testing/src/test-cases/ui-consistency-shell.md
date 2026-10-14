# UICONSISTENCYSHELL — Test case

Lăng kính áp theo thứ tự: truy vết REQ (mọi REQ ≥ 1 TC) → phân vùng tương đương (user / khách; giá trị lưu hợp lệ / không
hợp lệ; desktop / compact) → giá trị biên (1023 / 1024 / 1025px, 375px, 768px padding, quota vượt giới hạn) → chuyển
trạng thái (mở ↔ rail, đổi route, F5, deep-link, đổi viewport khi đang rail) → đoán lỗi (double-click, storage bị chặn,
drawer không đóng) → ngoài lề (hydration, reduced motion, raw key, focus).
Shell không có endpoint riêng (chỉ đọc `GET /auth/me`, phủ ở module `auth`), nên mọi TC ở tầng e2e.
Viewport: spec chạy trên desktop / tablet / mobile; TC chỉ có nghĩa ở một nhóm viewport thì skip ở nhóm kia, TC tự đổi
kích thước chỉ chạy ở một project (ghi ở **Tiền điều kiện**).

## Điều hướng

### TC-UICONSISTENCYSHELL-001 — Mọi route trong /_app render trong shell với nội dung ở main

- **Requirement:** REQ-UICONSISTENCYSHELL-01
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user e2e đã đăng nhập; mọi viewport
- **Bước:** lần lượt mở `/`, `/wizard`, `/cv`, `/jd`, `/ai-credentials`, `/my-data`, `/compare/<uuid không tồn tại>`, `/cv-rewrite/<uuid không tồn tại>`
- **Mong đợi:** mỗi trang có `<main>`; ≥ 1024px có `#app-sidebar`, không có nút `nav.openMenu`; < 1024px ngược lại
- **Automated:** `tests/e2e/ui-consistency-shell/navigation.e2e.ts`

### TC-UICONSISTENCYSHELL-002 — User đã đăng nhập thấy đủ 6 mục nav đúng thứ tự

- **Requirement:** REQ-UICONSISTENCYSHELL-02
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user e2e; mọi viewport (compact: mở drawer)
- **Bước:** mở `/`, xem danh sách nav
- **Mong đợi:** đúng 6 link theo thứ tự `nav.home`, `nav.match`, `nav.savedCvs`, `nav.savedJds`, `nav.aiCredentials`, `nav.myData`
- **Automated:** `tests/e2e/ui-consistency-shell/navigation.e2e.ts`

### TC-UICONSISTENCYSHELL-003 — Khách chưa đăng nhập chỉ thấy Dashboard và CV ↔ JD Matching

- **Requirement:** REQ-UICONSISTENCYSHELL-02
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** không cookie (ẩn danh); mọi viewport
- **Bước:** mở `/`, chờ thẻ khách hiện, xem danh sách nav
- **Mong đợi:** đúng 2 link `nav.home`, `nav.match`
- **Automated:** `tests/e2e/ui-consistency-shell/navigation.e2e.ts`

### TC-UICONSISTENCYSHELL-004 — Bấm từng mục nav đi đúng route và chỉ mục đó active

- **Requirement:** REQ-UICONSISTENCYSHELL-03
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user e2e; desktop (luồng drawer là TC-022)
- **Bước:** từ `/` bấm lần lượt 6 mục nav
- **Mong đợi:** URL đổi đúng route; đúng 1 link có `aria-current="page"` và đó là mục vừa bấm (Dashboard không còn active)
- **Automated:** `tests/e2e/ui-consistency-shell/navigation.e2e.ts`

### TC-UICONSISTENCYSHELL-005 — Deep-link đánh dấu đúng mục và Dashboard chỉ active ở đúng /

- **Requirement:** REQ-UICONSISTENCYSHELL-03
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e; mọi viewport
- **Bước:** mở thẳng `/`, `/cv`, `/wizard?step=1`, `/my-data`, `/compare/<uuid>`
- **Mong đợi:** active lần lượt Dashboard, Curriculum Vitae, CV ↔ JD Matching, My data; ở `/compare/…` không mục nào active
- **Automated:** `tests/e2e/ui-consistency-shell/navigation.e2e.ts`

### TC-UICONSISTENCYSHELL-006 — Nav, tiêu đề /cv /jd và thẻ thống kê dùng nhãn mới, không còn Saved CVs/JDs

- **Requirement:** REQ-UICONSISTENCYSHELL-04
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user e2e; mọi viewport
- **Bước:** mở `/` (thẻ thống kê + nav), rồi `/cv`, `/jd`
- **Mong đợi:** thẻ thống kê `home.stat.savedCvs|savedJds`, nav `nav.savedCvs|savedJds`, h1 (tiêu đề trang) `/cv` = `library.title.cv`, `/jd` = `library.title.jd`; không đâu có "Saved CVs" / "Saved JDs" (phân biệt HOA-thường; copy empty-state nằm ngoài, Q4)
- **Automated:** `tests/e2e/ui-consistency-shell/navigation.e2e.ts`

## Thu / mở sidebar

### TC-UICONSISTENCYSHELL-007 — Sidebar mặc định mở rộng 288px với nút Collapse đúng thuộc tính

- **Requirement:** REQ-UICONSISTENCYSHELL-05
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** desktop, localStorage trống
- **Bước:** mở `/`
- **Mong đợi:** sidebar rộng 288px, nhãn chữ hiện; nút `nav.collapse` có `aria-expanded="true"`, `aria-controls="app-sidebar"`; chưa ghi `ui.sidebarCollapsed`
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-008 — Thu gọn thành rail 64px, link giữ accessible name, nội dung rộng ra và mở lại được

- **Requirement:** REQ-UICONSISTENCYSHELL-06
- **Layer:** e2e · **Priority:** P1 · **Tags:** @smoke
- **Tiền điều kiện:** desktop
- **Bước:** bấm `nav.collapse` → kiểm rail → bấm `nav.expand`
- **Mong đợi:** rail 64px, nút `nav.expand` `aria-expanded="false"`, không còn nhãn chữ nhưng link vẫn có tên; `<main>` rộng thêm 224px (±1); lưu `"true"`; mở lại → 288px, lưu `"false"`
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-009 — Rail hiện tooltip nhãn khi hover vào icon

- **Requirement:** REQ-UICONSISTENCYSHELL-06
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** desktop, sidebar thu gọn
- **Bước:** hover icon CV ↔ JD Matching
- **Mong đợi:** tooltip có text `nav.match`
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-010 — Double-click toggle để giao diện khớp giá trị đã lưu

- **Requirement:** REQ-UICONSISTENCYSHELL-06
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** desktop
- **Bước:** double-click nút toggle → tải lại trang
- **Mong đợi:** giá trị lưu là `"true"` hoặc `"false"`; nút + bề rộng sidebar khớp giá trị đó, và vẫn khớp sau khi tải lại
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-011 — Trạng thái thu gọn giữ nguyên khi đổi route và sau khi tải lại

- **Requirement:** REQ-UICONSISTENCYSHELL-07
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** desktop
- **Bước:** thu gọn → bấm Job Descriptions → F5 → mở rộng → F5
- **Mong đợi:** vẫn là rail sau đổi route và sau F5; sau khi mở rộng + F5 vẫn mở rộng
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-012 — Chỉ giá trị lưu true/false có tác dụng, giá trị khác quay về mở rộng

- **Requirement:** REQ-UICONSISTENCYSHELL-07
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** desktop
- **Bước:** lần lượt ghi `ui.sidebarCollapsed` = `"true"`, `"false"`, `""`, `"maybe"`, `"TRUE"`, xoá key; mỗi lần tải lại
- **Mong đợi:** chỉ `"true"` cho rail; còn lại mở rộng
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-013 — Storage bị chặn không làm crash, toggle vẫn chạy trong bộ nhớ

- **Requirement:** REQ-UICONSISTENCYSHELL-07
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** desktop; `localStorage.getItem/setItem/removeItem` ném `SecurityError`
- **Bước:** mở `/` → thu gọn → mở rộng
- **Mong đợi:** trang render mở rộng, toggle đổi 288 ↔ 64px, không có lỗi trang (pageerror)
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-014 — Toggle dùng bàn phím: Enter và Space đổi trạng thái, focus ở lại nút

- **Requirement:** REQ-UICONSISTENCYSHELL-09
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** desktop
- **Bước:** focus nút toggle → Enter → Space
- **Mong đợi:** Enter → rail (`aria-expanded="false"`), Space → mở rộng (`"true"`); focus ở trên nút sau mỗi lần
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-015 — HTML server luôn mở rộng, trạng thái lưu áp sau hydrate, không lỗi hydration

- **Requirement:** REQ-UICONSISTENCYSHELL-08
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** desktop; đã lưu `"true"`
- **Bước:** mở `/cv`, đọc HTML của response tài liệu
- **Mong đợi:** HTML có `aria-label` = `nav.collapse`, không có `nav.expand`; sau hydrate hiện nút `nav.expand`; console không có lỗi hydration
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

### TC-UICONSISTENCYSHELL-016 — Sidebar không có chuyển động khi bật giảm chuyển động

- **Requirement:** REQ-UICONSISTENCYSHELL-20
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** desktop; `prefers-reduced-motion: reduce`
- **Bước:** mở `/`, đọc `transition-duration` của `#app-sidebar`
- **Mong đợi:** `0s` (BUG-UICONSISTENCYSHELL-02: hiện là `0.2s`)
- **Automated:** `tests/e2e/ui-consistency-shell/sidebar-collapse.e2e.ts`

## Mobile / tablet

### TC-UICONSISTENCYSHELL-017 — Biên 1024px: 1023 hiện hamburger, 1024 và 1025 hiện sidebar

- **Requirement:** REQ-UICONSISTENCYSHELL-10
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** chỉ project `app` (test tự đổi bề rộng)
- **Bước:** mở `/` rồi đổi bề rộng 1023 → 1024 → 1025
- **Mong đợi:** 1023: có `nav.openMenu`, không sidebar / toggle; 1024, 1025: có sidebar + toggle, không hamburger
- **Automated:** `tests/e2e/ui-consistency-shell/responsive.e2e.ts`

### TC-UICONSISTENCYSHELL-018 — Header mobile của user có hamburger 44×44, tên app và nút tài khoản

- **Requirement:** REQ-UICONSISTENCYSHELL-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e; tablet / mobile
- **Bước:** mở `/`
- **Mong đợi:** nút `nav.openMenu` ≥ 44×44px; header có `appName`; nút `auth.account` `aria-haspopup="dialog"`; không có link `auth.signIn`
- **Automated:** `tests/e2e/ui-consistency-shell/responsive.e2e.ts`

### TC-UICONSISTENCYSHELL-019 — Header mobile của khách có link Sign in mang returnTo của trang hiện tại

- **Requirement:** REQ-UICONSISTENCYSHELL-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** ẩn danh; tablet / mobile
- **Bước:** mở `/wizard?step=1&ref=ucs`, đọc `href` của link `auth.signIn` (không bấm — D1/D5)
- **Mong đợi:** `href` = `<API>/auth/login?returnTo=/wizard?step=1&ref=ucs` (đã encode); cao ≥ 44px; không có nút tài khoản
- **Automated:** `tests/e2e/ui-consistency-shell/responsive.e2e.ts`

### TC-UICONSISTENCYSHELL-020 — Drawer mở từ hamburger có đủ nhãn và đóng bằng Close, Esc, bấm nền

- **Requirement:** REQ-UICONSISTENCYSHELL-12
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user e2e; tablet / mobile
- **Bước:** mở drawer → kiểm → Close; mở → Esc; mở → bấm nền
- **Mong đợi:** `dialog` tên `appName` chứa 6 nhãn chữ; cả ba cách đều đóng drawer
- **Automated:** `tests/e2e/ui-consistency-shell/responsive.e2e.ts`

### TC-UICONSISTENCYSHELL-021 — Drawer mobile vẫn đủ nhãn khi sidebar desktop đang thu gọn

- **Requirement:** REQ-UICONSISTENCYSHELL-12
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** chỉ project `app` (test tự đổi bề rộng)
- **Bước:** desktop thu gọn sidebar → đổi bề rộng 375px → mở drawer
- **Mong đợi:** drawer hiện nhãn chữ (Dashboard, Curriculum Vitae…), không phải rail icon
- **Automated:** `tests/e2e/ui-consistency-shell/responsive.e2e.ts`

### TC-UICONSISTENCYSHELL-022 — Bấm mục nav trong drawer đi đúng route và drawer tự đóng

- **Requirement:** REQ-UICONSISTENCYSHELL-19
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e; tablet / mobile
- **Bước:** mở drawer → bấm Curriculum Vitae
- **Mong đợi:** URL `/cv` và drawer đóng (BUG-UICONSISTENCYSHELL-01: drawer vẫn mở)
- **Automated:** `tests/e2e/ui-consistency-shell/responsive.e2e.ts`

## Khối tài khoản

### TC-UICONSISTENCYSHELL-023 — User thấy tên, email và nút Sign out ở chân sidebar mở rộng

- **Requirement:** REQ-UICONSISTENCYSHELL-13
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e (có `fullName` + email, đọc qua `api.auth.me()`); desktop
- **Bước:** mở `/`
- **Mong đợi:** sidebar có `fullName`, email, nút `auth.signOut` (không bấm); không có link `auth.signInWithDucker`
- **Automated:** `tests/e2e/ui-consistency-shell/account-block.e2e.ts`

### TC-UICONSISTENCYSHELL-024 — Rail: nút avatar mở popover tài khoản, Esc đóng và trả focus về nút

- **Requirement:** REQ-UICONSISTENCYSHELL-13
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e; desktop, sidebar thu gọn
- **Bước:** bấm nút `auth.account` → Esc
- **Mong đợi:** nút có `aria-haspopup="dialog"`; popover `dialog` tên `auth.account` chứa tên + `auth.signOut`; Esc đóng, focus về nút avatar
- **Automated:** `tests/e2e/ui-consistency-shell/account-block.e2e.ts`

### TC-UICONSISTENCYSHELL-025 — Khách thấy thẻ Guest mode với link đăng nhập và quota còn lại

- **Requirement:** REQ-UICONSISTENCYSHELL-14
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** ẩn danh; mọi viewport (compact: trong drawer); quota đọc qua `anonApi.auth.me()`
- **Bước:** mở `/`
- **Mong đợi:** thẻ có `auth.guest.eyebrow`, `auth.guest.pitch`, link `auth.signInWithDucker`, `auth.quota.label`, `auth.quota.left` với `left = limit − used`
- **Automated:** `tests/e2e/ui-consistency-shell/account-block.e2e.ts`

### TC-UICONSISTENCYSHELL-026 — Rail của khách chỉ còn link đăng nhập 44×44

- **Requirement:** REQ-UICONSISTENCYSHELL-14
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** ẩn danh; desktop
- **Bước:** thu gọn sidebar
- **Mong đợi:** link `auth.signInWithDucker` ≥ 44×44px; không còn eyebrow `auth.guest.eyebrow`
- **Automated:** `tests/e2e/ui-consistency-shell/account-block.e2e.ts`

### TC-UICONSISTENCYSHELL-027 — Quota đã dùng quá giới hạn hiển thị 0 lượt còn lại

- **Requirement:** REQ-UICONSISTENCYSHELL-14
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** ẩn danh; `GET /auth/me` stub `guestQuota = { limit: 5, used: 7 }` (Q5)
- **Bước:** mở `/`
- **Mong đợi:** quota hiện `auth.quota.left` với left = 0, limit = 5 (không âm)
- **Automated:** `tests/e2e/ui-consistency-shell/account-block.e2e.ts`

## Layout primitive

### TC-UICONSISTENCYSHELL-028 — Mọi trang bọc trong PageContainer 1600px với padding theo bề rộng

- **Requirement:** REQ-UICONSISTENCYSHELL-15
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user e2e; mọi viewport (390px → 16px; 820 / 1280px → 24px)
- **Bước:** mở `/`, `/wizard`, `/cv`, `/jd`, `/ai-credentials`, `/my-data`
- **Mong đợi:** phần tử con đầu của `<main>` có `max-width: 1600px`, padding trái/phải đúng ngưỡng
- **Automated:** `tests/e2e/ui-consistency-shell/layout.e2e.ts`

### TC-UICONSISTENCYSHELL-029 — Không trang nào cuộn ngang ở bề rộng 375px

- **Requirement:** REQ-UICONSISTENCYSHELL-15
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e; chỉ project `app-mobile`, tự đặt 375px
- **Bước:** mở 6 trang tĩnh
- **Mong đợi:** `scrollWidth − clientWidth` của tài liệu = 0
- **Automated:** `tests/e2e/ui-consistency-shell/layout.e2e.ts`

### TC-UICONSISTENCYSHELL-030 — SectionCard và tiêu đề trang dùng đúng cỡ chữ, bo góc và viền

- **Requirement:** REQ-UICONSISTENCYSHELL-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** ẩn danh (Dashboard khách có h1, h2 SectionCard và eyebrow `home.perks.eyebrow`); mọi viewport
- **Bước:** mở `/`, đọc computed style
- **Mong đợi:** h1 24px ≥ 700; h2 20px ≥ 700; eyebrow 12px uppercase; card bao h2 bo 12px và có viền
- **Automated:** `tests/e2e/ui-consistency-shell/layout.e2e.ts`

### TC-UICONSISTENCYSHELL-031 — Màu SectionCard theo prefers-color-scheme sáng và tối

- **Requirement:** REQ-UICONSISTENCYSHELL-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user e2e; mọi viewport
- **Bước:** mở `/my-data` (luôn có SectionCard có tiêu đề), giả lập `light` rồi `dark`
- **Mong đợi:** nền card = `--color-surface` sáng `rgb(255, 255, 255)` / tối `rgb(24, 24, 27)`
- **Automated:** `tests/e2e/ui-consistency-shell/layout.e2e.ts`

### TC-UICONSISTENCYSHELL-032 — Thư viện trống hiện empty state bên trong layout

- **Requirement:** REQ-UICONSISTENCYSHELL-17
- **Layer:** e2e · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** user mới không có tài liệu (`ucsFreshUser`, xoá sau test); mọi viewport
- **Bước:** mở `/cv`, `/jd`
- **Mong đợi:** `library.empty.cv` / `library.empty.jd` hiện bên trong PageContainer của `<main>`
- **Automated:** `tests/e2e/ui-consistency-shell/layout.e2e.ts`

### TC-UICONSISTENCYSHELL-033 — Lỗi tải thư viện hiện thông báo bên trong layout

- **Requirement:** REQ-UICONSISTENCYSHELL-17
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user e2e; `GET /documents?…` trả 500 (Q5); mọi viewport
- **Bước:** mở `/cv`, `/jd`
- **Mong đợi:** `role="alert"` với `library.loadError` nằm trong PageContainer của `<main>`; shell vẫn hiện
- **Automated:** `tests/e2e/ui-consistency-shell/layout.e2e.ts`

## i18n

### TC-UICONSISTENCYSHELL-034 — Shell desktop hiển thị tiếng Việt cho nav, toggle, tên app và khối tài khoản

- **Requirement:** REQ-UICONSISTENCYSHELL-18
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e; desktop; vi qua `setLanguage("vi")` (Q1)
- **Bước:** mở `/` → vi → kiểm → thu gọn → hover icon Job Descriptions
- **Mong đợi:** 6 nhãn nav, `appName`, `auth.signOut`, `nav.collapse` / `nav.expand`, `auth.account`, tooltip `nav.savedJds` đều là bản vi
- **Automated:** `tests/e2e/ui-consistency-shell/i18n.e2e.ts`

### TC-UICONSISTENCYSHELL-035 — Header và drawer mobile hiển thị tiếng Việt

- **Requirement:** REQ-UICONSISTENCYSHELL-18
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user e2e; tablet / mobile; vi qua `setLanguage("vi")`
- **Bước:** mở `/` → vi → mở drawer
- **Mong đợi:** `nav.openMenu`, `appName`, `auth.account`, tên drawer và 6 nhãn nav là bản vi
- **Automated:** `tests/e2e/ui-consistency-shell/i18n.e2e.ts`

### TC-UICONSISTENCYSHELL-036 — Shell không hiện raw key i18n ở cả en và vi

- **Requirement:** REQ-UICONSISTENCYSHELL-18
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** ẩn danh; mọi viewport
- **Bước:** mở `/`, lần lượt en và vi, đọc text của sidebar / header / drawer
- **Mong đợi:** thẻ khách hiện `auth.guest.eyebrow`, `auth.guest.pitch`, `auth.signInWithDucker` đúng ngôn ngữ; không có chuỗi dạng `nav.…` / `auth.…` / `appName.…`
- **Automated:** `tests/e2e/ui-consistency-shell/i18n.e2e.ts`
