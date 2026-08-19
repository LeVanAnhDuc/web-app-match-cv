---
name: layout-primitives
paths:
  - "src/**/*.tsx"
---

# Layout Primitives & Semantic Tokens

Luật giữ padding / font / border đồng nhất giữa sidebar và content. Nguồn gốc: `docs/specs/ui-consistency-shell/design.md`. Source-of-truth thị giác: root `.claude/uiux/frontend-reference.md` §1b, §2, §5, §7a, §7b.

## 1. Semantic token — KHÔNG hard-code `slate-*`

Token khai báo ở `src/styles.css` bằng Tailwind 4 `@theme` (KHÔNG `@theme inline`) + override trong `@media (prefers-color-scheme: dark)`. Dùng utility, KHÔNG viết lại cặp `class dark:class`:

| Dùng                          | Thay cho                                       | Vai trò                           |
| ----------------------------- | ---------------------------------------------- | --------------------------------- |
| `bg-app`                      | `bg-slate-50 dark:bg-slate-900`                | nền app shell                     |
| `bg-surface`                  | `bg-white dark:bg-slate-800`                   | nền card/panel                    |
| `bg-surface-subtle`           | `bg-slate-50/50 dark:bg-slate-900/30`          | footer card, icon tile, empty box |
| `border-line` / `divide-line` | `border-slate-{100,200} dark:border-slate-700` | mọi viền, đường kẻ                |
| `text-body`                   | `text-slate-900 dark:text-white`               | chữ chính                         |
| `text-muted`                  | `text-slate-500 dark:text-slate-400`           | chữ phụ                           |
| `text-faint`                  | `text-slate-400 dark:text-slate-500`           | chữ mờ, eyebrow                   |
| `bg-primary`                  | `bg-blue-600 dark:bg-indigo-600`               | nền nhấn                          |
| `text-accent`                 | `text-blue-600 dark:text-indigo-400`           | chữ nhấn                          |

**Ngoại lệ được phép**: màu semantic của báo cáo và trạng thái — `green-*` (strengths), `amber-*` (gaps), `red-*` (error), `blue-*`/`indigo-*` (suggestions, progress). Giữ nguyên class Tailwind gốc, KHÔNG token hoá.

Thêm token mới → sửa `src/styles.css` **và** root `.claude/uiux/frontend-reference.md` §1b **và** `docs/.superdesign/design-system.md` trong cùng PR.

## 2. `PageContainer` — mỗi trang đúng 1 cái

```tsx
import PageContainer from "#/components/PageContainer";

<PageContainer className="space-y-6">…</PageContainer>;
```

= `mx-auto w-full max-w-[1600px] p-4 md:p-6`. KHÔNG tự viết `mx-auto max-w-*` cho trang, KHÔNG `md:p-8`.

## 3. `SectionCard` — hình dạng card DUY NHẤT

```tsx
import SectionCard from "#/components/SectionCard";

<SectionCard title="…" description="…" extra={…} footer={…}>…</SectionCard>;
```

- KHÔNG dựng card bằng `<div>` rời (`rounded-xl border bg-white shadow-sm …`).
- KHÔNG dùng antd `<Card>` — padding/radius/border riêng của nó lệch với `SectionCard`.
- `fill` — card khoá chiều cao desktop, body scroll nội bộ (Wizard).
- `stickyFooter` — footer CTA dính đáy ở mobile, `lg:static`.
- `bodyClassName="p-0"` — khi nhét `Table` / `ul` sát mép card.
- Cần biến thể mới → thêm prop cho `SectionCard`, KHÔNG fork card riêng ở view.

## 4. Thang chữ — 5 vai trò, không chế thêm

| Vai trò          | Class                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Page title (h1)  | `text-2xl font-bold tracking-tight text-body`                            |
| Card title (h2)  | `text-xl font-bold text-body` — do `SectionCard` render qua prop `title` |
| Eyebrow / label  | `text-xs font-semibold tracking-wider uppercase text-faint`              |
| Body             | `text-sm text-body`                                                      |
| Meta / secondary | `text-sm text-muted`                                                     |

## 5. Sidebar nav item

4 item dùng **chung một class string**; khác biệt duy nhất là trạng thái active (`bg-primary/10 text-accent font-semibold` + thanh dọc `::before` + `aria-current="page"`). KHÔNG tạo item "nổi bật vĩnh viễn" — fill màu cố định sẽ đè mất tín hiệu active. Chi tiết ở `.claude/uiux/frontend-reference.md` §7b.
