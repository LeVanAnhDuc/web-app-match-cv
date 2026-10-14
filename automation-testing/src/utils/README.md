# utils/

**Trả lời câu hỏi:** tiện ích kỹ thuật nào không biết gì về UI và môi trường?

Hàm thuần hoặc client dịch vụ ngoài, dùng được ở fixture, spec, setup. Mỗi file kèm `*.test.ts` nằm cạnh (`pnpm test:unit`).

| Cần | Chép từ `D:\quapp-project\automation-testing\quapp-functions\utils\` |
|---|---|
| Hộp thư tạm nhận email (OTP, link xác nhận) | `mailtm.ts` + `otp.ts`, kèm fixture `inbox` (`fixtures\mail.fixture.ts`) |
| Mã TOTP cho tài khoản bật MFA | `totp.ts` |
| Không vượt rate limit backend khi chạy song song | `rate-gate.ts` (khóa file trong `.auth/`, dùng chung giữa các worker) + `fixtures\gates.fixture.ts` |
| Ghi giá trị vào `.env` (setup tạo tài khoản) | `env-file.ts` |
| Theo dõi request / response / lỗi console trên page | `browser.ts` |

**Quy tắc:** không import `pages/`, `components/`, `api/`, `fixtures/`; không đọc `.env` (đó là việc của `config/`).
Chỉ thêm khi có test thật sự cần, không chép sẵn "để đó".
