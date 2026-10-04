# Danh mục chức năng

> **Trả lời:** Hệ thống có những chức năng nào, mỗi cái đang ở trạng thái gì?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-10-04 · commit —
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
| FR-18 | Auth / SSO qua `web-app-ducker-id` (OIDC, session riêng, bỏ mock user) | US-09 | xong — [ADR-0022](../decisions/0022-dang-nhap-bff-session-rieng.md) |
| FR-19 | Batch ranking nhiều CV cho một JD | — | chưa |
| FR-20 | Recruiter đăng job / list / search / apply flow | — | (bỏ) — [ADR-0012](../decisions/0012-bo-job-board.md) |
| FR-21 | Chế độ khách: wizard trên key hệ thống, quota theo IP, dữ liệu sống 24 giờ, mang vào tài khoản khi đăng nhập | US-09 | xong — [ADR-0023](../decisions/0023-che-do-khach-user-tam-24h.md) |

## Thứ tự còn lại

FR-18 + FR-21 xong 2026-10-04 (được kéo lên trước theo user chốt cùng ngày): không có đăng nhập thì app không
deploy public được ([ADR-0009](../decisions/0009-byo-token-luu-server-ma-hoa.md)), và
FR-16 "xoá dữ liệu của user" chỉ có nghĩa khi có user thật. FR-16, FR-17 là hai việc kế tiếp.
FR-19 phải chờ pgvector + hàng đợi nền, xem
[ADR-0017](../decisions/0017-semantic-khong-pgvector-o-mvp.md).
