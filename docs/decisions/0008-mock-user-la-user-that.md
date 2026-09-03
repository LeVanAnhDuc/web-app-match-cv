# ADR-0008 · Mock user là một `User` thật trong DB, có cờ `isMock`

> **Ngày:** 2026-08-06
> **Trạng thái:** accepted
> **Liên quan:** FR-18 · ADR-0006 · ADR-0007

## 1. Bối cảnh

Bản đầu dùng khái niệm "stub user": một id hằng số **không tồn tại trong DB**. Hệ quả
là mọi `Document`, `MatchResult` đều trỏ tới một user không có thật.

## 2. Quyết định

Mock user là một **`User` hợp lệ trong DB**, seed idempotent tại
`STUB_USER_ID = 00000000-0000-0000-0000-000000000001`, mang cờ `isMock`. App hành xử
**như đã đăng nhập bằng user này**: không có màn login, không có mode khách, không
tính năng nào bị khoá hay giảm chức năng vì chưa auth.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Id ảo ngoài DB ("stub") | FK không toàn vẹn; và mỗi lần thêm bảng lại phải nhớ nới lỏng FK |
| Tắt FK ở môi trường dev | Dev và production khác nhau ở đúng chỗ hay hỏng nhất |

## 4. Hệ quả

**Được:**
- FK toàn vẹn, không có ca "user không tồn tại".
- Clean data về sau là một câu: `DELETE FROM users WHERE is_mock = true` (cascade).
- Khi Auth về chỉ đổi nguồn `userId`, không viết lại luồng nghiệp vụ nào.

**Mất / phải chấp nhận:**
- Cột `isMock` **vẫn chưa có trong `schema.prisma`**, nên câu clean data ở trên chưa
  dùng được — hiện phải xoá theo id hằng số. Nợ #2 ở `04-state/backlog.md`.

**Điều kiện xem lại quyết định này:** khi FR-18 xong và mock user hết vai trò.
