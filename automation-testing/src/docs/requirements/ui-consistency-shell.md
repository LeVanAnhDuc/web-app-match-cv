# UICONSISTENCYSHELL — App shell, sidebar, layout primitive

**Điều hướng**

- **REQ-UICONSISTENCYSHELL-01** Mọi trang trong `/_app` (`/`, `/wizard`, `/cv`, `/jd`, `/ai-credentials`, `/my-data`, `/compare/:id`, `/cv-rewrite/:id`) render trong cùng một shell: sidebar trái `#app-sidebar` khi viewport ≥ 1024px, header + nút hamburger khi < 1024px; nội dung trang nằm trong `<main>`.
- **REQ-UICONSISTENCYSHELL-02** User đã đăng nhập thấy đúng 6 mục nav theo thứ tự: Dashboard `/` · CV ↔ JD Matching `/wizard` · Curriculum Vitae `/cv` · Job Descriptions `/jd` · AI credentials `/ai-credentials` · My data `/my-data` (`nav.home|match|savedCvs|savedJds|aiCredentials|myData`). Khách và người chưa đăng nhập chỉ thấy 2 mục Dashboard + CV ↔ JD Matching.
- **REQ-UICONSISTENCYSHELL-03** Bấm một mục nav → đi đúng route; **chỉ** mục khớp route hiện tại có trạng thái active (`aria-current="page"`); Dashboard active chỉ khi đúng `/` (khớp chính xác). Không mục nào luôn active. Mở thẳng một route bằng URL (deep-link) cũng đánh dấu đúng mục.
- **REQ-UICONSISTENCYSHELL-04** Không còn chuỗi "Saved CVs" / "Saved JDs" ở nav, tiêu đề trang `/cv` `/jd` và thẻ thống kê ở Dashboard: tất cả là "Curriculum Vitae" / "Job Descriptions" (vi "Sơ yếu lý lịch" / "Mô tả công việc").

**Thu / mở sidebar (desktop ≥ 1024px)**

- **REQ-UICONSISTENCYSHELL-05** Mặc định (localStorage trống) sidebar mở rộng 288px, có nhãn chữ; nút toggle có `aria-label` = `nav.collapse` ("Collapse sidebar" / "Thu gọn thanh bên"), `aria-expanded="true"`, `aria-controls="app-sidebar"`.
- **REQ-UICONSISTENCYSHELL-06** Bấm toggle → rail 64px chỉ còn icon, `aria-expanded="false"`, `aria-label` = `nav.expand` ("Expand sidebar" / "Mở thanh bên"); mỗi link trong rail vẫn có accessible name bằng nhãn của nó và hiện tooltip nhãn khi hover; vùng nội dung rộng ra. Bấm lại → mở rộng. Double-click nhanh → giao diện và giá trị lưu khớp nhau (một trạng thái nhất quán).
- **REQ-UICONSISTENCYSHELL-07** Trạng thái thu/mở lưu ở `localStorage["ui.sidebarCollapsed"]` = `"true"` | `"false"`; giữ nguyên khi đổi route và sau khi tải lại trang. Giá trị khác (`""`, `"maybe"`, không có) → mở rộng. Storage bị chặn → app không crash, toggle vẫn chạy trong bộ nhớ.
- **REQ-UICONSISTENCYSHELL-08** HTML server render luôn là bản mở rộng; trạng thái đã lưu áp dụng sau hydrate; console không có lỗi hydration mismatch.
- **REQ-UICONSISTENCYSHELL-09** Toggle dùng được bằng bàn phím (Tab tới, Enter / Space đổi trạng thái), focus ở lại trên nút sau khi đổi.

**Mobile / tablet (< 1024px)**

- **REQ-UICONSISTENCYSHELL-10** Biên 1024px: 1023px → có header + hamburger, không có sidebar / toggle; 1024px và 1025px → có sidebar + toggle, không có hamburger.
- **REQ-UICONSISTENCYSHELL-11** Header mobile: nút hamburger `aria-label` = `nav.openMenu` ("Open menu" / "Mở menu") kích thước 44×44px, tên app `appName` ("Match CV" / "Ghép CV"); bên phải là menu tài khoản (user) hoặc link `auth.signIn` trỏ tới `<API>/auth/login?returnTo=<path + query hiện tại>` (khách / chưa đăng nhập).
- **REQ-UICONSISTENCYSHELL-12** Hamburger mở drawer bên trái (role `dialog`, tên = `appName`) chứa danh sách nav **đủ nhãn chữ**, kể cả khi sidebar desktop đang thu gọn; đóng được bằng nút Close, phím Esc hoặc bấm ra nền.
- **REQ-UICONSISTENCYSHELL-19** Bấm một mục nav trong drawer → đi đúng route **và drawer tự đóng**.

**Khối tài khoản ở chân sidebar**

- **REQ-UICONSISTENCYSHELL-13** User, sidebar mở rộng: avatar + `fullName` (hoặc email khi không có tên) + email (khi có tên) + nút `auth.signOut`. Sidebar thu gọn: chỉ nút avatar (`aria-label` = `auth.account`, `aria-haspopup="dialog"`) mở popover (role `dialog`, tên `auth.account`) chứa tên + nút Sign out; Esc đóng popover và trả focus về nút avatar.
- **REQ-UICONSISTENCYSHELL-14** Khách / chưa đăng nhập, sidebar mở rộng: thẻ `auth.guest.eyebrow` + `auth.guest.pitch` + link `auth.signInWithDucker`; khi có quota hiện `auth.quota.label` và `auth.quota.left` "{{left}} / {{limit}} left" với `left = max(0, limit − used)`. Sidebar thu gọn: link icon 44×44px `aria-label` = `auth.signInWithDucker`.

**Layout primitive (đồng nhất nội dung)**

- **REQ-UICONSISTENCYSHELL-15** Mọi trang bọc trong `PageContainer`: canh giữa, `max-width` 1600px, padding 16px (< 768px) / 24px (≥ 768px); không trang nào cuộn ngang ở bề rộng 375px.
- **REQ-UICONSISTENCYSHELL-16** Khối nội dung dùng `SectionCard`: bo góc 12px, có viền, nền surface; tiêu đề h2 20px đậm, eyebrow 12px chữ HOA; h1 của trang (khi có) 24px đậm. Màu sáng / tối theo `prefers-color-scheme` (không có nút đổi tay).
- **REQ-UICONSISTENCYSHELL-17** Empty state và thông báo lỗi tải của thư viện CV / JD render bên trong `<main>` của layout mới.
- **REQ-UICONSISTENCYSHELL-20** Khi người dùng bật `prefers-reduced-motion: reduce`, sidebar đổi bề rộng không có hiệu ứng chuyển động (transition-duration = 0).

**i18n**

- **REQ-UICONSISTENCYSHELL-18** Nhãn nav, aria / tooltip của toggle, `nav.openMenu`, `appName` và khối tài khoản có đủ bản `en` + `vi`; không hiện raw key (`nav.…`, `auth.…`).
