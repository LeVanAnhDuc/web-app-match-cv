# web-app-match-cv — Design System (STRICT — SuperDesign MUST obey)

> Synced từ `.claude/uiux/{standards,frontend-reference}.md` (2026-07-24 — **đồng bộ chuẩn app anh em** `web-app-store-server-client`: system font, zinc/slate + accent xanh 60-30-10, radius md/xl, shadow nhẹ). Cơ chế strict-theme (root `.claude/CLAUDE.md` §3.3). Sync lại khi token `.claude/uiux/` đổi.

## 0. MANDATORY BOILERPLATE — copy `<head>` này VERBATIM vào mọi HTML sinh ra

```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<style>
  html, body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
</style>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: { extend: {
      colors: { primary: { DEFAULT: '#2563eb', dark: '#6366f1' } }, /* blue-600 / indigo-500 */
    } }
  }
</script>
```

## 1a. BOTH themes — MANDATORY

1 file, 2 section markup y hệt: light (mặc định) + `class="dark"`. Nền light `bg-slate-50`, dark `bg-slate-900`.

## 1b. HARD RULES (REJECT nếu vi phạm)

1. **System font ONLY** — dùng system sans stack ở boilerplate. **CẤM** Google Fonts / Fontshare / Switzer / Clash / custom font.
2. **Palette**: neutral **slate**; accent **blue-600** (light) / **indigo-500** (dark); success green-600/500; warning amber-600/500; error red. KHÔNG purple/teal/pink random, KHÔNG hex ngoài palette.
3. **Radius**: button/input/badge `rounded-md` (8px); card/panel/list-item `rounded-xl` (12px); icon tile `rounded-lg`. **CẤM `rounded-2xl` tràn lan.**
4. **Shadow nhẹ**: card `shadow-sm` (hoặc chỉ `border border-slate-200 dark:border-slate-700`). **CẤM `shadow-xl`/`shadow-2xl`** cho card thường.
5. **Density**: card `p-6` (KHÔNG `p-8/p-10`); rhythm dọc `gap-6`; nhóm control `gap-4`; icon+label `gap-2/3`.
6. **List-row KHÔNG `flex-wrap`**: `flex items-center gap-4 px-4 py-3 rounded-xl border`; giữa `min-w-0 flex-1` (title `text-sm font-semibold truncate` + meta `text-xs text-slate-500 truncate`); 2 đầu `shrink-0`. (Sai pattern này = nguyên nhân item wrap xấu.)
7. **Icon**: chỉ **Lucide** (`lucide:*`), theo `.claude/uiux/icon-map.md`.
8. **LUÔN light + dark**.

## 2. Typography tiers (system font)

h1 `text-2xl font-bold tracking-tight` · h2 `text-xl font-bold` · title `text-base font-semibold` · body `text-sm` · secondary `text-sm text-slate-500 dark:text-slate-400` · meta/label `text-xs font-medium text-slate-400`.

## 3. Color token (map nhanh)

primary `#2563eb`/dark `#6366f1` · bg `slate-50`/`slate-900` · card `white`/`slate-800` · border `slate-200`/`slate-700` · text `slate-900`/`white` · muted `slate-500`. Chi tiết: `.claude/uiux/frontend-reference.md` §1.

## 4. Component patterns

- **Card**: `bg-white dark:bg-slate-800 border rounded-xl shadow-sm p-6`; title `text-base font-semibold`.
- **Stepper**: dot `w-10 h-10 rounded-full`; active primary solid; done tint+check; idle surface+border+muted. Rail dọc (mặc định) hoặc ngang.
- **Input tabs (Upload/Paste)**: segmented pill nền `slate-100 rounded-md`, active = white + shadow-sm.
- **Dropzone**: `border-2 border-dashed rounded-xl p-8`, hover border primary + bg primary/5.
- **Reuse list-row (radio-card)**: theo HARD RULE #6 — `flex items-center gap-4 px-4 py-3 rounded-xl border`, radio dot `shrink-0`, giữa `min-w-0 flex-1` (title truncate + meta), trailing badge format `shrink-0 text-xs px-2 py-0.5 rounded bg-slate-100`. Active/hover `border-primary bg-primary/5`. Empty-state: icon `search-x` tròn `size-12 bg-slate-100` + title `text-sm font-medium` + hint `text-xs`.
- **Save toggle**: switch + label `text-sm` + title input `rounded-md`.
- **Result (step 4)**: gauge % + progress bar semantic/keyword; list strengths (success) / gaps (warning) / suggestions (lightbulb) dạng row `gap-3`.

## 5. UX copy

Theo `.claude/uiux/ux-copy.md` (EN + VI).

## 6. Accessibility

Radio group semantics; focus ring; keyboard nav; contrast cả 2 theme; label mọi control; hit-area ≥ 40px.
