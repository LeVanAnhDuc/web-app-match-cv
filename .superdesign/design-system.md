# web-app-match-cv — Design System (STRICT — SuperDesign MUST obey)

> Synced từ `.claude/uiux/frontend-reference.md` (2026-07-24, mock `cv-jd-matching-wizard` đã duyệt). Cơ chế strict-theme (root `.claude/CLAUDE.md` §3.3). **Sync lại file này mỗi khi token ở `.claude/uiux/` đổi.**

## 0. MANDATORY BOILERPLATE — copy `<head>` này VERBATIM vào mọi HTML sinh ra

```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<link href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&f[]=clash-grotesk@600&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Switzer', Inter, ui-sans-serif, system-ui, sans-serif; }
  h1, h2, h3 { font-family: 'Clash Grotesk', 'Switzer', sans-serif; }
</style>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: { extend: { colors: {
      primary: { DEFAULT: '#2563eb', dark: '#4f46e5' }, /* blue-600 light / indigo-600 dark */
    } } }
  }
</script>
```

## 1a. BOTH themes — MANDATORY page structure

1 file, 2 section markup y hệt: section light (mặc định) + section `class="dark"` (token tự flip). Nền light `bg-slate-50`, dark `bg-slate-900`.

## 1b. HARD RULES (một design bị REJECT nếu vi phạm)

1. **CẤM palette generic** — chỉ dùng bảng Tailwind **slate** (neutral) + **blue-600** (primary light) / **indigo-600** (primary dark). success=green-600/500, warning=amber-600/500. KHÔNG dùng purple/teal/pink random.
2. **CẤM Google Fonts** — chỉ Fontshare **Switzer** (body) + **Clash Grotesk** (heading).
3. **LUÔN xuất cả light + dark** trong cùng 1 file.
4. **Radius**: control `rounded-lg`, panel `rounded-xl`, card `rounded-2xl`.
5. **Icon**: chỉ **Lucide** (qua iconify `lucide:*`). Theo `.claude/uiux/icon-map.md`.

## 2. Typography tiers

h1 `text-2xl font-semibold` · h2 `text-xl font-semibold` · body `text-base` · secondary `text-sm text-slate-500` (dark `text-slate-300`) · label `text-sm font-bold uppercase tracking-wider text-slate-400`.

## 3. Color token (map nhanh)

primary `#2563eb`/dark `#4f46e5` · bg `slate-50`/`slate-900` · card `white`/`slate-800` · border `slate-200`/`slate-700` · text `slate-900`/`white`. Chi tiết: `.claude/uiux/frontend-reference.md` §1.

## 4. Component patterns

stepper ngang 4 dot; card `p-8 rounded-2xl` + border + shadow; input tabs pill; dropzone `border-2 border-dashed rounded-2xl`; reuse **radio list** + empty-state; save toggle + title input; result gauge + progress bars + strengths/gaps/suggestions. Chi tiết: `.claude/uiux/frontend-reference.md` §7.

## 5. UX copy

Theo `.claude/uiux/ux-copy.md` (EN + VI).

## 6. Accessibility

Radio group semantics; focus ring primary; keyboard nav; contrast cả 2 theme; label mọi control.
