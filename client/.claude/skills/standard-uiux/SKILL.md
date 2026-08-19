---
name: standard-uiux
description: UI/UX design rules for production-grade interfaces. Use when designing layouts, choosing typography, color schemes, animations, spatial composition, or styling any web UI.
user-invocable: false
---

> **Project design system wins.** This is the generic UI/UX rulebook. The project's own design system lives in `.claude/uiux/` (`design-guide.md`, `frontend-reference.md`, `icon-map.md`, `ux-copy.md`, `standards.md`). On ANY conflict — tokens, spacing scale, type scale, color, icon choice, copy — **`.claude/uiux/` overrides this skill** (project-specific > generic). Read `.claude/uiux/` before designing any `client/src` UI and follow it; use this skill for anything the project system does not specify.

## Production Rules

- No emoji as icons — use SVG libraries (Lucide, Heroicons, Phosphor)
- All clickable elements: `cursor-pointer`
- Touch targets: minimum 44×44px
- z-index scale: base(1) → dropdown(10) → sticky(20) → modal(30) → toast(50)
- Dark mode text: never pure `#fff` — use `#e5e7eb` or similar
- Floating/sticky navbars: `backdrop-blur` + subtle `border-bottom`
- Always implement `prefers-reduced-motion`
- Interactive elements: `touch-action: manipulation`
- Modals/drawers: `overscroll-behavior: contain`
- Error messages must include the fix, not just the problem
- Button labels must be specific: "Save API Key" not "Continue", "Create Account" not "Submit"

---

## Button States

Every button must implement all 6 states:

| State    | Rule                                                                |
| -------- | ------------------------------------------------------------------- |
| Default  | Min height 40px desktop, 44px mobile                                |
| Hover    | Darken/lighten bg 10–15%, `transition: 150ms`, no size change       |
| Active   | `transform: scale(0.98)` or darken further than hover               |
| Focus    | `box-shadow: 0 0 0 3px` visible outline                             |
| Disabled | Opacity 40–50%, `cursor: not-allowed`, tooltip explaining condition |
| Loading  | Replace text with spinner, disable button, keep size unchanged      |

### Button Hierarchy

| Variant     | Style             | Rule                         |
| ----------- | ----------------- | ---------------------------- |
| Primary     | Solid fill        | 1 per section max            |
| Secondary   | Outlined or ghost | Supporting actions           |
| Tertiary    | Text-only         | Low-priority actions         |
| Destructive | Red               | Delete, irreversible actions |

**Never place two primary buttons adjacent to each other.**

---

## Form Design

- Single-column layout always. Exception: fields that clearly pair (First/Last name, City/State/Zip)
- Labels always above input, never inline or to the side
- Validate on `blur`, never while typing
- Show errors below the related field, never at the top
- Submit button: bottom of form, full-width on mobile, specific label

---

## Loading States

| Pattern       | When                          |
| ------------- | ----------------------------- |
| Skeleton      | Default — shows content shape |
| Optimistic UI | When result is predictable    |
| Spinner       | Buttons or full-page only     |
| Progress bar  | Only when % is known          |

- Skeleton placeholders must match exact size of content they replace
- Show skeletons minimum 300ms
- On network loss: show banner, auto-retry on reconnect, disable network actions, preserve form input

---

## Motion

### Duration Scale

| Category | Duration  | Use case                      |
| -------- | --------- | ----------------------------- |
| Micro    | 100–150ms | Hover, button press, checkbox |
| Small    | 150–250ms | Dropdown, tooltip, tab switch |
| Medium   | 250–350ms | Modal, drawer, section expand |
| Large    | 300–500ms | Route change, page animation  |

Hard limit: never exceed 500ms.

### Micro-interaction Rules

| Interaction         | Rule                                                               |
| ------------------- | ------------------------------------------------------------------ |
| Toggle/Switch       | Thumb slides visibly, bg changes simultaneously, 200ms ease-in-out |
| Like/Favorite       | Fill animation + scale 1.0→1.2→1.0 over 300ms                      |
| Input focus         | Border animates in at 150ms, floating label rises                  |
| Copy to clipboard   | Icon → checkmark, text → "Copied!", reverts after 2s               |
| Hover on card       | `translateY(-2px)` + shadow increase — clickable cards only        |
| Form submit success | Spinner → green checkmark before navigating                        |
| Number change       | Animate from old value to new, never jump                          |

### Never Animate

- Layout properties: `width`, `height`, `top`, `left`, `margin`, `padding`
- Multiple elements simultaneously — stagger or animate focal element only

---

## Typography

### Type Scale

| Token | Size | Tailwind          | Use            |
| ----- | ---- | ----------------- | -------------- |
| xs    | 12px | `text-xs`         | Caption, label |
| sm    | 14px | `text-sm`         | Helper text    |
| base  | 16px | `text-base`       | Body           |
| lg    | 20px | `text-lg`         | Subtitle       |
| xl    | 25px | `text-[1.563rem]` | h3             |
| 2xl   | 31px | `text-[1.938rem]` | h2             |
| 3xl   | 39px | `text-[2.438rem]` | h1             |
| 4xl   | 49px | `text-[3.063rem]` | Hero           |

### Line Height

| Size    | leading |
| ------- | ------- |
| 3xl–4xl | 1.1–1.2 |
| xl–2xl  | 1.3–1.4 |
| base–lg | 1.5–1.7 |
| xs–sm   | 1.3–1.4 |

### Letter Spacing

| Context           | tracking           |
| ----------------- | ------------------ |
| Heading 32px+     | -0.02em to -0.03em |
| Body              | 0                  |
| Caption/uppercase | 0.05em–0.1em       |
| ALL CAPS any size | 0.08em minimum     |

### Rules

- Single font family, vary by weight: 400 body / 500 label+button / 700 heading
- `font-variant-numeric: tabular-nums` for number columns
- `text-wrap: balance` or `text-pretty` on headings
- Loading states end with `…`: "Loading…", "Saving…"
- Always sentence case: "Create new project" not "Create New Project"

---

## Spacing

All spacing follows **4px base unit**. No arbitrary values.

| px  | rem     | Tailwind | Use                      |
| --- | ------- | -------- | ------------------------ |
| 4   | 0.25rem | `1`      | Border offset            |
| 8   | 0.5rem  | `2`      | Icon gap, tag padding    |
| 12  | 0.75rem | `3`      | Input padding-x          |
| 16  | 1rem    | `4`      | Button padding, card gap |
| 20  | 1.25rem | `5`      | Form field gap           |
| 24  | 1.5rem  | `6`      | Card padding             |
| 32  | 2rem    | `8`      | Small section gap        |
| 40  | 2.5rem  | `10`     | Section padding          |
| 48  | 3rem    | `12`     | Navbar height            |
| 64  | 4rem    | `16`     | Block spacing            |
| 80  | 5rem    | `20`     | Hero padding             |
| 96  | 6rem    | `24`     | Section break            |
| 128 | 8rem    | `32`     | Page section spacing     |

### Component Sizing

| Element       | Allowed sizes (px)     |
| ------------- | ---------------------- |
| Icon          | 16, 24, 32, 40, 48     |
| Button height | 32, 40, 48, 56         |
| Input height  | 36, 40, 48             |
| Border radius | 4, 8, 12, 16, 24       |
| Avatar        | 24, 32, 40, 48, 64, 80 |

### Section Spacing

| Context | Padding top/bottom | Gap between sections |
| ------- | ------------------ | -------------------- |
| Desktop | 80–120px           | 64–96px              |
| Mobile  | 48–64px            | 48–64px              |

Card inner padding: 24px. Label-to-input gap: 6–8px. Label-to-input gap must always be smaller than gap between two separate fields.

---

## Grid & Layout

### Column Grid

| Breakpoint       | Columns | Gutter | Margin |
| ---------------- | ------- | ------ | ------ |
| Mobile < 768px   | 4       | 16px   | 16px   |
| Tablet ≥ 768px   | 8       | 24px   | 24px   |
| Desktop ≥ 1280px | 12      | 32px   | 40px   |

### Container Max-Width

| Layout            | max-width | When                   |
| ----------------- | --------- | ---------------------- |
| Reading/Blog      | 680px     | Articles, docs         |
| Marketing/Landing | 1200px    | Landing pages, pricing |
| App/Dashboard     | 1440px    | Dashboards, tools      |
| Map/Canvas        | 100%      | Full-bleed editors     |

All containers: `mx-auto px-4`.

### Responsive

Mobile-first always. Default CSS = mobile. Use `md:`, `lg:`, `xl:` to scale up. Never use max-width media queries.

---

## Color System

### Format by Stack

| Stack                            | Format    |
| -------------------------------- | --------- |
| Tailwind CSS                     | `oklch()` |
| UI Libraries (MUI, Chakra, etc.) | `hsl()`   |

Never mix formats in the same project. Never use primitive color values directly in components — always use semantic CSS custom properties.

### Semantic Colors — Required

| Semantic     | Color        | Use                                    |
| ------------ | ------------ | -------------------------------------- |
| Error/Danger | Red          | Validation errors, destructive actions |
| Warning      | Yellow/Amber | Non-critical alerts, limits            |
| Success      | Green        | Confirmations, active status           |
| Info         | Blue         | Guidance, neutral messages             |

Each must have foreground, background, and border variants.

### Dark Mode Rules

- Never pure black `#000000` as background — use dark grey with slight tint
- Reduce saturation + increase lightness for brand colors on dark
- Elevation uses lighter surfaces, not stronger shadows
- Set `color-scheme: dark` on `<html>`

### Contrast (WCAG AA)

| Text type          | Minimum ratio |
| ------------------ | ------------- |
| Normal text < 24px | 4.5:1         |
| Large text ≥ 24px  | 3:1           |
| UI components      | 3:1           |

---

## Shadow System

```css
:root {
  --shadow-sm: 0 1px 2px var(--shadow-color, oklch(0 0 0 / 0.05));
  --shadow-md: 0 4px 6px var(--shadow-color, oklch(0 0 0 / 0.07));
  --shadow-lg: 0 10px 15px var(--shadow-color, oklch(0 0 0 / 0.1));
  --shadow-xl: 0 20px 25px var(--shadow-color, oklch(0 0 0 / 0.12));
}
.dark {
  --shadow-color: oklch(0 0 0 / 0.25);
}
```

| Token         | Use                     |
| ------------- | ----------------------- |
| `--shadow-sm` | Flat card               |
| `--shadow-md` | Dropdown, popover       |
| `--shadow-lg` | Modal, elevated card    |
| `--shadow-xl` | Tooltip, floating panel |

Always reference token. Never hardcode shadow values.

---

## Visual Consistency

### Border Radius — pick one style, apply everywhere

| Style     | Radius | Tone             |
| --------- | ------ | ---------------- |
| Sharp     | 0px    | Enterprise, B2B  |
| Rounded   | 4–8px  | Neutral          |
| Pill/Soft | 16px+  | Consumer, mobile |

### Icon System

- One library per project, never mix
- Sizes: 16px (inline small), 20px (inline body), 24px (standalone), 32px (feature), 48px (empty state)

---

## Visual Hierarchy

Every screen: exactly 3 tiers.

| Tier      | Count | Examples                    |
| --------- | ----- | --------------------------- |
| Primary   | 1     | Main heading or primary CTA |
| Secondary | 2–4   | Subheading, supporting info |
| Tertiary  | Rest  | Body text, metadata, links  |

---

## Layout Rules

- Important content: top-left
- Primary CTA on landing pages: bottom-right of hero
- One section = one primary action
- Navigation: maximum 7 items
- Pricing: always 3 plans, highlight middle as "Recommended", show expensive plan first
- Long forms: multi-step wizard, one decision per step
- Advanced options: behind progressive disclosure

### Text Alignment

| Alignment | When                              |
| --------- | --------------------------------- |
| Left      | Default body text                 |
| Center    | Short headings, CTAs, modals only |
| Right     | Currency, dates in tables         |
| Justify   | Never                             |

---

## Component Rules

**Card**: hover state only on clickable cards. Title + description grouped close, button further away.

**Modal**: destructive action left, safe action right. Dark backdrop required.

**Navigation**: active state must differ in background, border, or weight — not color alone. Logo left, actions right.

**Pricing**: 3 plans, middle highlighted, highest price leftmost, free plan feature list truncated.

---

## DO NOT

- Use red/green for decoration — semantic only
- Place two primary buttons adjacent
- Center-align text longer than 2 lines
- Make destructive and safe actions the same visual size
- Animate layout properties (`width`, `height`, `margin`, `padding`)
- Mix icon libraries
- Use arbitrary spacing values outside the 4px grid
- Use placeholder text as a label substitute
- Hardcode shadow or color values in components
