# E2E — `data-export`

Gate A suite: `client/e2e/data-export/export.e2e.ts` (6 tests × 3 viewport projects = 18 runs, all green).

Scenario Matrix copied from `design.md` §7, with each row marked against what this suite (Gate A) actually covers. Gate B (MCP walk) is not run as part of writing this file; see `design.md` §7's own note that Gate B still walks every `A+B` row, verifying render/click without unzipping.

| # | Nhóm | Scenario / lý do N/A | Gate | Covered here |
|---|---|---|---|---|
| 1 | **Happy path** | Bấm tải → nhận zip hợp lệ, mở ra có `data.json` + đúng 1 file cho mỗi tài liệu có `fileData` | A only | ✅ Partial — the browser-reachable half only: `page.waitForEvent("download")` fires and the suggested filename matches `export-\d{4}-\d{2}-\d{2}\.zip`. Unzipping and inspecting `data.json`/per-document files is not reachable from the browser and is not attempted here (no BE e2e test unzips content-listing either at time of writing — the BE zip-shape assertions in §9 cover this at the archive level) |
| 2 | **AuthN** | N/A — app chưa có auth, chạy bằng mock user | — | N/A (unchanged from design.md) |
| 3 | **AuthZ** | N/A ở tầng UI — một role duy nhất | — | N/A (unchanged from design.md) |
| 4 | **Validation** | Header-as-input edge cases (`Range`, `Accept`, wrong method) | A only | N/A here — these are HTTP-header-level edge cases against the raw endpoint, not reachable by clicking a button in a browser. Belongs to BE e2e |
| 5 | **Empty / null** | 5 lớp dữ liệu lệch ở tầng zip/JSON | A only | N/A here — all 5 sub-cases are about the shape of `data.json`/zip entries, verified by unzipping — BE-level only |
| 6 | **Boundary** | Số tài liệu / kích thước `fileData` / độ dài tiêu đề | A only | N/A here — BE-level (zip entry counts and byte sizes), not observable through the page |
| 7 | **Filter / search** | N/A — trang không có bộ lọc | — | N/A (unchanged from design.md) |
| 8 | **Data rendering** | Trang liệt kê đúng những gì export chứa; slug/entry-naming edge cases | A+B | ✅ Partial — the page-rendering half: the "the archive contains" list shows all three content items (documents / matches / credentials), asserted against `src/locales/en/translation.json`. The slug/entry-naming edge cases (Vietnamese diacritics, Windows-reserved names, collision suffixes) are inside the zip, not on the page — BE-level |
| 9 | **i18n** | Trang render đúng ở cả `en` và `vi`; tên file zip không đổi theo locale | A+B | ✅ Full — title/description/button label asserted in both `en` and `vi` (driven via the dev-only `window.__i18n.changeLanguage()` hook, the only mechanism the app exposes — no language-switcher UI exists yet). Filename-invariance-to-locale not separately asserted (the filename is client-generated from the local date regardless of `t()`, so there's no code path by which switching language could affect it) |
| 10 | **Error / loading** | 500 → UI hiện lỗi, nút bấm lại được; lỗi giữa stream; client ngắt kết nối | A+B (2 case cuối: A only) | ✅ Partial — the first case only: `page.route` intercepting `**/me/export` to return 500 shows `role="alert"` and re-enables the button (guards the "stuck in loading forever" defect). Mid-stream failure and client-disconnect-mid-stream are server-side streaming behaviors not reachable/observable through a completed `fetch()` in the browser — BE-level |
| 11 | **Mutation safety** | Bấm lần 2 khi lần 1 đang bay → không tạo request thứ 2; rời trang giữa chừng; ảnh chụp nhất quán; throttle | A only | ✅ Partial — the double-click case only: two clicks in rapid succession (second issued via a forced, no-actionability-wait click while the first request is deliberately slowed via `page.route`) produce exactly one request to `/me/export`. Unmount-mid-request, read-consistency-under-concurrent-upload, and `ThrottlerGuard` behavior are not covered here — the first two would need internal render-cycle instrumentation beyond black-box E2E, and throttling is a BE-level concern already gated by `ThrottlerGuard` globally |
| 12 | **Accessibility** | Nút có accessible name; Tab/Enter/Space; `aria-busy`/live region; thông báo cả lúc kết thúc | A+B | ✅ Partial — reachable by `Tab`, activates with `Enter`, and is found via its accessible name (`getByRole("button", { name: … })` succeeding *is* the accessible-name assertion). `aria-busy` and the live-region announcement on completion are implemented in the component (`aria-live="polite"` wrapping both outcomes) but not independently asserted by a dedicated test in this file — the error-path test (row 10) does assert the completion announcement for the failure branch via `role="alert"` |
| 13 | **Rò rỉ dữ liệu** *(feature-specific)* | encryptedKey/keyIv/keyTag không rò rỉ; zip-slip; keyLast4 null-safe | A only | **Not covered here — by design.** Proven at the BE e2e level (Task 3) by unzipping the real archive and string-scanning every byte, which is strictly stronger than anything reachable through a browser (the browser never sees the raw zip bytes — it only sees a `Blob` handed to `<a download>`) |
| 14 | **Toàn vẹn file** *(feature-specific)* | Byte-identical file extraction; UTF-8 entry flag | A only | **Not covered here — by design.** Proven at the BE e2e level (Task 3) by hashing the extracted bytes against the seeded upload — again strictly stronger than a browser-level check, which cannot inspect zip internals |

## Test file → matrix mapping

| Test (`export.e2e.ts`) | Row(s) |
|---|---|
| `[happy] clicking download triggers a real browser download named export-<date>.zip` | 1 |
| `[data-render] lists all three archive-contents items` | 8 |
| `[i18n] renders correctly in both English and Vietnamese` | 9 |
| `[error][loading] a 500 shows role=alert and re-enables the button` | 10 |
| `[mutation-safety] two rapid clicks issue exactly one request` | 11 |
| `[a11y] button is reachable by Tab, activates with Enter, has an accessible name` | 12 |

## Deliberately not duplicated here

Rows **13** (credential-leak scan) and **14** (byte-for-byte file integrity) are proven at the **BE e2e** level (Task 3) against the real zip bytes — unzipping the archive and string-scanning/hashing its actual contents. That is strictly stronger than anything reachable through a browser: the page never has direct access to the zip's raw bytes, only a `Blob` it hands to `<a download>`. Re-testing these at the browser level would add a weaker, redundant check, not additional coverage.

## N/A rows (unchanged from `design.md` §7)

- **Row 2 (AuthN)** — the app has no auth yet; every request runs as the stub user (`project-goals.md` §3). There is no login screen to exercise.
- **Row 3 (AuthZ)** — a single role, nothing hidden/shown by permission at the UI layer. Per-user isolation is a BE constraint, already covered at the BE e2e level.
- **Row 4 (Validation)** — the endpoint takes no parameters from the UI; the only "validation" surface is HTTP headers (`Range`, `Accept`, wrong method), which is not something a user can trigger by clicking a button in a browser.
- **Row 7 (Filter/search)** — the page has no filter and the endpoint accepts no filter parameters.
