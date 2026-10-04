# ADR-0023 · Chế độ khách là một `User` tạm 24 giờ, quota theo IP, mang vào tài khoản khi đăng nhập

> **Ngày:** 2026-10-04
> **Trạng thái:** accepted
> **Liên quan:** FR-21 · US-09 · NFR-COST-04 · NFR-DATA-04 · ADR-0022 · supersedes ADR-0008

## 1. Bối cảnh

Mock user biến mất cùng FR-18. Người chưa đăng nhập vẫn phải chạy được wizard
JD → CV → Kết quả, bằng key hệ thống, không có tính năng nào khác — và nếu sau đó đăng
nhập thì kết quả vừa chạy **đi theo** vào tài khoản. Engine match hiện đọc tài liệu từ DB
theo `userId`; overview §4 cấm scheduler chạy nền.

## 2. Quyết định

Khách là một **`User` thật** `{ isGuest: true, guestExpiresAt: +24h }`, tạo **lười** ở
lần ghi đầu tiên (`POST /documents`), cầm một `Session` cùng hạn. Endpoint mặc định đòi user
thật; `@AllowGuest()` mở đúng các endpoint của wizard. Khách chỉ chạy trên key hệ thống
(`credentialId` bị cấm) và tốn quota **5 match / IP / ngày UTC** (env), đếm ở bảng
`GuestUsage` theo `HMAC(ip)`, trừ **trước** call AI. Đăng nhập thì **claim** trong một
transaction: chuyển `Document`, `MatchRun`, `MatchResult` sang user thật (tài liệu thành
`isSaved`), rồi xoá user khách. Khách hết hạn được xoá **lười** lúc tạo khách mới và lúc
đăng nhập. Dữ liệu mock user bị xoá; không còn `STUB_USER_ID`.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Khách xử lý trong bộ nhớ, không ghi DB | Không mang vào tài khoản được — mà user đã chọn "có" |
| Bảng/cột tạm riêng cho dữ liệu khách | Nhân đôi mọi query và FK; luồng match phải có hai nhánh |
| Quota theo cookie khách | Xoá cookie hoặc mở ẩn danh là có lượt mới |
| Không quota, chỉ rate limit chung | Key hệ thống là tiền thật của chủ app |
| Job nền dọn khách hết hạn | Overview §4: chưa có hạ tầng scheduler |
| Giữ mock user / thêm `isMock` (ADR-0008) | Không còn vai trò; user chọn xoá sạch |

## 4. Hệ quả

**Được:**
- Toàn bộ luồng match chạy nguyên cho khách; phân quyền theo chủ sở hữu không đổi.
- Claim là `UPDATE … SET user_id` — không copy dữ liệu.

**Mất / phải chấp nhận:**
- `Document.user`, `MatchResult.user` phải thêm `onDelete: Cascade` (migration).
- Dọn lười ⇒ dữ liệu khách hết hạn có thể nằm lâu hơn 24 giờ khi không ai tạo khách mới.
- Nhiều người sau một NAT chia nhau 5 lượt; một người đổi mạng có thêm lượt.

**Điều kiện xem lại quyết định này:** có scheduler nền; hoặc lạm dụng key hệ thống buộc
phải có CAPTCHA / chống bot.
