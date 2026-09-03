# Tổng quan sản phẩm

> **Trả lời:** Sản phẩm này là gì, cho ai, và **KHÔNG** làm gì?
> **Trạng thái:** 🟡 một phần — §5 trần chi phí và §6 chỉ số thành công chưa có số thật
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** định vị đổi · thêm/bớt một Non-Goal · trần chi phí đổi

<!-- CÁCH ĐIỀN
File này là nơi DUY NHẤT trả lời "cái này có thuộc phạm vi không". Mọi tranh luận
về scope kết thúc ở đây.

Mục 4 (Non-Goals) là mục quan trọng nhất và là mục dễ bỏ trống nhất. Một Non-Goal
tốt là thứ nghe HỢP LÝ mà vẫn bị từ chối.

KHÔNG chứa: danh sách tính năng (-> 02-requirements/scope.md), ngưỡng kỹ thuật
(-> 02-requirements/nfr.md), thuật ngữ (-> 01-product/glossary.md).
-->

## 1. Một câu định vị

Công cụ chấm độ khớp **CV ↔ JD** cho cả người tìm việc lẫn nhà tuyển dụng, khác các
công cụ sẵn có ở chỗ điểm số đến từ **cơ chế hybrid** (trùng từ vựng + vector ngữ
nghĩa) còn LLM chỉ giải thích, và từ kết quả đó app **sinh tiếp nội dung ứng tuyển**
(CV viết lại, cover letter).

## 2. Vấn đề đang giải

Người tìm việc gửi CV đi mà không biết mình hụt cái gì so với tin tuyển dụng, và
nhận lại im lặng chứ không nhận lại lý do. Nhà tuyển dụng đọc CV bằng mắt, mỗi người
một chuẩn. Cái thiếu không phải là chỗ đăng tin — chỗ đăng tin đã thừa — mà là một
con số **giải thích được** cho câu "CV này khớp JD này tới đâu, và thiếu gì".

## 3. Người dùng mục tiêu

| Nhóm | Hoàn cảnh |
| --- | --- |
| `candidate` (nhóm chính) | Đang ứng tuyển, có sẵn CV, muốn biết hụt gì so với một JD cụ thể và muốn sửa CV theo đó |
| `recruiter` | Có JD, muốn chấm một CV nhận được. **Không** đăng tin, **không** nhận đơn ứng tuyển |
| `admin` | Quản trị hệ thống |

MVP **chưa có auth thật**. App chạy như thể đã đăng nhập bằng một `User` hợp lệ trong
DB (`STUB_USER_ID = 00000000-0000-0000-0000-000000000001`, seed idempotent), lấy qua
`CurrentUserService.getUserId()`. Không có màn login, không có mode khách, không tính
năng nào bị khoá vì chưa auth — xem [ADR-0006](../decisions/0006-defer-auth-mock-user.md)
và [ADR-0008](../decisions/0008-mock-user-la-user-that.md).

## 4. Non-Goals — dứt khoát không làm

- **Marketplace / job-board**: không đăng tin công khai, không list/search/filter tin,
  không luồng ứng tuyển, không messaging hay notification giữa hai bên. Loại khỏi
  roadmap 2026-08-08, không phải "làm sau" — [ADR-0012](../decisions/0012-bo-job-board.md).
  Hệ quả: **không có model `Job`**.
- **Payment / subscription** — sản phẩm không thu tiền ở giai đoạn này.
- **Mobile native app** — chỉ web.
- **Proxy / marketplace AI**: không bán credit, không làm gateway, không cache hay
  relay response của user này cho user khác.
- **Quản lý billing / quota hộ user**: không theo dõi số dư, không cảnh báo hết hạn
  mức. Lỗi provider trả về thì phản ánh lại, thế thôi.
- **Tự chọn provider thay user**: không auto-route "rẻ nhất / nhanh nhất". User chọn
  tường minh; hệ thống chỉ fallback về key hệ thống khi user không có credential nào.
- **Provider không có embeddings API** (Anthropic, hoặc provider embed-only như
  Voyage) — engine hybrid cần cả chat lẫn embed, xem [ADR-0010](../decisions/0010-provider-whitelist-chat-va-embed.md).
- **Tách từ ghép tiếng Việt** (word segmentation): keyword chạy ở cấp âm tiết —
  [ADR-0014](../decisions/0014-keyword-tieng-viet-cap-am-tiet.md).
- **Từ điển VI↔EN cho cặp lệch ngôn ngữ**: vế semantic gánh phần đó, không dựng bảng
  ánh xạ khái niệm và không thêm call AI để dịch.
- **Retention tự động / tự xoá tài liệu sau N ngày**: cần scheduler chạy nền, hạ tầng
  chưa có và app chưa deploy. User tự export và tự xoá.
- **Crawling job từ site ngoài, video interview, ATS integration bên thứ ba.**

## 5. Mô hình

| Câu hỏi | Trả lời |
| --- | --- |
| Ai trả tiền | Không ai — dự án học tập, chạy local |
| Trả bằng gì | — |
| **Trần chi phí hạ tầng / tháng** | 🔴 chưa chốt. Cái đang ràng buộc thật là **cost mỗi lần match**: 3N call AI (2 embed + 1 chat mỗi provider), nên UI phải cho user thấy họ đang chọn mấy provider |

> App **chưa deploy public** và không được deploy trước khi Auth/SSO xong — precondition
> cứng của [ADR-0009](../decisions/0009-byo-token-luu-server-ma-hoa.md): mock user dùng
> chung nghĩa là mọi caller đọc được cùng credential.

## 6. Thế nào là thành công

🔴 chưa có chỉ số đo được. Chưa deploy, chưa có người dùng thật, nên chưa số nào ở đây
là số đã đo. Điền khi có môi trường chạy thật.
