# docs/requirements/

**Điều phải chứng minh.** Một file mỗi module: `<module>.md` (vd `sign-in.md`).

```md
# SIGNIN — Đăng nhập, phiên, logout

- **REQ-SIGNIN-01** Email đã đăng ký chuyển sang bước nhập mật khẩu.
- **REQ-SIGNIN-02** …
```

- Tiêu đề `# <MODULE> — <tên>`; `<MODULE>` = module viết HOA bỏ gạch.
- Mỗi requirement một dòng `- **REQ-<MODULE>-NN** <điều phải đúng>`. Mã **cố định**, không đánh số lại.
- Viết điều **nên** đúng (theo ticket / quyết định), không phải điều app **đang** làm.
- Mỗi REQ phải có ít nhất một TC (`pnpm coverage:check` kiểm).
