# Security Report — ui-consistency-shell

**Ngày**: 2026-08-08 · **Verdict**: ✅ **PASS (skip có lý do)**

## Quyết định

Theo root `CLAUDE.md` §4.5, security review **bắt buộc** khi feature đụng **auth / input người dùng / data nhạy cảm**. Feature này không đụng nhóm nào trong đó → **skip** review sâu, ghi lý do lại đây.

## Attack surface đã rà

| Hạng mục | Thay đổi | Đánh giá |
| --- | --- | --- |
| Auth / authz | Không đụng | App chưa có auth (mock user, defer Roadmap #2) |
| Input người dùng | Không thêm/đổi input nào | Không có form, không parse dữ liệu mới |
| Gọi API / contract | Không đụng | Không thêm/đổi request; `apiFetch` giữ nguyên |
| Render nội dung untrusted | Không đụng | Không thêm `dangerouslySetInnerHTML`; nội dung CV/JD vẫn qua `DocumentPreview` như cũ |
| Server-side | Không đụng `server/` | Feature FE-only |
| Dependency | Không thêm package | Chỉ dùng antd/lucide/zustand đã có |
| Secrets / env | Không thêm biến env | — |

## Một điểm đáng nêu: `localStorage`

Feature ghi **một** giá trị vào `localStorage`: key `ui.sidebarCollapsed`, giá trị `"true"` | `"false"`.

- **Không phải dữ liệu nhạy cảm** — chỉ là tuỳ chọn hiển thị, không định danh người dùng, không mang token/PII.
- **Đọc có kiểm chứng**: `hydrateSidebar` chỉ chấp nhận đúng 2 chuỗi `"true"`/`"false"`; mọi giá trị khác (rỗng, rác, bị sửa tay) bị bỏ qua và rơi về mặc định "mở". Không `JSON.parse`, không eval, không đưa giá trị vào DOM → không có đường XSS hay prototype pollution.
- **Ghi/đọc bọc `try/catch`**: private mode hoặc storage bị chặn thì state chỉ nằm trong bộ nhớ, không throw làm vỡ render.
- Có unit test phủ đủ 5 lớp giá trị (`src/stores/slices/__tests__/ui.test.ts`) + e2e `[validation] a garbage persisted value falls back to expanded`.

## Kết luận

Không có finding. Verdict **PASS** — không chặn bước tạo PR.
