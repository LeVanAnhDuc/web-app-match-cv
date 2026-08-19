---
name: standard-tailwind
description: Tailwind CSS v4 standards, design token conventions, component patterns, dark mode, responsive layout, animations, and common gotchas. Use when writing or reviewing Tailwind utility classes, configuring themes, implementing dark mode, responsive layouts, or extracting reusable components.
---

> Targets Tailwind CSS v4 (released January 2025). v3 syntax still works but is the legacy path. Default to v4 patterns for all new projects.
>
> **This project**: Tailwind v4 is wired via the `@tailwindcss/vite` plugin (`vite.config.ts`), and the single `@import "tailwindcss";` lives in `src/styles.css` (linked from `__root.tsx`). Tailwind **coexists with Ant Design** — use Tailwind utilities for layout/spacing around components, and let antd render the components themselves (see `standard-antd`). Preflight stays ON; antd wins style conflicts on its own elements via `StyleProvider hashPriority="high"`. Do not restyle antd component internals with Tailwind color/typography classes.

---

## Configuration — CSS-first (v4)

v4 replaces `tailwind.config.js` with a single CSS import. No JavaScript config needed.

```css
/* src/styles.css */
@import "tailwindcss";
```

That single import replaces all three `@tailwind` directives from v3. Content detection is automatic — no `content: []` array needed.

---

## Design Tokens — 3-Layer Architecture

Structure tokens in three layers:

```
Primitive  →  raw values      --color-blue-500: oklch(0.68 0.15 250)
Semantic   →  purpose-based   --color-primary: var(--color-blue-500)
Component  →  element-scoped  --button-bg: var(--color-primary)
```

- Define all tokens in `@theme` — never in hardcoded arbitrary values
- Use semantic naming: `--color-primary`, `--color-surface` — not `--blue-500` in components
- Reference primitive tokens from semantic tokens, semantic tokens from component tokens

```css
@import "tailwindcss";

@theme {
  /* Primitive */
  --color-blue-500: oklch(0.68 0.15 250);
  --color-blue-900: oklch(0.25 0.08 250);

  /* Semantic — mapped via @theme inline for utility class generation */
}
```

---

## Color System

### Native Tailwind v4 colors

v4's entire default palette uses `oklch`. Custom colors in `@theme` should also use `oklch` — perceptually uniform, more vivid gradients.

```css
@theme {
  --color-brand-50: oklch(0.97 0.01 250);
  --color-brand-100: oklch(0.95 0.03 250);
  --color-brand-500: oklch(0.68 0.15 250);
  --color-brand-900: oklch(0.25 0.08 250);
}
```

`@theme` variables auto-generate utility classes: `--color-brand-500` → `bg-brand-500`, `text-brand-500`, `border-brand-500`.

Any color format is valid (`hex`, `rgb`, `hsl`), but do not mix formats in the same project.

### Semantic tokens with dark mode — `@theme inline`

```css
@import "tailwindcss";

/* Step 1: Define per-theme values */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.14 0.005 286);
  --primary: oklch(0.14 0.005 286);
  --muted: oklch(0.97 0.001 286);
  --border: oklch(0.92 0.004 286);
}

.dark {
  --background: oklch(0.14 0.005 286);
  --foreground: oklch(0.99 0.002 286);
  --primary: oklch(0.99 0.002 286);
  --muted: oklch(0.22 0.004 286);
  --border: oklch(0.28 0.003 286);
}

/* Step 2: Map to utility classes */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-muted: var(--muted);
  --color-border: var(--border);
}
```

**`@theme inline` is required** — without it, `bg-primary`, `text-foreground` etc. will not exist as utility classes.

---

## Dark Mode

### Class-based (manual switcher)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

```html
<html class="dark">
  <body class="bg-background text-foreground"></body>
</html>
```

### Media-based (system preference)

No configuration needed — `dark:` variant responds to `prefers-color-scheme: dark` by default.

```html
<div class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"></div>
```

### Rules

- Always pair light + dark variants for every themed element
- Use CSS variables for theme colors — swap variables instead of duplicating classes
- Never hardcode light-only or dark-only colors without providing the opposite variant

---

## Responsive Design

Mobile-first always. Base styles = mobile, scale up with breakpoints:

```html
<div class="flex flex-col md:flex-row lg:gap-8"></div>
```

### Viewport breakpoints vs Container queries

| Use                          | When                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `sm:`, `md:`, `lg:`          | Page-level layouts — respond to viewport width          |
| `@container`, `@sm:`, `@lg:` | Reusable components — respond to parent container width |

```html
<!-- Viewport: page layout -->
<main class="grid grid-cols-1 md:grid-cols-3">
  <!-- Container: reusable card component -->
  <div class="@container">
    <div class="flex flex-col @md:flex-row"></div>
  </div>
</main>
```

Container queries are built into v4 core — no plugin needed.

---

## Component Extraction

Extract when:

- Same class combination appears **3+ times** across the codebase
- Class list has **complex state variants** (hover, focus, disabled, aria)
- The component has meaningful semantic identity

Extract to:

- **React/Vue component** for dynamic or interactive elements — preferred
- **`@apply` in CSS** only for static, non-interactive patterns (e.g. prose styles)

```css
/* ✅ Acceptable @apply — static pattern */
@layer components {
  .badge {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium;
  }
}
```

Never use `@apply` heavily — it defeats the utility-first approach and produces larger, harder-to-maintain CSS.

---

## Custom Utilities — `@utility`

For reusable utilities that compose with variants (`hover:`, `md:`, `dark:`):

```css
@utility container-fluid {
  width: 100%;
  max-width: 1440px;
  margin-inline: auto;
  padding-inline: 1rem;
}

/* Usage: class="container-fluid" or "md:container-fluid" */
```

---

## Animations

Define animations in `@theme` to generate `animate-*` utilities:

```css
@theme {
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

/* Usage: class="animate-fade-in" */
```

### Animation rules

- Use `transition-colors` or `transition-transform` — never `transition-all` (animates every property, expensive)
- Interaction transitions: 150–200ms. Layout changes: 300ms max
- Every animation must be purposeful — no decorative animations without intent
- Always implement `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Plugins — `@plugin` directive

```css
/* ✅ v4 */
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";

/* ❌ Does not work as CSS import */
@import "@tailwindcss/typography";
```

### Deprecated packages — do not install

```
tailwindcss-animate    ← deprecated, causes build errors
tw-animate-css         ← does not exist
```

Use native `@keyframes` in `@theme` or `@tailwindcss/motion` instead.

---

## Arbitrary Values

```html
<div class="top-[117px]">
  <div class="bg-[#1da1f2]">
    <div class="grid-cols-[200px_1fr_1fr]"></div>
  </div>
</div>
```

- Use `_` for spaces: `grid-cols-[200px_1fr]`
- Arbitrary value used 3+ times → move to `@theme` token
- Prefer design system scale over one-off arbitrary values

---

## Performance

- v4 auto-detects template files — no `content: []` configuration needed
- Never construct class names dynamically with template strings:

```tsx
// ❌ Tailwind cannot detect — class will be purged
const cls = `bg-${color}-500`;

// ✅ Complete class names only
const colorMap = { blue: "bg-blue-500", red: "bg-red-500" };
const cls = colorMap[color];
```

- Never use `@apply` inside a loop — generates duplicate CSS
- Use `content-visibility: auto` for long scrollable lists (add as custom utility)
- Use `tailwind-merge` for conditional class composition to avoid conflicts:

```tsx
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

const cn = (...inputs) => twMerge(clsx(inputs))

<div className={cn('px-4 py-2', isActive && 'bg-primary', className)}>
```

---

## v3 → v4 Migration Reference

| v3                                    | v4                                    | Note                             |
| ------------------------------------- | ------------------------------------- | -------------------------------- |
| `tailwind.config.js`                  | `@theme {}` in CSS                    | Config still works but is legacy |
| `@tailwind base/components/utilities` | `@import "tailwindcss"`               | Single import replaces all three |
| `plugins: [require('...')]`           | `@plugin "..."`                       | Require syntax breaks            |
| `content: [...]`                      | Auto-detected                         | No config needed                 |
| `theme.extend.colors`                 | `--color-*` in `@theme`               | CSS variables replace JS         |
| `@tailwindcss/container-queries`      | Built-in core                         | Remove plugin                    |
| `tailwindcss-animate`                 | `@tailwindcss/motion` or `@keyframes` | Deprecated                       |
| `darkMode: 'class'` in config         | `@custom-variant dark` in CSS         | —                                |
| Colors in `rgb` / `hsl`               | `oklch` default                       | Can still use other formats      |
| `w-* h-*` pair                        | `size-*`                              | New shorthand                    |

---

## Anti-Patterns

- **Arbitrary values everywhere** (`w-[237px]`) — use design system scale
- **`!important`** — fix specificity, never force override
- **Dynamic class strings** (`text-${color}-500`) — Tailwind purges these at build
- **Duplicate long class lists** — extract to component
- **Heavy `@apply`** — prefer component extraction
- **`transition-all`** — use specific properties (`transition-colors`, `transition-transform`)
- **`@import "..."`** for plugins — use `@plugin "..."` in v4
- **Mixing color formats** (`oklch` + `hsl`) in same project
- **Skipping `@theme inline`** when using CSS variable semantic tokens

---

## Code Review Checklist

### Blocking

- [ ] `tailwindcss-animate` in dependencies
- [ ] `@import "@tailwindcss/..."` instead of `@plugin`
- [ ] Dynamic class construction with string interpolation
- [ ] `@theme inline` missing — semantic color utilities won't generate
- [ ] Color formats mixed in same project (`oklch` + `hsl`)

### Warning

- [ ] `tailwind.config.js` used in new v4 project instead of `@theme`
- [ ] `@tailwindcss/container-queries` plugin installed — redundant in v4
- [ ] `@apply` inside component rendered in a loop
- [ ] Arbitrary value used 3+ times — move to `@theme`
- [ ] Classes combined with manual string concat instead of `tailwind-merge`
- [ ] `transition-all` used instead of specific transition property
- [ ] Dark mode missing opposite variant for a themed element
- [ ] Animation missing `prefers-reduced-motion` handling

### Suggestion

- [ ] Same class combo 3+ times — consider component extraction
- [ ] Custom color as arbitrary `bg-[#...]` — move to `@theme`
- [ ] Viewport breakpoint used where container query would be more appropriate
- [ ] Decorative animation without intent justification
- [ ] `w-* h-*` pair replaceable with `size-*`

---

## Semantic Color Tokens — NEVER hard-code palette colors

Colors come from the design system, **not** from Tailwind palette primitives typed inline.

- **Source of truth**: the project design system in `.claude/uiux/` (`frontend-reference.md` — color/spacing/typography tokens) plus Ant Design's theme tokens set on `ConfigProvider` (`theme.token`, e.g. `colorPrimary`) in `src/providers/AntdProvider.tsx`. antd runs with `cssVar: true`, so its tokens are available as CSS variables and flip with `defaultAlgorithm`/`darkAlgorithm`.
- **Where semantic Tailwind tokens live**: any project-defined semantic CSS variables belong in `src/styles.css` under `@theme` / `@theme inline` (see the token + dark-mode sections above), kept in sync with `.claude/uiux/frontend-reference.md`.
- **NEVER** use Tailwind palette primitives (`slate`, `indigo`, `green`, `amber`, `red`, `pink`, `white`, `black`, …) directly in a component / view / mock. Use a semantic token (`bg-primary`, `text-muted-foreground`, …) or, for antd-driven surfaces, let antd's theme token handle it.

> **Conflict rule**: when this generic skill disagrees with `.claude/uiux/` (the project design system), **`.claude/uiux/` wins** (project-specific > generic).

### Mapping palette family → semantic role

Translate the design _intent_ to a semantic role, then use the matching token — never the raw palette name.

| Palette family (design intent)                                        | Semantic role                                             |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `slate` / `gray` / `zinc` / `neutral` (surfaces, borders, muted text) | neutral: `muted` / `muted-foreground` / `border` / `card` |
| `indigo` / `violet` / `purple` / `blue` (brand / primary action)      | `primary` (antd `colorPrimary`) or `info` (cool)          |
| `blue` / `cyan` / `sky` (info, link, metric)                          | `info`                                                    |
| `green` / `emerald` / `teal` / `lime` (success, active)               | `success`                                                 |
| `amber` / `yellow` / `orange` (warning)                               | `warning` (watch contrast — very light on light bg)       |
| `red` / `rose` / `pink` (destructive, error)                          | `destructive` / `danger`                                  |
| `white` / `black` literal                                             | theme-aware foreground/background token                   |

### Workflow trước khi gõ className màu

1. Đọc `.claude/uiux/frontend-reference.md` để biết token nào tồn tại + ý nghĩa; đọc `src/styles.css` để xem semantic CSS variables đã khai báo.
2. Translate design intent → semantic role (design indigo cho "primary action" → `bg-primary` / antd `colorPrimary`, KHÔNG `bg-indigo-500`).
3. Nếu token chưa tồn tại → thêm vào `src/styles.css` (`@theme`/`@theme inline`) và sync `.claude/uiux/frontend-reference.md`, không hardcode một lần.
4. Với antd component, đổi màu qua `theme.token` / `theme.components`, không qua Tailwind color class trên component đó.

### Audit khi review

Grep trong `src/views/**/*.tsx` + `src/components/**/*.tsx` + `src/mocks/**/*.ts`:

```
(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|caret|accent|shadow|divide)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(-\d+)?
```

Kết quả phải = **0** trước khi merge.

**Lint/tsc/format pass ≠ color-rule pass** — không có lint rule catch palette usage. Manual audit theo regex trên + compare với `.claude/uiux/` token list = step ngang hàng a11y audit, không skip được.
