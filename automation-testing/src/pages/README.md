# pages/

**Trả lời câu hỏi:** trên màn hình này, phần tử nằm ở đâu và người dùng làm được gì?

```
pages/
├── base.page.ts            BasePage: shell (AppShell), lng, waitForAppReady(), setLanguage(lng)
└── <area>/<name>.page.ts   vd wizard/wizard.page.ts → class WizardPage extends BasePage
```

## `BasePage`

| Thành viên | Làm gì |
|---|---|
| `shell` | `AppShell` của tab này (sidebar, header, drawer, account menu) |
| `waitForAppReady()` | Chờ `window.__i18n` (bundle client đã chạy = đã hydrate) rồi `<main>` hiện. Gọi trong `goto()` sau `page.goto` |
| `setLanguage(lng)` | Đổi ngôn ngữ UI qua dev hook `window.__i18n.changeLanguage` (app không có nút đổi ngôn ngữ — D4), chờ đổi xong, ghi lại cho mọi page object/component của tab. **Không lưu qua reload**: gọi sau `goto()` |
| `lng` | Ngôn ngữ hiện tại của tab (`en` tới khi gọi `setLanguage`) |

## Quy tắc

- Một class mỗi trang: `<Name>Page` trong `kebab-case.page.ts`, kế thừa `BasePage`, constructor nhận `Page`.
- Locator là **method trả `Locator`** (lazy). Label lấy bằng `t(key, this.lng)` từ `@/data/copy`, không viết chuỗi.
- Hành động người dùng là method: `goto()` (đường dẫn tương đối + `waitForAppReady()`), `submit()`…
- **Không assertion nghiệp vụ.** Được chờ trạng thái sẵn sàng của chính nó: heading hiện trong `goto()`,
  `waitForURL` / `waitForResponse` sau submit.
- Selector ưu tiên `getByRole` / `getByLabel` / `getByText`. Không dùng CSS class của thư viện UI (antd `.ant-*`).
- Dialog/modal chỉ thuộc một trang → class con trong cùng file. Dùng ở nhiều trang → `components/`.
- Page object mới → đăng ký fixture ở **slot của module** (`fixtures/modules/<module>.fixture.ts`). Tab thứ hai →
  `new XxxPage(otherPage)` trong spec.

**Import được:** `components/`, `data/`, `@playwright/test`. Không import `api/`, `fixtures/`, `tests/`.
