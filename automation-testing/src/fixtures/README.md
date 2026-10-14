# fixtures/

**Trả lời câu hỏi:** test **nhận sẵn** những gì khi bắt đầu?

Fixture là công thức Playwright tự gọi khi test ghi tên nó trong `async ({ ... })`: chuẩn bị trước test, đưa giá trị
qua `use(...)`, dọn dẹp sau test (code sau `await use(...)`). `.extend` chỉ ghi thêm công thức; giá trị chỉ được tạo
khi test xin, mỗi test một bản (hoặc mỗi worker một bản với `scope: "worker"`).

```
@playwright/test ─► core ─┬─► accounts ─┐
                          ├─► pages ────┤
                          ├─► http ─► api ─┼─ mergeTests ─► shared.fixture.ts ─┬─► modules/<module>.fixture.ts (×13) ─┐
                          └─► network ──┘                                      └───────────────────────────────────┴─ mergeTests ─► index.ts ─► spec
```

| File | Đưa cho test |
|---|---|
| `core.fixture.ts` | `env` (worker), `urls`, `guard` (auto: chặn `@creates-data` trên prd, `@live-ai` khi thiếu `LIVE_AI=1`) |
| `accounts.fixture.ts` | `account` (tài khoản `<ENV>_USER_*` trong `.env`) |
| `pages.fixture.ts` | `shell` — `AppShell` (sidebar, header, drawer mobile, account menu, guest card) |
| `http.fixture.ts` | `http(cookie?)` (worker): factory HTTP thô của `api/http.client.ts`, spec gom từ `server/test/` đang dùng |
| `api.fixture.ts` | (worker, dùng được trong `beforeAll`) `api` — client typed, đăng nhập là user e2e đã seed (cookie đọc lười từ `.auth/user.json` lúc request đầu); `anonApi` — ẩn danh; `apiAs(identity)` — user khác (`SeededUser`, cookie, mảng cookie) |
| `network.fixture.ts` | `network` trên `page`: `stubJson(url, body, { status, delayMs, method, times, headers })`, `stubOnce`, `failWith(url, status, { body })`, `abort(url)`, `recordRequests(url, { method })` → mảng `RecordedRequest` tự đầy, `clear()` |
| `shared.fixture.ts` | gộp mọi fixture dùng chung ở trên — base của mọi slot module |
| `modules/<module>.fixture.ts` | slot riêng của từng module (13 module), **chỉ** agent/người viết module đó sửa |
| `index.ts` | `mergeTests(shared, …13 slot)`, export `test`, `expect` |

## Slot module

`cv-jd-matching-wizard`, `documents`, `home-dashboard-library`, `ui-consistency-shell`, `ai-credentials`,
`multi-provider-compare`, `cv-rewrite-assistant`, `cover-letter-generator`, `cv-version-comparison`, `data-export`,
`auth`, `guest-mode`, `infra`. Mỗi file là `shared.extend<{ … }>({ … })`, đã nằm trong `index.ts`:

```ts
// fixtures/modules/cv-jd-matching-wizard.fixture.ts
import { WizardPage } from "@/pages/wizard/wizard.page";
import { test as shared } from "../shared.fixture";
export const test = shared.extend<{ wizardPage: WizardPage }>({
  wizardPage: async ({ page }, use) => use(new WizardPage(page)),
});
```

- **Tên fixture phải duy nhất giữa mọi module** (mergeTests gộp vào một `test`; hai slot cùng tên là lỗi lúc chạy).
  Tên chung chung (`seeded`, `stubs`) → thêm tiền tố module (`wizardSeed`, `coverLetterStubs`).
- Page object của một module đăng ký ở slot đó, không ở `pages.fixture.ts` (chỉ giữ UI dùng chung).

## AI stub (D1)

UI spec stub mọi endpoint gọi AI bằng `network` (đường dẫn glob trên **toàn URL**, giống `page.route`):

```ts
await network.stubJson("**/api/v1/match", matchResult, { method: "POST" });   // GET /match vẫn đi backend thật
await network.failWith("**/api/v1/cover-letters", 429, { method: "POST" });
const sent = network.recordRequests("**/api/v1/match", { method: "POST" });  // sent[0].body.cvDocumentId
```

Endpoint gọi AI: `POST /match`, `POST /ai-credentials/:id/test`, `POST /cover-letters`, `POST /cv-rewrite`.
Body stub đặt ở `data/test-data/<module>.ts`, type từ `#/types/*`.

## Quy tắc

- Spec **chỉ** import `test`, `expect` từ `@/fixtures`, không import file fixture lẻ.
- Fixture mở tài nguyên bên ngoài **phải dọn** sau `use(...)`; dọn lỗi thì nuốt lỗi (`.catch(() => undefined)`).
- Test cần chọn biến thể lúc chạy → fixture đưa ra **hàm** (factory), như `apiAs(identity)`.
- Thiếu dữ liệu tùy chọn → `test.skip(...)` kèm lệnh cần chạy. Thiếu cấu hình bắt buộc → ném lỗi.
- Giá trị không đổi suốt lượt chạy → `{ scope: "worker" }` và khai báo ở tham số kiểu thứ hai của `extend<Test, Worker>`.
- Không override fixture gốc của Playwright (`page`, `request`…).
- Fixture chỉ **một file spec** dùng → `test.extend` cục bộ đầu file, không đưa vào slot.
