# ADR-0012 · Bỏ job-board: không đăng job, không luồng ứng tuyển

> **Ngày:** 2026-08-08
> **Trạng thái:** accepted
> **Liên quan:** FR-20 (bỏ)

## 1. Bối cảnh

Roadmap ban đầu có "Recruiter đăng Job + candidate list/search" và "Apply flow" như
hai mục **sẽ làm sau**. Sau vài feature, giá trị thật của sản phẩm lộ ra nằm ở chất
lượng chấm và ở nội dung sinh từ kết quả chấm — không ở chỗ nối cung với cầu, thứ mà
thị trường đã thừa.

## 2. Quyết định

**Loại hẳn khỏi roadmap** (không phải hoãn): đăng tin công khai, list/search/filter
tin, luồng ứng tuyển, messaging và notification giữa hai bên. Chuyển sang Non-Goals.
JD chỉ tồn tại như một `Document` để đem đi chấm.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ ở cuối roadmap ("làm sau") | Một mục "làm sau" vẫn kéo theo model `Job`, trạng thái ứng tuyển, notification vào mọi quyết định thiết kế trước đó |

## 4. Hệ quả

**Được:**
- **Không cần model `Job`**, không cần trạng thái ứng tuyển, không cần messaging.
- Scope gói gọn quanh `Document` + `MatchResult`, nên mỗi feature mới rẻ hơn.

**Mất / phải chấp nhận:**
- Sản phẩm không tự sinh ra JD; user phải mang JD từ nơi khác tới.
- Bỏ luôn một hướng doanh thu hiển nhiên.

**Điều kiện xem lại quyết định này:** khi có bằng chứng người dùng thật cần chỗ đăng
tin ngay trong app — và lúc đó là một sản phẩm khác, không phải một feature.
