# components/

**Trả lời câu hỏi:** phần UI nào lặp lại trên nhiều trang?

`<name>.component.ts`, class `<Name>` (vd `AccountMenu`, `Notification`, `FieldError`). Constructor nhận `Page`
(hoặc `Locator` gốc nếu component nằm trong một vùng cụ thể). Có ở mọi màn hình → tạo trong `BasePage`;
chỉ vài trang → tạo trong page cần nó.

Quy tắc như `pages/`: locator lazy, hành động người dùng, không assertion nghiệp vụ.
UI chỉ xuất hiện ở một trang thì để trong page đó, không tách ra đây.

**Import được:** `data/`, `@playwright/test`. Không import `pages/`, `api/`, `fixtures/`.
