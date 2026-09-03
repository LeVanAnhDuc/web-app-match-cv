# ADR-0006 · Hoãn auth, chạy bằng mock user, schema SSO-ready

> **Ngày:** 2026-07-14
> **Trạng thái:** accepted
> **Liên quan:** FR-18 · ADR-0008 · ADR-0009

## 1. Bối cảnh

Kế hoạch dài hạn là đăng nhập qua Ducker ID (IdP trung tâm của hệ sinh thái). Nhưng
Ducker ID lúc đó **chưa tồn tại** — phải xây từ đầu. Chờ nó xong nghĩa là không làm gì
được trong nhiều tuần.

## 2. Quyết định

Không xây auth trong MVP. App chạy bằng một **mock user**, nhưng **mọi dữ liệu key
theo `userId` ngay từ đầu**, để khi SSO về không phải đổi schema. Nguồn `userId` duy
nhất là `CurrentUserService.getUserId()`.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Xây auth cục bộ (email + mật khẩu) rồi bỏ đi khi SSO về | Làm hai lần, và phải xoá một hệ thống có dữ liệu thật |
| Chờ Ducker ID xong | Chặn toàn bộ sản phẩm sau một sản phẩm chưa bắt đầu |
| Không có khái niệm user, dữ liệu dùng chung | Cô lập dữ liệu (NFR-DATA-04) là yêu cầu sản phẩm, không phải phần thêm sau |

## 4. Hệ quả

**Được:**
- Mọi luồng nghiệp vụ viết đúng một lần; khi Auth về chỉ đổi phần thân của một hàm.

**Mất / phải chấp nhận:**
- Lỗ hổng phân quyền (không đối chiếu `userId`) **không lộ ra** khi chỉ có một user —
  và sẽ lộ đúng lúc Auth về. Vì thế nó là invariant #4, không phải một dòng lint.
- App không được deploy public trước khi Auth xong ([ADR-0009](0009-byo-token-luu-server-ma-hoa.md)).

**Điều kiện xem lại quyết định này:** khi Ducker ID có `/oauth/authorize` + JWKS chạy được.
