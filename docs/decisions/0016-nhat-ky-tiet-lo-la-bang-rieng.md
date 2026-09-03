# ADR-0016 · Nhật ký tiết lộ dữ liệu là bảng riêng, ghi trước call AI, fail-closed

> **Ngày:** 2026-08-08
> **Trạng thái:** accepted
> **Liên quan:** FR-17 · invariant #18

## 1. Bối cảnh

FR-17 phải trả lời được: *"CV này đã gửi ra ngoài mấy lần, cho ai, lúc nào."* Câu hỏi
đặt ra là có suy được câu trả lời từ `MatchResult` không, thay vì thêm một bảng.

## 2. Quyết định

Bảng **riêng** `DataDisclosure`, ghi **trước** mỗi call AI: `documentId`, `provider`,
`purpose` (embed | chat), `sentAt`, `outcome` (ok | failed). Hai ràng buộc cứng:

- **Fail-closed** — ghi nhật ký không thành công thì **không gọi AI**.
- Nhật ký **không chứa nội dung tài liệu, không chứa khoá** — chỉ con trỏ + metadata.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Suy từ `MatchResult` | Lần match **lỗi** không tạo row ở đó — nhưng đó lại đúng là lần dữ liệu **đã rời hệ thống** rồi mới lỗi. Suy từ `MatchResult` bỏ sót đúng ca đáng lo nhất |
| Thêm cột vào `MatchResult` | Hai thứ khác ngữ nghĩa: kết quả nghiệp vụ ≠ sự kiện tiết lộ dữ liệu |
| Ghi nhật ký **sau** khi call xong | Call xong mới ghi thì lần crash giữa chừng không để lại dấu vết nào |
| Fail-open (ghi hỏng vẫn gọi) | Biến nhật ký thành thứ trang trí: đúng lúc nó hỏng là lúc nó cần nhất |

## 4. Hệ quả

**Được:**

- Bảng riêng khiến FR-17 **độc lập** với FR-10 và với mọi feature gọi AI về sau.
- Ghi trước + fail-closed nghĩa là không có đường nào để dữ liệu rời hệ thống mà không
  có dòng nhật ký.

**Mất / phải chấp nhận:**

- Thêm một lượt ghi DB trước **mỗi** call AI — với N provider là N lượt.
- Nhật ký hỏng thì user không chạy được match. Đây là đánh đổi **có chủ ý**.

**Điều kiện xem lại quyết định này:** nếu chi phí ghi trước làm chậm rõ rệt lần chạy
nhiều provider.
