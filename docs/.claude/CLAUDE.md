# Rules — docs/

Folder `docs/` chứa 4 nhóm tài liệu source-of-truth:

## 1. `project-goals.md` — Định vị + scope

- Single source of truth về Identity/Vision/Goals/Non-Goals của dự án
- Mọi feature mới phải đối chiếu `## 4. Goals` và `## 5. Non-Goals` **trước khi** vào `superpowers:brainstorming`
- Xung đột với goals → cập nhật `project-goals.md` qua PR có review của owner. KHÔNG tự suy diễn trong feature spec
- Đọc file này khi feature liên quan đến định vị / scope / non-goals (giai đoạn `brainstorming`)
- **TBD**: goal/scope sản phẩm chưa chốt — điền khi brainstorm feature đầu tiên

## 2. `erd.md` — Data model

- `erd.md` — schema data model chính của dự án
- Source-of-truth: file ERD. Sync **TAY** với model code của tech đã chọn (khi có `server/` + chốt tech DB)
- Drift giữa ERD và entity code:
  - Code mới hơn ERD → developer update ERD trong cùng commit/PR
  - ERD mới hơn code → là spec chưa implement → flag trong `writing-plans`
- Khi thiết kế data model (giai đoạn `brainstorming` / `writing-plans`) đọc ERD trước. Phát hiện thiếu field/collection → đề xuất update ERD qua Decision Record (DR) trong design doc / plan
- **TBD**: data model + tech DB chưa chốt

## 3. `ui-designs/` — Thiết kế UX (SuperDesign HTML)

- Mock UI dạng **HTML** sinh bởi SuperDesign, đặt ở `ui-designs/<feature-name>/*.html` (folder per-feature)
- Là output của **step 1.5** (root `.claude/CLAUDE.md` §5) khi feature thêm UI mới / sửa lớn UI; luôn có cả light + dark
- Config strict-theme dùng chung ở `docs/.superdesign/` (`design-system.md` + `replica_html_template/`)
- Source-of-truth cho UI/UX của feature FE. Khi code `client/src/**` đụng màn hình tương ứng → đối chiếu design ở đây trước
- Drift giữa design và code FE → flag trong `brainstorming` / `requesting-code-review`, không tự suy diễn layout

## 4. `specs/` — Tài liệu feature (per-feature)

- `specs/<feature-name>/` chứa toàn bộ tài liệu 1 feature: `design.md` (brainstorm) + `plan.md` + `security-report.md` (khi cần) + `e2e.md` (khi có E2E) + `e2e-bugs.md` (khi dual-gate fail)
- Source-of-truth cho scope/flow từng feature; mọi feature mới tạo folder ở đây
- Chi tiết lifecycle artifact xem root `.claude/CLAUDE.md` §1, §5, §6.2
