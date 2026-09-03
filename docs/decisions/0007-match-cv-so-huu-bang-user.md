# ADR-0007 · Match CV sở hữu bảng `User` riêng; IdP chỉ cấp claim

> **Ngày:** 2026-08-06
> **Trạng thái:** accepted
> **Liên quan:** FR-18 · ADR-0006

## 1. Bối cảnh

Khi Ducker ID về, có hai cách chia dữ liệu người dùng giữa IdP và app vệ tinh: app
chép bảng credential sang, hoặc app giữ bảng của riêng mình và chỉ nhận claim.

## 2. Quyết định

Ducker ID sở hữu `Authentication` (mật khẩu, roles, verifiedEmail, tokenVersion) và
`OAuthConsent`. Match CV **không copy bảng đó**. Match CV sở hữu bảng `User` riêng,
giữ `externalSub` để nối, cộng một bản mirror profile (`email`, `fullName`, `avatar`,
`phone` — đều nullable) theo đúng scope đã consent, cộng toàn bộ dữ liệu nghiệp vụ.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Copy bảng credential sang app vệ tinh | Nhân bản secret ra nhiều nơi; và mỗi app lại thành một chỗ đổi mật khẩu |
| Không có bảng `User` ở app, chỉ đọc claim từ token | Mọi FK nghiệp vụ mất chỗ neo; không xoá dữ liệu theo user được |

## 4. Hệ quả

**Được:**
- Ranh giới rõ: IdP giữ *ai được vào*, app giữ *người đó có gì*.
- App chạy được trước khi IdP tồn tại (ADR-0006).

**Mất / phải chấp nhận:**
- Profile là **bản sao**, nên sẽ lệch với IdP giữa hai lần đồng bộ.
- Các cột mirror hiện **chưa có trong schema** — nợ #2 ở `04-state/backlog.md`.

**Điều kiện xem lại quyết định này:** nếu hệ sinh thái chuyển sang một bảng user dùng chung.
