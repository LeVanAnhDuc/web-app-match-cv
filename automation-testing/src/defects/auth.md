# AUTH — Bug log

Không có `## Gom từ …` nào cho auth lúc scaffold (không có `docs/specs/*/e2e-bugs.md` của auth); hai bug dưới đây
tìm thấy khi khám phá app ngày 2026-10-14.

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-AUTH-01](#bug-auth-01) | Trung bình | TC-AUTH-052 | `/auth/me` lỗi mạng → route cần tài khoản kẹt skeleton mãi, không về giao diện khách |
| [BUG-AUTH-02](#bug-auth-02) | Thấp | TC-AUTH-053 | Cookie `mcv_session` không giải mã được (`%%%`) không bị server xoá |

### BUG-AUTH-01

- **TC:** TC-AUTH-052 · **Requirement:** REQ-AUTH-18
- **Bước tái hiện:** trình duyệt không có phiên; chặn (abort) mọi request `GET <API>/auth/me`; mở `/cv`; chờ 40 giây.
- **Mong đợi:** sau khi React Query hết lượt thử lại (≈7 s), `useAuth` coi như anonymous → màn mời đăng nhập
  "Sign in to see your saved CVs" hiện, skeleton biến mất (comment của `useAuth`: "A failed request degrades to anonymous
  so the app shows the guest view, not a skeleton").
- **Thực tế:** skeleton (`aria-busy="true"`) ở lại suốt 40 giây, không lúc nào hiện màn gate; `/auth/me` bị gọi lại liên
  tục theo chu kỳ 0.7 s, 1.7 s, 3.7 s, 7.7 s, rồi lặp lại (≈19 lần trong 40 s). Nguyên nhân khả dĩ: khi query lỗi, shell
  chuyển sang giao diện khách và mount thêm observer `useAuth` (GuestCard / nút Sign in) → refetch on mount; query chưa
  từng có data nên quay về `pending` → `status` lại là `"loading"`.

### BUG-AUTH-02

- **TC:** TC-AUTH-053 · **Requirement:** REQ-AUTH-14
- **Bước tái hiện:** `curl -i http://localhost:5200/api/v1/auth/me -H "Cookie: mcv_session=%%%"`
- **Mong đợi:** `status:"anonymous"` và `Set-Cookie: mcv_session=; …Expires=Thu, 01 Jan 1970…` (cookie bị sửa → server ra
  lệnh xoá, như với token lạ / hết hạn).
- **Thực tế:** `status:"anonymous"` nhưng không có `Set-Cookie` — `readCookie` nuốt lỗi `decodeURIComponent` và trả `null`,
  nên `SessionMiddleware` coi như không có cookie và không xoá; trình duyệt giữ cookie hỏng mãi.

## Đã sửa

_(chưa có)_
