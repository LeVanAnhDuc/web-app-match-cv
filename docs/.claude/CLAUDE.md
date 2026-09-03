# Rules — `docs/`

Tài liệu chia **hai tầng**. Bản đồ đầy đủ + quy ước ID nằm ở [`docs/README.md`](../README.md)
— đó là file duy nhất được phép nói về file khác. File này chỉ nói **cách làm việc** với
thư mục `docs/`.

## 1. Tầng 1 — vĩnh viễn

`01-product/` · `02-requirements/` · `03-design/` · `04-state/` · `decisions/` ·
`erd.md` · `design-system/match-cv/MASTER.md`.

- **Đọc header 4 dòng trước phần thân.** Nó nói file trả lời câu gì và đang điền tới
  đâu. 🔴 nghĩa là **trống** — đừng suy luận từ nó, nói thẳng là nó trống.
- **Không sửa tay trong `<!-- BEGIN:auto -->` … `<!-- END:auto -->`.** Đổi header
  `**Trạng thái:**` của chính file rồi để `.claude/scripts/docs-regen.sh` nhặt.
- **Không hai file cùng nói một chuyện.** Mỗi file có khối `<!-- CÁCH ĐIỀN -->` ghi rõ
  nó **KHÔNG** chứa gì — tôn trọng ranh giới đó.
- Feature mới phải đối chiếu [`01-product/overview.md`](../01-product/overview.md)
  §4 Non-Goals **trước khi** vào `superpowers:brainstorming`. Feature mâu thuẫn với một
  Non-Goal là **cuộc nói chuyện về scope**, không phải cuộc nói chuyện về thiết kế.
- Xung đột với overview → cập nhật overview qua PR có review, **không** tự suy diễn
  trong spec của feature.

### `erd.md` — sync TAY

Nguồn đúng của data model. Sync thủ công với `server/prisma/schema.prisma`:

- Code mới hơn ERD → cập nhật ERD **trong cùng commit**.
- ERD mới hơn code → đó là spec chưa hiện thực, **flag lúc `writing-plans`**. Phần chưa
  có trong schema được đánh 📝.
- Thiết kế data model thì đọc ERD trước; thiếu field/bảng → viết ADR ở
  [`decisions/`](../decisions/README.md), đừng chỉ ghi trong design doc.

### `decisions/` — ADR

Append-only. ADR đã `accepted` thì **không sửa nội dung**: đổi ý thì viết ADR mới, ghi
`supersedes ADR-NNNN`, và đổi ADR cũ sang `superseded by`. Ghi **ngay lúc chốt**, không
để cuối phiên.

## 2. Tầng 2 — `specs/<feature>/`

Toàn bộ tài liệu của một feature nằm trong đúng một thư mục: `design.md` (từ
`brainstorming`) + `plan.md` (từ `writing-plans`, **có checkbox**).

- `design.md` mở đầu bằng dòng `Liên quan: FR-07 · NFR-PERF-01 · ADR-0004` —
  **tham chiếu ID**, không chép nội dung tầng 1 sang.
- Checkbox trong `plan.md` là hàng phòng thủ khi context bị nén: đọc lại là biết đang ở
  task 7/12. Văn xuôi không làm được việc đó.
- Thư mục này **không tạo sẵn** — skill `feature-flow` tạo khi cần.

## 3. Đã đóng băng — 2026-09-03

Giữ để đọc lại, **không sinh thêm, không đọc như nguồn đúng**:

| Đường dẫn | Vì sao còn ở đây |
| --- | --- |
| `ui-designs/<feature>/*.html` | Mock SuperDesign của các feature đã ship. Flow mới dựng mockup bằng skill `design` nội trú và **không lưu mock trong repo** |
| `.superdesign/` | Config strict-theme của SuperDesign. Token đã chuyển vào `design-system/match-cv/MASTER.md` |
| `project-goals.md` · `unfinished-features.md` | Chỉ còn là **stub chuyển hướng**, giữ cho ~20 liên kết cũ trong `specs/` không gãy |

Tài liệu trong `specs/` có ghi ngày là **hồ sơ lịch sử**: chúng vẫn trỏ tới
`project-goals.md §x` và tới `ui-designs/`, và **giữ nguyên như đã viết**. Gặp một
tài liệu mô tả sản phẩm này thành bốn git repo thì đó là bản cũ —
xem [ADR-0018](../decisions/0018-mot-git-repo-cho-ca-san-pham.md).
