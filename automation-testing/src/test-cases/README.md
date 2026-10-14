# test-cases/

**Kiểm thế nào.** Một file mỗi module: `<module>.md`.

```md
### TC-SIGNIN-007 — email chưa đăng ký hiện thông báo và đóng được bằng OK

- **Requirement:** REQ-SIGNIN-04
- **Layer:** e2e · **Priority:** P1 · **Tags:** @smoke
- **Tiền điều kiện:** email ngẫu nhiên chưa đăng ký
- **Bước:** nhập email → `Continue` → bấm `OK` trên thông báo
- **Mong đợi:** thông báo `User <email> does not exist` có nút `OK`, vẫn ở `/sign-in`
- **Kiểm chứng thêm:** response 404 `US0002`
- **Automated:** `tests/e2e/sign-in/email-step.e2e.ts`
```

- Mã `TC-<MODULE>-NNN` cố định. Tiêu đề TC = **tên test** trong spec.
- `Automated`: đường dẫn tính từ `src/`, hoặc `manual — <lý do>`. Spec đó phải có test gắn tag `@TC-<MODULE>-NNN`.
- **Priority:** P0 = hỏng là chặn người dùng hoặc rò dữ liệu (gắn `@smoke`), P1 = luồng phụ quan trọng, P2 = biên hiếm.
- **Layer:** `api` cho tổ hợp input / biên / bảo mật / rate limit; `e2e` cho luồng người dùng thật. Không lặp tổ hợp đã phủ ở API.
