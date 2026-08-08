# E2E — `ai-credentials`

> Gate A chạy 2026-08-08: **78/78 pass** (`--project=desktop`), gồm 33 test mới của feature này + 45 test có sẵn của các feature trước.
> Suite ở `client/e2e/ai-credentials/`. Kịch bản gốc: `design.md` §7 (E2E Scenario Matrix).

## Cách chạy

Cần một cặp dev server đang chạy. Từ worktree, dùng port riêng để không đụng main checkout:

```bash
# server (từ server/.worktrees/ai-credentials, sau yarn build)
PORT=5202 CLIENT_ORIGIN=http://localhost:5302 node dist/src/main.js

# client (từ client/.worktrees/ai-credentials)
VITE_API_BASE_URL=http://localhost:5202/api/v1 yarn dev --port 5302

# gate A
E2E_BASE_URL=http://localhost:5302 E2E_API_BASE=http://localhost:5202/api/v1 \
  yarn test:e2e --project=desktop
```

`CLIENT_ORIGIN` của server **phải** khớp origin của client, nếu không CORS chặn hết request.

## Nguyên tắc của suite

- **Không gọi provider AI thật**, trừ đúng một chỗ có lý do (xem row 1c). `stubTestEndpoint()` intercept `POST /ai-credentials/:id/test` bằng **regex** — glob có wildcard segment (`*/test`) không match ổn định.
- **Seed qua API, dọn qua `pg`**. `resetCredentials()` xoá sạch bảng `AiCredential`; an toàn vì `MatchResult.credentialId` là `ON DELETE SET NULL`.
- **`markUsed()` ghi thẳng `lastUsedAt`** thay vì chạy match thật — selector chỉ đọc cột đó, nên set trực tiếp là tương đương và giữ suite offline.
- **`openAddDialog()` có retry**: dưới tải, nút có thể bị click trước khi TanStack Start hydrate xong nên click đầu là no-op (cùng hazard với `switchToPasteTab` của wizard).

## Ánh xạ Matrix → test

| Row | Category | File · test | Gate | Kết quả |
|---|---|---|---|---|
| 1a | Happy — empty state | `happy-path` · *empty page offers the add action and explains the fallback* | A+B | ✅ |
| 1b | Happy — create | `happy-path` · *creating a credential shows it masked and reports the test per capability* | A only | ✅ |
| 1c | Happy — test | `happy-path` · *testing an existing credential replaces the 'Not tested' chip* | A only | ✅ |
| 1d | Happy — step 3 default | `happy-path` · *wizard step 3 defaults to the most recently used credential and names the provider* | A+B | ✅ |
| 1e | Happy — step 4 attribution | `happy-path` · *step 4 shows which provider and model produced the result* | A+B | ✅ |
| 2 | AuthN | — | — | **N/A** — chưa có auth, không có màn login (`project-goals.md` §3). Thành ✅ ở Roadmap #6. |
| 3 | AuthZ | `server/test/ai-credentials.e2e-spec.ts` › *per-user isolation* | — | **N/A ở FE** — chỉ tồn tại một mock user nên FE không dựng được user thứ hai. Cover ở BE e2e: list không chứa, và PATCH/DELETE/test đều 404. |
| 4 | Validation `[EP]` `[DT]` | `validation` · 7 test | A only | ✅ |
| 5 | Empty / null | `data-and-empty` · *null model overrides…*, *never-tested…*, *with no credentials, step 3 defaults to the system key* | A+B | ✅ |
| 6 | Boundary `[BVA]` | `validation` · *19/20*, *401*, *label 61/60* | A only | ✅ |
| 7 | Filter / search | — | — | **N/A** — trang không có filter/search/sort; sort cố định `createdAt desc`, không query param nào cần persist. |
| 8 | Data rendering | `data-and-empty` · *provider enum renders as a human label*, *a stored override is shown verbatim*, *the full key never appears in the DOM* | A+B | ✅ |
| 9 | i18n (en + vi) | `i18n` · 4 test | A+B | ✅ |
| 10 | Error / loading | `error-and-loading` · 4 test | A+B | ✅ |
| 11 | Mutation safety `[ST]` | `mutation-and-a11y` · *rotating the key returns the row to 'Not tested'*, *deleting…*, *double-clicking Save creates exactly one* | A only | ✅ |
| 12 | Accessibility | `mutation-and-a11y` · 4 test | A+B | ✅ |

### Chi tiết các row có kỹ thuật test-design

**Row 4 `[EP]`** — `apiKey`: valid · empty · 19 ký tự · chứa khoảng trắng. `label`: valid · empty · trùng.
**Row 4 `[DT]`** — `label trùng + key hợp lệ` → 409 hiện **trên ô label**, không phải toast; `label trùng + key 19 ký tự` → **lỗi client thắng và không request nào được bắn** (đếm qua `page.on("request")`).
**Row 6 `[BVA]`** — `apiKey` 19 reject / 20 accept / 401 reject; `label` 61 reject / 60 accept.
**Row 11 `[ST]`** — vòng đời `tạo (chưa test)` → `test → có verdict` → `rotate key` → **verdict reset về "Not tested"** → `xoá`. Invalid transition: chọn credential ở step 3 → xoá nó qua API → Run match → alert hiện và wizard **ở lại step 3**, không nhảy sang trang kết quả rỗng.

## Ba điều suite này phát hiện (đã sửa)

1. **`chatModel`/`embedModel` validate là `Length(1,120)` + no-whitespace** → mọi lần Save từ modal sửa trả **400**, vì form gửi `""` cho ô trống; và override đã lưu **không xoá được**. Đổi thành `Length(0,120)`, blank = dùng mặc định / xoá override. Bắt được ở **BE e2e**, không phải FE.
2. **Trang có 2 heading trùng chữ "AI credentials"** (h1 của trang + h2 của `SectionCard`) → `getByRole("heading")` strict-mode violation. Đây là lỗi UX thật: bỏ title của card, chuyển ghi chú fallback xuống dưới danh sách.
3. **Raw `INSERT INTO "MatchResult"` trong `home-dashboard-library/library.e2e.ts`** thiếu 3 cột NOT NULL mới → insert fail → test "recent match row" đỏ. Đã thêm `provider`/`chatModel`/`embedModel` vào câu INSERT.

## Gate B (MCP walk) — chưa chạy

Gate B đòi một subagent lái browser thật qua Playwright MCP. Phiên này chạy dưới chỉ thị **không dùng Agent tool**, nên gate B **chưa thực hiện**. §4.3 yêu cầu **cả hai** gate xanh mới coi là pass, nên đây là **khoảng trống có chủ ý, ghi lại để không đọc thành "đã cover"**.

Bù lại một phần: các row `A+B` đều là read/render và đã được gate A assert trên accessibility tree (`getByRole`/`getByLabel`) chứ không phải CSS selector, cộng với 2 locale. Phần gate B thêm được mà gate A không có: console error, network request fail, và cảm nhận thị giác.
