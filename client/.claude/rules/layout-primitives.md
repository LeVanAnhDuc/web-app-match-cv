---
name: layout-primitives
paths:
  - "src/**/*.tsx"
---

# Layout Primitives & Semantic Tokens

Luật giữ padding / font / border đồng nhất giữa sidebar và content. Nguồn gốc: `docs/specs/ui-consistency-shell/design.md`. Source-of-truth thị giác: `docs/design-system/match-cv/MASTER.md` §2b, §3, §4, §6, §8.

## 1. Semantic token — KHÔNG hard-code `slate-*`

Token khai báo ở `src/styles.css` bằng Tailwind 4 `@theme` (KHÔNG `@theme inline`) + override trong `@media (prefers-color-scheme: dark)`. Dùng utility, KHÔNG viết lại cặp `class dark:class`:

| Dùng                          | Thay cho                               | Vai trò                                       |
| ----------------------------- | -------------------------------------- | --------------------------------------------- |
| `bg-app`                      | `bg-zinc-50 dark:bg-zinc-950`          | nền app shell                                 |
| `bg-surface`                  | `bg-white dark:bg-zinc-900`            | nền card/panel                                |
| `bg-surface-subtle`           | `bg-zinc-100 dark:bg-zinc-950`         | footer card, icon tile, empty box             |
| `border-line` / `divide-line` | `border-zinc-200 dark:border-zinc-700` | divider trang trí, đường kẻ nhẹ               |
| `border-line-strong`          | `border-zinc-500 dark:border-zinc-500` | viền input — ranh giới control, phải đạt ≥3:1 |
| `text-body`                   | `text-zinc-900 dark:text-zinc-50`      | chữ chính                                     |
| `text-muted`                  | `text-zinc-600 dark:text-zinc-400`     | chữ phụ                                       |
| `text-faint`                  | `text-zinc-500 dark:text-zinc-500`     | chữ mờ                                        |
| `bg-primary`                  | `bg-cyan-700 dark:bg-cyan-600`         | nền nhấn                                      |
| `text-accent`                 | `text-cyan-700 dark:text-cyan-400`     | chữ nhấn                                      |

Thêm token mới → sửa `src/styles.css` **và** `docs/design-system/match-cv/MASTER.md` §2 trong cùng PR. Nếu token là màu primary, sửa luôn `colorPrimary` của antd ở `src/contexts/AntdProvider` cho khớp — lệch hai chỗ này là hai màu khác nhau ở dark mode.

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

## 4. Thang chữ — 6 vai trò, không chế thêm

| Vai trò          | Class                                                                    | Family      |
| ---------------- | ------------------------------------------------------------------------ | ----------- |
| Page title (h1)  | `text-2xl font-bold tracking-tight text-body`                            | `font-head` |
| Card title (h2)  | `text-xl font-bold text-body` — do `SectionCard` render qua prop `title` | `font-head` |
| Eyebrow / label  | `text-xs font-semibold tracking-wider uppercase text-muted`              | `font-sans` |
| Body             | `text-sm text-body`                                                      | `font-sans` |
| Meta / secondary | `text-sm text-muted`                                                     | `font-sans` |
| Số               | `font-mono tabular-nums text-body`                                       | `font-mono` |

## 5. Sidebar nav item

6 item dùng **chung một class string**; khác biệt duy nhất là trạng thái active (`bg-primary/10 text-accent font-semibold` + thanh dọc `::before` + `aria-current="page"`). KHÔNG tạo item "nổi bật vĩnh viễn" — fill màu cố định sẽ đè mất tín hiệu active. Chi tiết ở `docs/design-system/match-cv/MASTER.md` §8.
