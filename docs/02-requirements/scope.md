# Danh mục chức năng

> **Trả lời:** Hệ thống có những chức năng nào, mỗi cái đang ở trạng thái gì?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** brainstorm ra chức năng mới (cấp FR mới) · một FR chuyển trạng thái

<!-- CÁCH ĐIỀN
Chỉ LIỆT KÊ. Một dòng một chức năng, tên ngắn. Cách làm thuộc tài liệu thiết kế
của feature, không thuộc đây.

ID cấp tăng dần, không tái dùng, không xoá. Bỏ một chức năng thì đổi trạng thái
thành (bỏ) và giữ số.

Trạng thái: chưa · đang · xong · (bỏ)

KHÔNG chứa: cách hiện thực, ngưỡng phi chức năng (-> nfr.md), lý do chọn giải pháp
(-> decisions/).
-->

| ID | Chức năng | Thuộc luồng | Trạng thái |
| --- | --- | --- | --- |
| FR-01 | Nạp CV/JD bằng PDF · DOCX · dán text, parse ra văn bản | US-01 | xong |
| FR-02 | Lưu tài liệu để tái dùng, cô lập theo user | US-01 · US-02 | xong |
| FR-03 | Wizard 4 bước JD → CV → Review (read-only) → Kết quả | US-01 | xong |
| FR-04 | Chấm hybrid: `0.6 × semantic + 0.4 × keyword`, LLM không tham gia chấm điểm | US-01 | xong |
| FR-05 | Báo cáo: điểm tổng, breakdown, điểm mạnh, điểm thiếu, gợi ý sửa | US-01 | xong |
| FR-06 | App shell + trang chủ (hero CTA, thẻ thống kê, kết quả gần đây) | US-02 · US-07 | xong |
| FR-07 | Thư viện tài liệu `/cv` + `/jd`: đổi tên, xoá (chặn 409 khi đang dùng), tải bản gốc, xem trước | US-02 | xong |
| FR-08 | Lịch sử match | US-07 | đang — API `GET /match` + `GET /match/:id` xong; FE mới có widget, thiếu trang riêng, lọc, sắp xếp, và `DELETE /match/:id` |
| FR-09 | Quản lý khoá AI của user: CRUD, nhãn, thử kết nối, hiển thị masked | US-03 | xong |
| FR-10 | Chạy nhiều provider một lần: gom theo `MatchRun`, hiện dần, chấp nhận lỗi từng phần | US-03 | xong |
| FR-11 | Chấm đúng tài liệu tiếng Việt: tokenizer Unicode-aware, stopword VI, alias kỹ thuật, script tính lại điểm cũ | US-01 | xong |
| FR-12 | CV rewrite: thay đổi có neo, duyệt từng cái, lưu thành `Document` mới | US-04 | xong |
| FR-13 | Sinh thư ứng tuyển: độ dài · giọng văn · ngôn ngữ, sửa tại chỗ, lưu mỗi lần sinh | US-05 | xong |
| FR-14 | So sánh hai phiên bản CV trên một JD: lineage `parentId`, delta có dấu, ghép gap | US-06 | xong |
| FR-15 | Export toàn bộ dữ liệu của user (JSON + file gốc, khoá AI dạng masked) | US-08 | xong — `GET /me/export` + trang `/my-data` |
| FR-16 | Xoá sạch dữ liệu của user, xác nhận hai bước | US-08 | chưa |
| FR-17 | Nhật ký tiết lộ dữ liệu: ghi trước mỗi call AI, fail-closed | US-08 | chưa |
| FR-18 | Auth / SSO qua `web-app-ducker-id` | — | chưa |
| FR-19 | Batch ranking nhiều CV cho một JD | — | chưa |
| FR-20 | Recruiter đăng job / list / search / apply flow | — | (bỏ) — [ADR-0012](../decisions/0012-bo-job-board.md) |

## Thứ tự còn lại

FR-16 và FR-17 là hai phần còn lại của chủ quyền dữ liệu (FR-15 đã xong) và xếp
trước FR-18. FR-19 phải chờ pgvector + hàng đợi nền, xem
[ADR-0017](../decisions/0017-semantic-khong-pgvector-o-mvp.md).
