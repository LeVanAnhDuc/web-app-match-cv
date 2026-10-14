# config/

**Trả lời câu hỏi:** test đang chạy ở môi trường nào, URL nào, bằng tài khoản nào?

| File | Nội dung |
|---|---|
| `env.ts` | `resolveEnv` (đọc `ENV`, mặc định `dev`), `requireVar` (đọc biến `.env`, thiếu thì báo rõ tên) |
| `env-guard.ts` | `buildGrepInvert` (lọc tag theo ENV trong `playwright.config.ts`), `assertAllowed` (chặn `@creates-data` trên prd, lớp 2) |
| `urls.ts` | URL web và URL gốc API theo ENV (hai URL độc lập, lấy từ source app lúc scaffold) |
| `accounts.ts` | Tài khoản test đọc từ `.env` |
| `*.test.ts` | Unit test, chạy bằng `pnpm test:unit` |

**Được đặt ở đây:** mọi thứ phụ thuộc môi trường hoặc `.env` (URL, tài khoản, cờ bật tắt theo ENV).
**Không đặt ở đây:** tiện ích không phụ thuộc ENV (→ `utils/`), hằng số dữ liệu test (→ `data/`).

**Import được:** chỉ file trong `config/` (dùng đường dẫn tương đối `./env`). Không import `pages/`, `components/`,
`api/`, `fixtures/`. `playwright.config.ts` import file ở đây nên chúng phải là hàm thuần, không dùng fixture.

**Tài khoản theo trạng thái** (bị khóa, MFA, mời chưa nhận…): thêm `AccountRole` + `getRoleAccount` vào `accounts.ts`,
tạo tài khoản bằng `tests/setup/*.setup.ts` (`pnpm provision`), fixture `roleAccount` tự skip khi `.env` thiếu.
Mẫu đầy đủ: `D:\quapp-project\automation-testing\quapp-functions\config\accounts.ts`.

**Không ghi secret vào file nào ngoài `.env`.**
