# E2E Bugs — ui-consistency-shell

Append-only log của các vòng dual-gate fail (§4.3). Tối đa 3 vòng rồi dừng.

## Round 1 — 2026-08-08

- **Gate fail**: A (`yarn test:e2e --project=desktop e2e/ui-consistency-shell`) — 2/7 fail.
- **Scenario**: 11 `[state] collapse to rail…` và 11 `[state] a collapsed desktop preference does not affect the mobile drawer`.
- **Triệu chứng**: `getByText("Curriculum Vitae")` resolve ra 2 element (strict-mode violation / assertion sai). Observed: locator khớp cả `span` trong stat card Home lẫn `span` nhãn nav. Expected: chỉ khớp nhãn trong sidebar.
- **Root cause**: đổi `home.stat.savedCvs` sang cùng chuỗi "Curriculum Vitae" với `nav.savedCvs` (đúng theo design §4.4) khiến locator không phạm vi trở nên mơ hồ. **Lỗi ở test, không phải ở app.**
- **Fix đã làm**: `e2e/ui-consistency-shell/sidebar.e2e.ts` — scope locator vào `page.locator("#app-sidebar")` (test rail) và `page.getByRole("dialog")` (test drawer), kèm comment nêu lý do.
- **Kết quả re-verify**: 6/7 pass (1 fail còn lại → Round 2).

## Round 2 — 2026-08-08

- **Gate fail**: A — 1/7 fail.
- **Scenario**: 11 `[state] collapse to rail, survives navigation and reload`.
- **Triệu chứng**: sau `page.reload()`, nút hiển thị "Collapse sidebar" (đang mở) thay vì "Expand sidebar" (rail) — trạng thái persist không được áp dụng.
- **Root cause**: `test.beforeEach` gọi `page.addInitScript(() => localStorage.clear())`. Init script của Playwright **chạy lại ở mỗi lần navigation**, kể cả `reload()` → xoá đúng giá trị vừa ghi trước khi app hydrate. Mỗi test Playwright vốn đã có browser context riêng nên localStorage đã sạch sẵn; `beforeEach` này thừa. **Lỗi ở test, không phải ở app** — persist thật sự hoạt động (đã có unit test `ui.test.ts` + xác nhận lại ở gate B).
- **Fix đã làm**: bỏ `beforeEach` clear, thêm comment cảnh báo không dùng init script để clear storage trong file này.
- **Kết quả re-verify**: 7/7 pass. Full suite 3 viewport: 135/135 pass (3 fail ở lần chạy trước là do server `:5200` tự restart giữa run — `TypeError: fetch failed`, PID đổi 2764→24956; chạy lại project `tablet` cho 45/45 pass).
