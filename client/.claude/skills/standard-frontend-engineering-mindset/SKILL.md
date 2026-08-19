---
name: standard-frontend-engineering-mindset
description: Language-agnostic frontend engineering principles covering browser rendering pipeline, Core Web Vitals, rendering strategies, performance, accessibility, progressive enhancement, and JavaScript main thread management. Load alongside any framework-specific skill. Use when designing UI architecture, making rendering strategy decisions, reviewing frontend code for performance or accessibility, or reasoning about user experience quality.
see-also: standard-accessibility, standard-uiux, standard-coding-universal, standard-react, standard-tanstack-start, standard-antd, standard-tailwind
user-invocable: false
---

> Sources: MDN Web Docs, web.dev (Google), Chrome Developers, Vercel Engineering Blog, W3C WCAG 2.1, Core Web Vitals documentation (Google Search Central).

---

## The Core Job of a Frontend

> "The fundamental job of a frontend is to deliver a fast, accessible, and usable interface to every user, on every device, on every network condition. Everything else is an implementation detail."

Every frontend decision — rendering strategy, JavaScript loading, CSS architecture, state management — should be evaluated against: does it make the interface faster, more accessible, or more resilient for real users?

**The user is not you.** The user may be on a 3G network, a 5-year-old Android phone, using a screen reader, or in a dark environment. Design for the worst-case user, not the best-case demo.

---

## The Browser Rendering Pipeline

Understanding this pipeline is what separates framework users from frontend engineers. Every performance problem can be traced to one of these stages.

```
HTML bytes → DOM
CSS bytes  → CSSOM
             ↓
DOM + CSSOM → Render Tree (visible elements only)
             ↓
          Layout  (position and size of each element)
             ↓
           Paint  (fill pixels: color, image, shadow)
             ↓
       Composite  (combine layers → GPU → screen)
```

### What blocks what

- **CSS blocks rendering** — the browser cannot build the Render Tree until CSSOM is complete. Every CSS file in `<head>` is render-blocking by default
- **JavaScript blocks DOM parsing** — a `<script>` without `defer` or `async` halts HTML parsing, executes immediately, and may modify DOM/CSSOM before continuing
- **Fonts block text rendering** — web fonts delay text paint (FOIT: Flash of Invisible Text / FOUT: Flash of Unstyled Text)

### Pipeline cost by operation

| Operation           | Cost    | Triggered by                                          |
| ------------------- | ------- | ----------------------------------------------------- |
| **Layout (Reflow)** | Highest | `width`, `height`, `margin`, `top`, `left`, `padding` |
| **Paint**           | Medium  | `color`, `background`, `box-shadow`, `border`         |
| **Composite**       | Lowest  | `transform`, `opacity`                                |

**Rule**: Animate only `transform` and `opacity`. Animating layout properties causes reflow on every frame, which at 60fps means ~16ms budget per frame — easily exceeded.

### Layout thrashing (forced synchronous layout)

Reading a layout property immediately after writing one forces the browser to flush and recalculate layout synchronously:

```js
// ❌ Layout thrashing — browser must recalculate on every read
elements.forEach((el) => {
  const height = el.offsetHeight; // triggers layout
  el.style.height = height + 10 + "px"; // invalidates layout
});

// ✅ Batch reads before writes
const heights = elements.map((el) => el.offsetHeight); // read all
elements.forEach((el, i) => (el.style.height = heights[i] + 10 + "px")); // write all
```

---

## Core Web Vitals (CWV)

Google's user-centric performance metrics. Poor CWV = lower SEO ranking + worse user experience.

| Metric                              | Target  | Measures                                                             |
| ----------------------------------- | ------- | -------------------------------------------------------------------- |
| **LCP** (Largest Contentful Paint)  | < 2.5s  | When the largest visible content element renders                     |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness to all user interactions (replaced FID in March 2024) |
| **CLS** (Cumulative Layout Shift)   | < 0.1   | Visual stability — how much content shifts during load               |

### LCP — make the hero render fast

- The LCP element is almost always: hero image, heading, or above-fold text block
- Preload the LCP resource: `<link rel="preload" as="image" href="hero.webp" fetchpriority="high">`
- Never lazy-load the LCP element — `loading="lazy"` on the hero image is a direct LCP killer
- Minimize server response time (TTFB < 600ms)
- Eliminate render-blocking CSS and JS above the fold

### INP — keep the main thread free

INP measures the delay between user input (click, tap, keypress) and the next frame being painted. Every long task > 50ms on the main thread is an INP risk.

- Break long tasks using `scheduler.yield()` or `setTimeout(0)`
- Defer non-critical JavaScript: `<script defer>` or dynamic `import()`
- Move heavy computation off the main thread to Web Workers
- Never run synchronous operations > 50ms during user interaction handlers

### CLS — reserve space for everything

- Always set explicit `width` and `height` on `<img>` and `<video>` elements
- Reserve space for ads, embeds, and async-loaded content before they arrive
- Never inject content above existing content after page load
- Fonts: use `font-display: swap` to prevent invisible text during font load

---

## Rendering Strategies — Choose Per Route, Not Per App

No single strategy fits all pages. Choose based on: content freshness, SEO needs, personalization, and interactivity.

| Strategy                                  | How                                          | When to use                                                          |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **SSG** (Static Site Generation)          | HTML built at build time                     | Blogs, docs, marketing pages, content that rarely changes            |
| **ISR** (Incremental Static Regeneration) | Static HTML, revalidated on a schedule       | E-commerce product pages, news portals, content updated periodically |
| **SSR** (Server-Side Rendering)           | HTML generated per request                   | Real-time data, personalized content, SEO-critical dynamic pages     |
| **CSR** (Client-Side Rendering)           | HTML shell, JS renders in browser            | Authenticated dashboards, real-time tools, no-SEO interactive apps   |
| **Streaming SSR**                         | HTML sent in chunks progressively            | Content-heavy pages with nested data fetching                        |
| **RSC** (React Server Components)         | Components render on server, ship minimal JS | Reduce client bundle, move data fetching to server                   |

### Decision rules

```
Is this page SEO-critical or needs fast initial load?
  → Never use CSR-only

Does the content change often (< 1 hour)?
  → SSR or ISR with short revalidation

Does the content change rarely (daily/weekly)?
  → SSG or ISR with long revalidation

Is the content personalized per user?
  → SSR or CSR (never SSG)

Is this behind a login?
  → CSR is fine (no SEO needed)

Does this page have deeply nested data fetching?
  → Streaming SSR with Suspense boundaries
```

### Lean toward static, earn dynamic

`SSG > ISR > SSR > CSR` in terms of performance and scalability. Start static, add dynamism only where required. "We might need dynamic data someday" is not a reason to use SSR.

---

## JavaScript — Treat as a Cost, Not a Default

JavaScript is the most expensive resource on the web: it must be downloaded, parsed, compiled, and executed — all on the main thread.

### Loading strategies

```html
<!-- Blocks parsing — only for critical inline scripts -->
<script>
  /* inline critical JS */
</script>

<!-- Deferred — downloads in parallel, executes after HTML parsed -->
<script defer src="app.js"></script>

<!-- Async — downloads in parallel, executes immediately when ready -->
<script async src="analytics.js"></script>

<!-- Dynamic import — load only when needed -->
const { chart } = await import('./chart.js')
```

- Default to `defer` for all external scripts
- `async` only for scripts with no dependencies and no DOM interaction (analytics, ads)
- Code-split by route — users should not download JavaScript for pages they haven't visited
- Dynamic import heavy components: editors, charts, date pickers, maps

### JavaScript budget

Set a JavaScript size budget per page and enforce it in CI. A common budget:

- Mobile: 150KB compressed JS for initial load
- Desktop: 300KB compressed JS for initial load

Over-budget JS is a deliberate choice requiring justification, not an accident.

### What belongs on the server vs client

| Server            | Client                  |
| ----------------- | ----------------------- |
| Data fetching     | Event handlers          |
| Business logic    | Local UI state          |
| Auth checks       | Animations              |
| Heavy computation | Real-time updates       |
| Static content    | User-specific rendering |

---

## Progressive Enhancement

Build in layers. Start with the minimum that works for everyone, then enhance for capable environments.

```
Layer 1: Semantic HTML → works everywhere, accessible by default
Layer 2: CSS → layout, visual design, basic interaction (hover, focus)
Layer 3: JavaScript → enhanced interactivity, animations, dynamic behavior
```

- Core functionality must work without JavaScript
- CSS must not be required for the page to be readable
- JavaScript enhancements degrade gracefully if they fail or are blocked

This is not about supporting IE — it is about resilience. If a script fails to load, the user can still read the content and submit the form.

---

## Performance — Measure First, Optimize Second

Never optimize what you haven't measured. Browser DevTools Performance tab and Lighthouse are the first stops.

### Resource loading

- **Preload** critical resources that are discovered late: `<link rel="preload">`
- **Prefetch** resources needed on the next navigation: `<link rel="prefetch">`
- **Lazy load** all below-fold images: `loading="lazy"`
- **Never lazy load** above-fold content or the LCP element

### Images

- Use WebP or AVIF with `<picture>` fallback
- Always set `width` and `height` to prevent CLS
- Serve responsive images with `srcset` + `sizes`
- Hero image: `loading="eager"` + `fetchpriority="high"`
- Target: standard images < 100KB, hero images < 200KB

### Fonts

```html
<!-- Preconnect to font host -->
<link rel="preconnect" href="https://fonts.googleapis.com" />

<!-- Preload critical font -->
<link
  rel="preload"
  href="/fonts/Inter.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

```css
/* Prevent invisible text during load */
@font-face {
  font-display: swap;
}
```

### CSS

- Inline critical CSS (above-fold styles) in `<head>` — avoids render-blocking external CSS request for initial paint
- Load non-critical CSS asynchronously or defer
- Avoid `@import` in CSS files — creates serial request chains
- Use `contain: layout style paint` on isolated components to scope reflow

### Caching

- Static assets (JS, CSS, images): long cache + content hash in filename (`app.abc123.js`)
- HTML: short cache or no-cache (content changes)
- API responses: `Cache-Control` headers per endpoint based on freshness needs
- Service Worker for offline capability and asset precaching

---

## Accessibility — Not Optional

> "Accessible frontend development is simply quality frontend development." — 2026 frontend engineering consensus

Accessibility is a legal requirement in many jurisdictions (WCAG 2.1 AA minimum, EU Accessibility Act 2025). It is also a performance concern: semantic HTML is smaller and renders faster than div-soup.

### Core rules

- Semantic HTML first — `<button>`, `<a>`, `<nav>`, `<main>`, `<article>` before any `<div role="...">`
- Every interactive element reachable and operable by keyboard alone
- All `<img>` must have `alt` — empty `alt=""` for decorative images
- Color must never be the only means to convey information
- Visible focus indicator required on all interactive elements — never `outline: none` without a visible replacement
- Form `<input>` must always have an associated `<label>` — never use placeholder as label substitute

### ARIA — use only when native HTML cannot achieve the semantic

```html
<!-- Only when needed — icon-only button -->
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>

<!-- Dynamic content update -->
<div aria-live="polite" aria-atomic="true">
  <!-- Screen reader announces changes here -->
</div>
```

### Automated tests catch only 30–40% of accessibility issues

Manual testing with keyboard navigation and a screen reader (VoiceOver, NVDA) is required. Automated tools are a starting point, not a finish line.

---

## State Management — Keep It Local

State that doesn't need to be shared should not be shared. Unnecessary global state is a performance and maintainability problem.

```
Component local state    → default choice for UI state
Lifted / shared state    → when sibling components need the same state
Context / store          → when many components across the tree need the same state
Server state (cache)     → API responses, never stored in client state managers
URL state                → filters, pagination, search — makes state shareable and bookmarkable
```

**Server state is not client state.** Data from APIs belongs in a data-fetching layer (React Query, SWR, Apollo) with caching, revalidation, and deduplication — not in Redux or Zustand.

---

## Security Baseline

- Never trust user-generated content in the DOM — always sanitize before `innerHTML` or `dangerouslySetInnerHTML`
- Content Security Policy (CSP) header on all responses — restricts script sources
- `rel="noopener noreferrer"` on all `target="_blank"` links
- Never store tokens in `localStorage` — use httpOnly cookies for sensitive tokens
- Never expose API keys in client-side JavaScript

---

## The Fallacies of Frontend

- **"I'll optimize performance later"** — performance is a design constraint, not a post-launch task. Retrofitting performance is 10x harder than building it in
- **"Accessibility is for disabled users only"** — captions help users in noisy environments; keyboard navigation helps power users; high contrast helps users in sunlight; ~15% of people have a disability
- **"More JavaScript = more features"** — JavaScript is the most expensive resource per byte. More JS means slower interaction, higher INP, worse mobile experience
- **"SSR is always better for performance"** — SSR without caching is slower than well-configured SSG. SSR adds server latency; SSG adds CDN speed
- **"Our users all have fast devices"** — median Android phone globally has 2–4GB RAM and mid-range CPU. Test on real devices, not your MacBook Pro
- **"The framework will handle performance"** — frameworks give you the tools. Poor rendering choices, large bundles, and layout-triggering animations are still your responsibility

---

## DO NOT

- Lazy load the LCP element or any above-fold image
- Animate `width`, `height`, `margin`, `top`, `left` — use `transform` instead
- Read layout properties (`.offsetHeight`, `.getBoundingClientRect()`) inside a write loop
- Block the main thread with synchronous operations > 50ms during user interaction
- Ship JavaScript for routes the user hasn't visited
- Use `div` and `span` for interactive elements — use `<button>` and `<a>`
- Remove focus outlines without providing a visible replacement
- Hardcode image dimensions as 0 or omit them entirely
- Use `localStorage` for authentication tokens
- Inject content above existing content after page load (CLS)
- Use CSR for SEO-critical public pages
- Add JavaScript for behavior that CSS can handle natively

---

## Code Review Checklist

### Blocking

- [ ] LCP image has `loading="lazy"` or no `fetchpriority="high"`
- [ ] Animation uses layout-triggering property (`width`, `height`, `margin`, `top`)
- [ ] Layout thrashing — layout read inside a write loop
- [ ] Interactive element implemented with `<div>` or `<span>` instead of `<button>` or `<a>`
- [ ] `outline: none` with no visible replacement focus style
- [ ] `<input>` missing associated `<label>`
- [ ] `dangerouslySetInnerHTML` or `innerHTML` without sanitization
- [ ] Auth token stored in `localStorage`
- [ ] `target="_blank"` link missing `rel="noopener noreferrer"`
- [ ] CSR used for SEO-critical public page

### Warning

- [ ] `<img>` missing `width` and `height` attributes (CLS risk)
- [ ] `<img>` not using WebP/AVIF format
- [ ] Web font loaded without `font-display: swap`
- [ ] Heavy component (chart, editor, map) not dynamically imported
- [ ] JavaScript bundle > 150KB compressed for mobile initial load
- [ ] Color used as the only means to convey information
- [ ] ARIA attribute used when native HTML element would suffice
- [ ] Server state stored in client state manager (Redux, Zustand)
- [ ] SSR used where SSG + ISR would be sufficient
- [ ] `@import` used in CSS (creates serial request chain)

### Suggestion

- [ ] LCP resource not preloaded with `<link rel="preload">`
- [ ] Critical font not preloaded
- [ ] Below-fold images missing `loading="lazy"`
- [ ] URL state not used for shareable filters/pagination
- [ ] `contain: layout style paint` not applied to isolated heavy component
- [ ] Service Worker missing for offline capability
- [ ] Lighthouse score not run against final build
