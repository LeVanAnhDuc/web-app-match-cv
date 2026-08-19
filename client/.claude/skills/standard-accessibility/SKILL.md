---
name: standard-accessibility
description: Web accessibility standards targeting WCAG 2.1 AA compliance for HTML/CSS/JS and React (TanStack Start). Use when writing or reviewing any UI component, page layout, form, modal, navigation, or interactive element.
user-invocable: false
---

## Semantic HTML

- Use native HTML elements before reaching for ARIA — `<button>` not `<div onClick>`
- Heading hierarchy must be logical and sequential: `h1` → `h2` → `h3`, never skip levels
- One `<h1>` per page
- Use landmark elements to define page regions

```html
<header>
  <!-- site header, nav -->
  <nav>
    <!-- navigation -->
    <main>
      <!-- primary content, one per page -->
      <aside>
        <!-- supplementary content -->
        <footer>
          <!-- site footer -->
          <section>
            <!-- thematic grouping, needs a heading -->
            <article><!-- self-contained content --></article>
          </section>
        </footer>
      </aside>
    </main>
  </nav>
</header>
```

- `<button>` for actions, `<a>` for navigation — never swap them
- `<a>` must have an `href` — `<a>` without `href` is not keyboard focusable
- Use `<ul>` / `<ol>` for lists of 2+ items — never use `<div>` or `<span>` for list-like content
- Use `<table>` only for tabular data, never for layout

---

## ARIA

Use ARIA only when native HTML cannot achieve the same semantic meaning.

### Required ARIA patterns

```html
<!-- Icon-only buttons must have a label -->
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>

<!-- Decorative images -->
<img src="decoration.png" alt="" />

<!-- Informative images -->
<img src="chart.png" alt="Revenue increased 23% in Q4 2024" />

<!-- Toggle state -->
<button aria-pressed="true">Mute</button>
<button aria-expanded="false" aria-controls="menu-id">Menu</button>

<!-- Invalid form field -->
<input aria-invalid="true" aria-describedby="email-error" />
<span id="email-error" role="alert">Email format is invalid</span>

<!-- Loading state -->
<div aria-live="polite" aria-busy="true">Loading results...</div>

<!-- Hidden from screen readers -->
<span aria-hidden="true">★★★★☆</span>
<span class="sr-only">4 out of 5 stars</span>
```

### ARIA rules

- Never use `aria-label` on non-interactive elements unless they have a role
- `aria-hidden="true"` removes element and all children from accessibility tree — never apply to focusable elements
- `aria-describedby` for supplementary info, `aria-labelledby` for primary label
- Dynamic content that updates without page reload must use `aria-live`

| `aria-live` value | When to use                                        |
| ----------------- | -------------------------------------------------- |
| `polite`          | Non-urgent updates — search results, form feedback |
| `assertive`       | Urgent updates — errors, critical alerts           |
| `off`             | Updates user doesn't need to know about            |

---

## Keyboard Navigation

- All interactive elements must be reachable and operable via keyboard alone
- Tab order must follow visual reading order (top-left to bottom-right)
- Never use `tabindex` > 0 — it breaks natural tab order
- `tabindex="0"` only when making a non-interactive element focusable (rare)
- `tabindex="-1"` for programmatic focus only (e.g. focus trap in modal)

### Keyboard interactions by component

| Component         | Required keyboard behavior                              |
| ----------------- | ------------------------------------------------------- |
| Button            | `Enter`, `Space` activates                              |
| Link              | `Enter` activates                                       |
| Checkbox          | `Space` toggles                                         |
| Radio group       | `Arrow` keys move between options                       |
| Select / Dropdown | `Arrow` keys navigate, `Enter` selects, `Escape` closes |
| Modal             | `Escape` closes, focus trapped inside while open        |
| Tab panel         | `Arrow` keys switch tabs                                |
| Tooltip           | Appears on focus, dismissed with `Escape`               |
| Date picker       | `Arrow` keys navigate dates                             |

---

## Focus Management

- Visible focus indicator required on all interactive elements — never `outline: none` without a replacement
- Focus indicator: minimum 3:1 contrast ratio against adjacent colors, minimum 2px outline

```css
/* Never */
:focus {
  outline: none;
}

/* Acceptable — custom focus style */
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

- On modal open: move focus to first focusable element inside modal
- On modal close: return focus to the element that triggered the modal
- On route change (TanStack Router): move focus to `<main>` or the page heading
- Focus trap in modals: Tab cycles through focusable elements inside, never escapes to background

### Skip navigation

Every page must have a skip link as the first focusable element:

```html
<a href="#main-content" class="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content">...</main>
```

---

## Color & Contrast

WCAG 2.1 AA minimum contrast ratios:

| Text type                              | Ratio |
| -------------------------------------- | ----- |
| Normal text (< 24px or < 18px bold)    | 4.5:1 |
| Large text (≥ 24px or ≥ 18px bold)     | 3:1   |
| UI components, icons, focus indicators | 3:1   |

- Never convey information by color alone — always pair with text, icon, or pattern
- Error states: red color + error icon + error text (not red border alone)
- Disabled elements are exempt from contrast requirements but must still look disabled

```html
<!-- Bad — color only -->
<span style="color: red">Required</span>

<!-- Good — color + text indicator -->
<span style="color: red" aria-hidden="true">*</span>
<span class="sr-only">Required</span>
```

---

## Forms

- Every input must have a visible `<label>` — never use `placeholder` as a label substitute
- `<label>` must be programmatically associated via `for`/`id` or wrapping

```html
<!-- Explicit association -->
<label for="email">Email address</label>
<input id="email" type="email" name="email" />

<!-- Implicit association -->
<label>
  Email address
  <input type="email" name="email" />
</label>
```

- Required fields: use `required` attribute + visual indicator (not asterisk alone)
- Validation errors: use `aria-invalid="true"` + `aria-describedby` pointing to error message
- Error messages must appear inline, below the field — not at top of form only
- Group related inputs with `<fieldset>` + `<legend>` (radio groups, checkboxes)
- `autocomplete` attribute required on common fields: `name`, `email`, `tel`, `new-password`, `current-password`, `street-address`

```html
<fieldset>
  <legend>Notification preference</legend>
  <label><input type="radio" name="notify" value="email" /> Email</label>
  <label><input type="radio" name="notify" value="sms" /> SMS</label>
</fieldset>
```

---

## Images & Media

- All `<img>` must have `alt` attribute — empty string `alt=""` for decorative images
- Alt text describes the purpose, not the appearance: "Bar chart showing 23% revenue increase" not "image of a chart"
- SVG used as content: add `role="img"` + `<title>` inside SVG
- SVG used as decoration: `aria-hidden="true"`
- Video must have captions (auto-generated captions do not count as WCAG-compliant)
- Audio must have transcript
- Never use images of text — use real text with CSS styling

---

## Motion & Animation

- All animations must respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- Auto-playing animations that last more than 5 seconds must have pause/stop control
- Never use flashing content with frequency 3Hz or more (seizure risk)

---

## React / TanStack Start Specific

### Component rules

- Prefer native HTML elements — `<button>` not `<div role="button">`
- Pass `aria-*` props through to underlying DOM elements in custom components
- Never swallow `aria-label`, `aria-describedby`, `id` props in wrapper components

```tsx
// Bad — aria-label is lost
function Button({ children, ...props }) {
  return <div onClick={props.onClick}>{children}</div>;
}

// Good — passes through all aria/html attributes
function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}
```

### Dynamic content

- Use `aria-live` regions for content that updates without navigation
- Wrap async status messages in a live region mounted at app root

```tsx
// App root — always present in DOM
<div
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
  id="announcer"
/>;

// Announce updates programmatically
document.getElementById("announcer").textContent =
  "Search results updated. 12 items found.";
```

### Route changes (TanStack Router)

- On every route change, move focus to `<main>` or the page `<h1>`
- Announce route change to screen readers via a live region

```tsx
// e.g. in a root-level effect keyed to the current location
import { useLocation } from "@tanstack/react-router";

const location = useLocation();
useEffect(() => {
  const heading = document.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  }
}, [location.pathname]);
```

### Modal / Dialog

- Use `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing to dialog title
- Implement focus trap — Tab/Shift+Tab cycles within dialog only
- Return focus to trigger element on close

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm deletion</h2>
  ...
</div>
```

---

## Screen Reader Only Utility

Required in every project:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Use `.sr-only` for: skip links (visible on focus), supplementary labels, status announcements, icon button labels.

---

## DO NOT

- Use `<div>` or `<span>` for interactive elements — use `<button>` or `<a>`
- Remove focus outline without providing a visible replacement
- Use `tabindex` > 0
- Use placeholder text as the only label for an input
- Convey information with color alone
- Apply `aria-hidden="true"` to focusable elements
- Auto-play video or audio with sound
- Use images of text
- Skip heading levels (h1 → h3)
- Use `<table>` for layout
- Rely on auto-generated captions for video compliance
- Use `aria-label` on non-interactive, non-landmark elements

---

## Code Review Checklist

### Blocking

- [ ] Interactive element not reachable by keyboard
- [ ] `<input>` missing associated `<label>`
- [ ] `outline: none` with no replacement focus style
- [ ] Color used as the only means to convey information
- [ ] `aria-hidden="true"` on focusable element
- [ ] Image missing `alt` attribute
- [ ] Modal missing focus trap
- [ ] `<div>` or `<span>` used for button/link behavior
- [ ] Heading levels skipped

### Warning

- [ ] Contrast ratio below 4.5:1 for normal text or 3:1 for large text / UI
- [ ] `tabindex` > 0 used
- [ ] Dynamic content update without `aria-live` region
- [ ] Icon-only button missing `aria-label`
- [ ] Form error not linked to field via `aria-describedby`
- [ ] `aria-invalid` not set on invalid field
- [ ] Animation missing `prefers-reduced-motion` handling
- [ ] Route change missing focus management (TanStack Router)
- [ ] `autocomplete` missing on common form fields

### Suggestion

- [ ] `<section>` or `<article>` missing a heading
- [ ] Radio/checkbox group missing `<fieldset>` + `<legend>`
- [ ] Skip navigation link missing
- [ ] SVG content missing `role="img"` + `<title>`
- [ ] Custom component not forwarding `aria-*` props to DOM element

---

## A11y Baseline Patterns (MANDATORY on every UI build)

`lint`/`tsc`/`format` pass ≠ a11y pass — không có lint rule nào catch `aria-pressed`, `aria-current`, `scope`, `caption`, label association. Manual audit theo checklist dưới là **required** trước khi finalize feature.

Khi user hỏi "có a11y chưa" — câu trả lời mặc định nếu không proactive audit là **"chưa đủ"**. Pre-empt bằng cách audit ngay khi finalize feature, không chờ user hỏi.

### Quick-fix table

| Pattern                                                                                  | Rule                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Decorative icon (Lucide trong button có text, gradient bg, rating row, dropdown chevron) | `aria-hidden="true"` (Lucide không tự thêm)                                                                               |
| Icon-only button                                                                         | `aria-label="..."` mô tả action (không phải tên icon)                                                                     |
| Toggle button (chip filter, view mode, heart, segmented)                                 | `aria-pressed={isActive}`                                                                                                 |
| Pagination current page                                                                  | `aria-current="page"`                                                                                                     |
| Search input                                                                             | `<label>` wrap + `<span class="sr-only">` HOẶC `aria-label` — KHÔNG dựa placeholder (placeholder không phải label hợp lệ) |
| Table                                                                                    | `<caption class="sr-only">` + `scope="col"` trên `<th>` + `aria-labelledby` tới heading external nếu có                   |
| Card click / clickable surface                                                           | `<button type="button">` (hoặc `<CustomButton>`) — KHÔNG `<div onClick>` (mất tab order + Enter/Space activate)           |
| Section landmark                                                                         | `<section aria-labelledby="...">` link tới `<h2 id="...">` để region landmark có accessible name                          |
| Pagination / toolbar wrapper                                                             | `<nav aria-label="...">` HOẶC `role="toolbar" aria-label="..."`                                                           |
| List of items (Recently Used groups, Weekly activity bars, …)                            | `<ul>` + `<li>` cho list-like content — không `<div>` (SR không announce "list of N items")                               |
| Emoji decorative ("👋", "🔥")                                                            | `<span aria-hidden="true">🔥</span>` (SR sẽ đọc "fire" / "waving hand sign" dài dòng nếu không hide)                      |
| Status conveyed by color + text (success dot + label)                                    | Dot phải `aria-hidden="true"` (text đã đủ context, đọc dot là duplicate)                                                  |
| Number-with-context (rating, metric)                                                     | `<span class="sr-only">Rating: </span>4.7` để SR đọc "Rating: 4.7" thay vì "4 point 7"                                    |

### Process

- Khi build component mới, đọc `.claude/skills/standard-accessibility/SKILL.md` + `.claude/rules/accessibility.md` **TRƯỚC** khi viết JSX, không phải sau.
- "Pre-existing pages cũng dùng pattern này" → **KHÔNG** phải excuse. Phải chủ động fix khi thêm code mới.
- Focus của build phase thường là "match design" (visual + interaction) → semantic layer bị bỏ quên. Audit theo bảng trên trước khi merge.

---

## Silent Disabled — Mọi disable phải kèm explainer

Disable = **2 nửa**: gate hành động + giải thích lý do. Thiếu nửa thứ 2 = UX broken + vi phạm WCAG 3.3.1 (Error Identification), 3.3.3 (Error Suggestion), 4.1.2 (Name, Role, Value).

User KHÔNG biết business rule ("phải verify email", "chưa đủ credit", "form còn field invalid section trên"). Mọi disable đều cần explainer trừ khi lý do hiển nhiên 100% từ visual liền kề.

### Quick-fix table

| Tình huống disable                                | Bắt buộc kèm theo                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submit button vì form invalid                     | `<Tooltip>` liệt kê field thiếu HOẶC inline helper text + `aria-describedby` link tới helper                                                                                                            |
| Button loading/pending                            | `<Tooltip>` "Đang xử lý..." HOẶC spinner trong button + `aria-busy="true"` + `aria-label="..., loading"`                                                                                                |
| Button countdown (Resend OTP, retry)              | Hiển thị countdown ngay trong button text (`Gửi lại (30s)`) — explainer inline, không cần tooltip riêng                                                                                                 |
| Button thiếu permission                           | `<Tooltip>` "Bạn không có quyền thực hiện hành động này" + `aria-describedby`                                                                                                                           |
| Business rule (chưa verify, chưa đủ credit, lock) | `<Tooltip>` mô tả rule + CTA fix nếu có ("Verify email để mở khóa")                                                                                                                                     |
| Filter/select dataset rỗng                        | `<Tooltip>` "Không có dữ liệu để lọc" HOẶC empty state message thay thế                                                                                                                                 |
| Menu item trong dropdown                          | Tooltip không khả thi (dropdown đóng khi hover ra) → inline subtext: `<DropdownMenuItem disabled><span>Xóa</span><span class="text-xs text-muted-foreground">Cần quyền admin</span></DropdownMenuItem>` |
| Card / row action                                 | Tooltip trên action button trong card. **KHÔNG** disable cả card (giữ card clickable cho navigate)                                                                                                      |

### Pattern: `aria-disabled` thay vì `disabled` HTML attribute

`disabled` HTML attribute remove element khỏi tab order → keyboard user không focus được → tooltip on-focus không trigger → mất explainer.

`aria-disabled="true"` vẫn focusable, vẫn nhận pointer event → tooltip trigger được, SR announce "dimmed/disabled" + đọc tiếp `aria-describedby`. Cần manual block action trong handler (early return).

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    {/* Bọc span vì disabled button không nhận pointer event → tooltip không trigger */}
    <span tabIndex={0} aria-describedby="submit-reason">
      <CustomButton
        type="submit"
        aria-disabled={!isValid || isSubmitting}
        onClick={(e) => {
          if (!isValid || isSubmitting) {
            e.preventDefault();
            return;
          }
          handleSubmit();
        }}
      >
        Gửi
      </CustomButton>
    </span>
  </TooltipTrigger>
  <TooltipContent id="submit-reason">
    {!isValid && "Vui lòng điền đầy đủ thông tin"}
    {isSubmitting && "Đang xử lý..."}
  </TooltipContent>
</Tooltip>
```

**Trade-off:** form native submit không tự block với `aria-disabled` → phải check trong `onSubmit` của form. Button không phải submit chỉ cần check trong `onClick`.

### Khi nào KHÔNG cần explainer (redundant)

- Pagination "Previous" ở page 1, "Next" ở last page với page indicator hiển thị ngay cạnh
- Stepper step chưa tới (visual + số bước rõ ràng)
- "Sold out" option trong product variant với crossed-out style + label

→ Quy tắc: **explainer = redundant** chỉ khi visual liền kề (≤ 1 element xa) đã chứa lý do. Còn lại đều phải có.

### Pre-empt audit

- Khi gõ `disabled={...}` hoặc `aria-disabled={...}` → dừng, hỏi "user nhìn thấy element xám này → có biết lý do không?". Không 100% rõ → wrap Tooltip hoặc add helper text.
- Khi finalize feature: grep `disabled=\{|aria-disabled=\{` toàn folder feature, list từng case + lý do, verify có explainer. Checklist ngang hàng với a11y audit + color audit.
- Khi review: grep `disabled=\{|aria-disabled=\{` trong `views/**/*.tsx` + `components/**/*.tsx` → mỗi hit phải có explainer kèm.
