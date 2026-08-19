---
name: jsx
paths:
  - "src/**/*.tsx"
---

# JSX Convention

## 1. Interactive element → Ant Design component

Mọi phần tử có **hành vi** (click, input, select, upload, submit, step, progress…) dùng component Ant Design — KHÔNG dùng raw HTML tag tương ứng:

| Nhu cầu              | Dùng (antd)                    | KHÔNG dùng                  |
| -------------------- | ------------------------------ | --------------------------- |
| Nút bấm              | `<Button>`                     | ❌ `<button>`               |
| Text/URL input       | `<Input>` / `<Input.TextArea>` | ❌ `<input>` / `<textarea>` |
| Chọn 1 trong nhiều   | `<Select>` / `<Radio.Group>`   | ❌ `<select>`               |
| Upload file          | `<Upload>`                     | ❌ `<input type="file">`    |
| Stepper / tiến trình | `<Steps>` / `<Progress>`       | ❌ tự dựng div              |
| Tabs                 | `<Tabs>`                       | ❌ tự dựng                  |
| Modal / dialog       | `<Modal>`                      | ❌ raw `<dialog>`           |

```tsx
// ✅ Đúng
import { Button, Input } from 'antd'

<Input.TextArea placeholder="Paste JD text" rows={8} />
<Button type="primary" onClick={onNext}>Next</Button>

// ❌ Sai
<button onClick={onNext}>Next</button>
<textarea />
```

### Ngoại lệ có tài liệu

Được dùng raw element cho phần tử tương tác **chỉ khi** component antd tương ứng có hạn chế cụ thể đã biết, và **PHẢI kèm comment giải thích lý do** ngay tại chỗ. Ví dụ thực tế: `SavedDocRadioList` dùng native `<input type="radio">` (không phải `<Radio>` của antd) để tránh lỗi wrapping của inline-flex label — có comment nêu rõ. Không có lý do tài liệu hoá → mặc định dùng antd.

## 2. Layout tag thô — được phép

Các tag layout/semantic thuần (không hành vi) dùng thẳng: `<div>`, `<span>`, `<p>`, `<ul>`/`<li>`, `<section>`, `<aside>`, `<main>`, `<h1>`… Tailwind class để style.

```tsx
<aside className="w-72 shrink-0 border-r ...">
  <h1 className="text-xl font-semibold">{t("appName")}</h1>
</aside>
```

## 3. Điều hướng — TanStack Router `<Link>`

Link nội bộ dùng `<Link to="...">` từ `@tanstack/react-router` (xem `imports.md`) — KHÔNG `<a href>` cho route nội bộ. `<a>` chỉ cho external URL.

## 4. Markup dễ đọc

- Giữ markup gọn; nhánh state (loading/error/empty) render rõ ràng, tách component con khi 1 nhánh markup lớn (xem `views.md`).
- Text hiển thị đi qua `t(...)` i18n — không hard-code chuỗi (xem `locales.md`).

## 5. Mật độ markup — KHÔNG dòng trống, KHÔNG comment trong JSX

Cây JSX phải **liền mạch**: từ tag mở ngoài cùng tới tag đóng ngoài cùng, không có dòng trống nào ngăn cách các block markup. Prettier và ESLint KHÔNG bắt lỗi này — trách nhiệm là của người viết.

```tsx
// ✅ Đúng
return (
  <>
    <header>…</header>
    <SectionCard title={t("myData.contents.heading")}>…</SectionCard>
    <Button type="primary">…</Button>
  </>
);

// ❌ Sai — dòng trống ngăn block
return (
  <>
    <header>…</header>

    <SectionCard title={t("myData.contents.heading")}>…</SectionCard>

    <Button type="primary">…</Button>
  </>
);
```

Cấm kèm theo:

- **KHÔNG `{/* … */}` trong JSX.** Ngoại lệ DUY NHẤT: comment bắt buộc của §1 "Ngoại lệ có tài liệu" (giải thích vì sao dùng raw element thay cho antd) — VD `SavedDocRadioList`.
- **KHÔNG block JSDoc `/** … */` mô tả component** phía trên arrow fn / sub-component. Tên component + markup đã tự nói lên vai trò; mô tả nào cần thiết thì thuộc về `docs/specs/<feature>/design.md`, không nằm trong file component.

Dòng trống **ngoài** cây JSX vẫn giữ nguyên: giữa các nhóm import (xem `imports.md` §4), giữa hooks / biến dẫn xuất / `return`. Chỉ phần **bên trong markup** mới bị cấm.

Markup dài tới mức cần dòng trống hoặc comment để đọc được là tín hiệu component đã quá lớn → **tách component con** (`views.md`), đừng thêm khoảng trắng.
