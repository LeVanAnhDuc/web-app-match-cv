# fixtures/

**Trả lời câu hỏi:** test **nhận sẵn** những gì khi bắt đầu?

Fixture là công thức Playwright tự gọi khi test ghi tên nó trong `async ({ ... })`: chuẩn bị trước test, đưa giá trị
qua `use(...)`, dọn dẹp sau test (code sau `await use(...)`). Giống `@Bean` + inject + `@PreDestroy`, scope theo từng test.
`.extend` chỉ ghi thêm công thức; giá trị chỉ được tạo khi test xin, mỗi test một bản, mỗi thứ một lần.

```
@playwright/test ─.extend─► core.fixture.ts ─.extend─► accounts.fixture.ts ─┐
                                            ─.extend─► pages.fixture.ts ────┼─ mergeTests ─► index.ts ─► spec
                                            ─.extend─► <concern>.fixture.ts ┘
```

| File | Đưa cho test |
|---|---|
| `core.fixture.ts` | `env` (scope worker), `urls`, `guard` (`auto: true`: mọi test chạy qua, chặn `@creates-data` trên prd) |
| `accounts.fixture.ts` | `account` |
| `pages.fixture.ts` | page object, mỗi trang một fixture |
| `http.fixture.ts` | `http(cookie?)` (scope worker, dùng được trong `beforeAll`): client HTTP chung của `api/http.client.ts` |
| `index.ts` | gộp tất cả bằng `mergeTests`, export `test`, `expect` |

## Quy tắc

- Một file một mối quan tâm, tên `<concern>.fixture.ts`, kế thừa `core` (hoặc fixture nó thật sự cần, vd `api`
  kế thừa `gates`). Xong thì thêm vào `mergeTests` trong `index.ts`, biến import đặt tên `<concern>Test`.
- Spec **chỉ** import `test`, `expect` từ `@/fixtures`, không import file fixture lẻ.
- Fixture mở tài nguyên bên ngoài (hộp thư trên server, kết nối HTTP mới, file) **phải dọn** sau `use(...)`.
  Dọn lỗi thì nuốt lỗi (`.catch(() => undefined)`), đừng để teardown che kết quả test.
- Test cần chọn biến thể lúc chạy (vd tài khoản theo trạng thái) → fixture đưa ra **hàm** (factory): `roleAccount("MFA")`.
- Thiếu dữ liệu tùy chọn (chưa provision) → `test.skip(...)` kèm lệnh cần chạy. Thiếu cấu hình bắt buộc → ném lỗi.
- Giá trị không đổi suốt lượt chạy → `{ scope: "worker" }` và khai báo ở tham số kiểu thứ hai của `extend<Test, Worker>`.
- Không override fixture gốc của Playwright (`page`, `request`…): người đọc phải tin `page` là `page` chuẩn.
- Fixture chỉ **một file spec** dùng thì khai báo cục bộ trong spec (`test.extend` đầu file), không đưa vào đây.

Mẫu fixture `api` / `newApi`, `session` (đã đăng nhập sẵn), `inbox` (mail.tm), `loginGate`:
`D:\quapp-project\automation-testing\quapp-functions\fixtures\`.
