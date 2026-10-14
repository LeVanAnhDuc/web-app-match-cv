# components/

**Trả lời câu hỏi:** phần UI nào lặp lại trên nhiều trang?

| File | Nội dung |
|---|---|
| `app-shell.component.ts` | `AppShell` (fixture `shell`, cũng là `page.shell` của mọi page object) — layout quanh mọi route `/_app` (`client/src/layouts/AppShell/**`) |
| `ui-language.ts` | `uiLanguage(page)` / `rememberUiLanguage(page, lng)`: ngôn ngữ UI hiện tại của một tab, do `BasePage.setLanguage` ghi |

## `AppShell`

| Nhóm | Locator / hành động |
|---|---|
| Vùng | `sidebar()` (desktop ≥ lg, `#app-sidebar`), `header()` (dưới lg), `drawer()` (drawer trái khi mở menu), `main()` |
| Điều hướng | `sidebarLink(item)`, `drawerLink(item)`, `navLinks()`, `activeNavLink()` (`aria-current="page"`), `navigate(item)` (tự chọn sidebar hay drawer theo viewport, chờ URL) |
| Sidebar | `collapseButton()`, `expandButton()`, `collapseSidebar()`, `expandSidebar()` |
| Mobile | `openMenuButton()`, `drawerCloseButton()`, `openDrawer()`, `closeDrawer()`, `isCompact()` |
| User | `accountButton()`, `accountMenu()`, `openAccountMenu()`, `signOutButton()`, `signOut()` (chờ POST /auth/logout) |
| Guest / ẩn danh | `headerSignInLink()`, `guestSignInLink()`, `guestCard()`, `guestQuotaText(left, limit)` |

`item` ∈ `NAV_ITEMS`: `home` (/), `match` (/wizard), `savedCvs` (/cv), `savedJds` (/jd), `aiCredentials`, `myData`
(4 mục cuối chỉ user đăng nhập thấy). Label lấy từ `data/copy.ts` theo ngôn ngữ hiện tại của tab, nên cùng một lời gọi
chạy được cả `en` và `vi` sau `setLanguage("vi")`.

## Quy tắc

`<name>.component.ts`, class `<Name>`. Constructor nhận `Page` (hoặc `Locator` gốc nếu component nằm trong một vùng).
Có ở mọi màn hình → tạo trong `BasePage`; chỉ vài trang → tạo trong page cần nó. Label lấy bằng `t(key, uiLanguage(page))`.

Như `pages/`: locator lazy, hành động người dùng, không assertion nghiệp vụ. UI chỉ ở một trang thì để trong page đó.

**Import được:** `data/`, `@playwright/test`. Không import `pages/`, `api/`, `fixtures/`.
