# ADR-0015 · Lineage giữa các phiên bản CV bằng `parentId` self-FK

> **Ngày:** 2026-08-08
> **Trạng thái:** accepted
> **Liên quan:** FR-12 · FR-14 · invariant #14 · invariant #15

## 1. Bối cảnh

FR-14 muốn trả lời "CV của bạn đã tốt lên bao nhiêu". Muốn vậy hệ thống phải biết
**bản nào cải tiến từ bản nào** — thông tin mà bản thân hai `Document` không mang.

## 2. Quyết định

Thêm `Document.parentId` — self-FK nullable, `ON DELETE SET NULL`. CV rewrite tự gán
parent; bản upload thủ công khai báo qua `PATCH /documents/:id/parent` (từ chối tự
trỏ mình, khác `kind`, hoặc tạo vòng). Số phiên bản **suy từ chuỗi `parentId`**, walk
cap 20, không thêm cột.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Version hoá tại chỗ (ghi đè, giữ lịch sử trong cùng row) | Trái [ADR-0013](0013-noi-dung-ai-sinh-grounded-user-duyet.md): bản mới **luôn là row mới** |
| Cho user tự chọn hai kết quả bất kỳ để so | Hệ thống không biết bản nào cải tiến từ bản nào, nên không tự nói được "CV của bạn đã tốt lên" |
| Lưu cột `version` | State nhân bản, drift ngay ở ca đầu: `ON DELETE SET NULL` biến v2 thành gốc mới, cột đã lưu vẫn nói "2" |
| `ON DELETE CASCADE` | Xoá bản gốc kéo mất luôn bản cải tiến |

## 4. Hệ quả

**Được:**

- FR-14 chạy được **độc lập với FR-12**: user tự sửa tay rồi khai lineage là đủ.
- Lineage chỉ là một liên kết, không phải một cơ chế version hoá.

**Mất / phải chấp nhận:**

- Chuỗi phải walk mỗi lần hiển thị số phiên bản (đã có `@@index([parentId])`, cap 20).
- Xoá bản gốc làm bản con thành gốc mới, và số phiên bản đổi theo — đúng ý, nhưng
  người dùng có thể thấy lạ.

**Điều kiện xem lại quyết định này:** nếu chuỗi phiên bản dài tới mức cap 20 chạm trần.
