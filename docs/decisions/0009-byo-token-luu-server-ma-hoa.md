# ADR-0009 · Token AI của user lưu server-side, mã hoá AES-256-GCM

> **Ngày:** 2026-08-06
> **Trạng thái:** accepted
> **Liên quan:** FR-09 · NFR-SEC-08 · NFR-SEC-09 · NFR-SEC-10 · invariant #17

## 1. Bối cảnh

Yêu cầu của FR-09 là user **lưu** khoá để dùng lại, chứ không phải dán lại mỗi lần.
"Lưu lại" nghĩa là dùng được ở phiên sau và ở máy khác — thứ mà lưu phía trình duyệt
không làm được.

## 2. Quyết định

Lưu token ở server, mã hoá at-rest bằng **AES-256-GCM** (`node:crypto`, không thêm
dependency), khoá lấy từ env `CREDENTIAL_ENCRYPTION_KEY`. API **write-only**: response
chỉ có provider, nhãn, `••••1234`, và trạng thái test lần cuối.

**Precondition cứng**: chỉ chạy local / một người dùng. **Không deploy public trước
khi Auth/SSO xong** — vì mock user dùng chung nghĩa là mọi caller đọc được cùng
credential.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Lưu ở `localStorage` / phía client | Không dùng lại được cross-device, và vẫn phải gửi lên server mỗi lần chạy |
| Nhập lại khoá mỗi lần chạy | Mâu thuẫn thẳng với yêu cầu "lưu để dùng sau" |
| Không mã hoá, chỉ dựa vào quyền truy cập DB | Secret bậc cao nhất của app nằm plaintext cạnh dữ liệu thường |

## 4. Hệ quả

**Được:**
- Khoá dùng lại được ở phiên sau và máy khác.
- Rò DB không đồng nghĩa rò khoá, miễn `CREDENTIAL_ENCRYPTION_KEY` không nằm cùng chỗ.

**Mất / phải chấp nhận:**
- App **bị khoá không cho deploy public** cho tới khi FR-18 xong. Đây là ràng buộc sản
  phẩm, không phải ghi chú kỹ thuật.
- Mất `CREDENTIAL_ENCRYPTION_KEY` là mất toàn bộ credential đã lưu.

**Điều kiện xem lại quyết định này:** khi FR-18 xong — lúc đó precondition được gỡ và
mô hình sở hữu khoá cần đọc lại.
