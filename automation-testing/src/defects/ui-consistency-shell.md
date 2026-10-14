# UICONSISTENCYSHELL — Bug log

## Đang mở

_(không có)_

## Đã sửa

### BUG-UICONSISTENCYSHELL-01

- **TC:** TC-UICONSISTENCYSHELL-022 · **Requirement:** REQ-UICONSISTENCYSHELL-19
- **Bước tái hiện:** viewport < 1024px (vd 390px) → bấm "Open menu" → bấm "Curriculum Vitae" trong drawer.
- **Mong đợi:** chuyển sang `/cv` và drawer đóng.
- **Thực tế:** URL đổi sang `/cv` nhưng drawer vẫn mở che nội dung; phải bấm Close / Esc / nền. `AppShell` chỉ đặt
  `isDrawerOpen=false` trong `onClose` của Drawer, không có effect theo route (`client/src/layouts/AppShell/index.tsx`).
  Quan sát lại 2026-10-14 trên dev.
- **Đã sửa:** root cause — link nav trong Drawer không báo cho `AppShell`, và shell không remount khi đổi route nên
  `isDrawerOpen` giữ `true`. Fix — `Sidebar` nhận `onNavigate` gắn vào `onClick` của từng link; Drawer truyền
  `() => setIsDrawerOpen(false)` (commit: 7c3df49).

### BUG-UICONSISTENCYSHELL-02

- **TC:** TC-UICONSISTENCYSHELL-016 · **Requirement:** REQ-UICONSISTENCYSHELL-20
- **Bước tái hiện:** desktop, bật `prefers-reduced-motion: reduce` (devtools / `page.emulateMedia`) → mở `/` → đọc
  `transition-duration` của `#app-sidebar` (hoặc bấm thu gọn).
- **Mong đợi:** `0s` — đổi bề rộng tức thì (NFR-A11Y-05).
- **Thực tế:** `0.2s`: aside dùng `transition-[width] duration-200` không có biến thể `motion-reduce:`, `styles.css`
  không có media query `prefers-reduced-motion`.
- **Đã sửa:** root cause — aside chỉ có `transition-[width] duration-200`, không có biến thể reduced-motion. Fix —
  thêm `motion-reduce:duration-0` để `transition-duration` = `0s` khi bật `prefers-reduced-motion: reduce`
  (commit: 34b687d).

<!-- Bug log cũ (docs/specs/ui-consistency-shell/e2e-bugs.md, Round 1 + 2, 2026-08-08) đã bỏ: cả hai là lỗi của
     script test (locator không phạm vi trùng nhãn stat card; init script xoá localStorage mỗi lần reload), không phải
     lỗi app. Bài học giữ lại trong spec: locator nav đi qua AppShell (scope #app-sidebar / drawer), và không clear
     storage bằng init script (comment đầu sidebar-collapse.e2e.ts). -->
