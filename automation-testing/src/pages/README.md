# pages/

**Trả lời câu hỏi:** trên màn hình này, phần tử nằm ở đâu và người dùng làm được gì?

```
pages/
├── base.page.ts            BasePage: component có ở mọi màn hình (header, toast…)
└── <area>/<name>.page.ts   vd auth/sign-in.page.ts → class SignInPage extends BasePage
```

## Quy tắc

- Một class mỗi trang: `<Name>Page` trong `kebab-case.page.ts`, kế thừa `BasePage`, constructor nhận `Page`.
- Locator là **method trả `Locator`** (lazy): `emailInput() { return this.page.getByLabel("Email"); }`.
- Hành động người dùng là method: `goto()`, `submitEmail(email)`. `goto()` dùng đường dẫn tương đối (project đặt `baseURL`).
- **Không assertion nghiệp vụ** (`expect` kiểm kết quả thuộc về spec). Được chờ trạng thái sẵn sàng của chính nó:
  heading hiện trong `goto()`, `waitForURL` / `waitForResponse` sau submit.
- Selector ưu tiên `getByRole` / `getByLabel` / `getByText`. Không dùng CSS class của thư viện UI.
- Dialog/modal chỉ thuộc một trang → class con trong cùng file (vd `MfaDialog`). Dùng ở nhiều trang → `components/`.
- Page object mới → thêm fixture vào `fixtures/pages.fixture.ts`. Tab thứ hai → `new XxxPage(otherPage)` trong spec.

**Import được:** `components/`, `data/`, `@playwright/test`. Không import `api/`, `fixtures/`, `tests/`.
