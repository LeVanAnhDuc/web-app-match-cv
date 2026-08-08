# E2E — ui-consistency-shell

Kết quả dual-gate §4.3 cho feature `ui-consistency-shell`, chạy 2026-08-08.

- **Gate A** — suite committed: `yarn test:e2e` (3 viewport project desktop/tablet/mobile) trên cặp dev server đang chạy (`server :5200` / `client :5300` từ worktree).
- **Gate B** — MCP walk: browser thật qua Playwright MCP, context riêng (không chia sẻ storage với gate A).

**Kết quả tổng: ✅ PASS cả 2 gate.** Gate A 135/135. Gate B: mọi scenario walk đều đúng kỳ vọng, `console` 0 error.

File test: `client/e2e/ui-consistency-shell/sidebar.e2e.ts` (7 test) + reconcile `client/e2e/home-dashboard-library/library.e2e.ts` (nhãn + scenario 8).

Hai vòng fail trong quá trình dựng suite (cả hai đều là lỗi test, không phải lỗi app) ghi ở [e2e-bugs.md](./e2e-bugs.md).

## Kết quả theo scenario

| #   | Category            | Scenario                                                                                        | Gate  | Kết quả                                                                                       |
| --- | ------------------- | ----------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| 1   | Happy path          | 4 nav item đúng nhãn mới; click từng item → đúng route và **chỉ** item đó có `aria-current`      | A+B   | ✅ A: `[happy] desktop shows 4 nav items…` · B: snapshot xác nhận 4 link + active đúng          |
| 2   | AuthN               | N/A — chưa có auth (mock user, defer Roadmap #2)                                                | —     | —                                                                                              |
| 3   | AuthZ               | N/A — chưa có role/permission                                                                   | —     | —                                                                                              |
| 4   | Validation          | **[EP]** `ui.sidebarCollapsed` = `"true"`/`"false"`/`""`/`"maybe"`/vắng → chỉ 2 giá trị hợp lệ có tác dụng | A+B   | ✅ A: `[validation] a garbage persisted value…` + unit `ui.test.ts` (5 lớp) · B: n/a (đã phủ ở A) |
| 5   | Empty / null        | localStorage sạch → sidebar mở; empty-state library render đúng trong SectionCard mới           | A+B   | ✅ A: library suite · B: `/cv` rỗng hiển thị đúng trong card                                    |
| 6   | Boundary            | **[BVA]** `1023` → hamburger, không rail · `1024` → rail, không hamburger · `1025` như 1024      | A+B   | ✅ A: `[boundary] the rail control exists at 1024 but not at 1023`                              |
| 7   | Filter / search     | N/A — thay đổi không có filter/search                                                           | —     | —                                                                                              |
| 8   | Data rendering      | Không còn chuỗi `"Saved CVs"`/`"Saved JDs"` ở nav, tiêu đề trang, stat card                     | A+B   | ✅ A: assertion `toHaveCount(0)` trong `library.e2e.ts` · B: screenshot Home + `/cv`            |
| 9   | i18n                | en + vi cho 4 nhãn nav, tooltip/aria collapse+expand, tiêu đề `/cv` `/jd`, nhãn stat card       | A+B   | ✅ A: `[i18n] nav labels and the toggle render in Vietnamese` + `[i18n] switches nav to Vietnamese` |
| 10  | Error / loading     | Library 5xx → thông báo lỗi trong layout mới; loading → Skeleton; console sạch sau hydrate       | A+B   | ✅ A: library suite · B: `browser_console_messages(level=error)` = 0                            |
| 11  | Mutation / state    | **[ST]** mở→rail→mở · giữ rail khi đổi route · persist qua F5 · **[DT]** 4 tổ hợp viewport×state | A+B   | ✅ A: 2 test `[state]` · B: toggle 2 chiều + drawer mobile giữ nav đầy đủ khi desktop đang rail  |
| 12  | Accessibility       | `aria-expanded` đúng chiều · `aria-controls` · `aria-current="page"` · rail giữ accessible name · Enter đổi state, focus ở lại nút | A+B   | ✅ A: `[a11y] the toggle is keyboard operable…` · B: snapshot a11y tree xác nhận tên/role       |

## Ghi chú & gap còn lại

- **Server flake**: lần chạy full đầu tiên có 3 test tablet fail với `TypeError: fetch failed` — API `:5200` tự restart giữa run (PID đổi 2764→24956), không liên quan thay đổi này. Chạy lại `--project=tablet` → 45/45 pass.
- **Follow-up (không thuộc phạm vi feature này)**: copy empty-state vẫn dùng từ cũ — `library.empty.cv` = "No saved CVs yet", `library.empty.jd` = "No saved JDs yet", và `reuse.cv.title` = "Or reuse a saved CV". Nhãn nav/tiêu đề đã đổi sang "Curriculum Vitae"/"Job Descriptions" nên phần copy này hơi lệch giọng. Design `§4.4` chỉ chốt đổi các key nav/library.title/home.stat, nên giữ nguyên ở đây; nếu muốn đồng bộ giọng thì mở task copy riêng.
- **Gate B & mutation**: feature này không có scenario mutation-heavy nào (state duy nhất là localStorage của chính context), nên không có row `A only`.
