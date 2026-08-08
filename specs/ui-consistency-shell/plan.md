# UI Consistency Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng nhất padding / font / border của sidebar + content bằng semantic token và 2 primitive dùng chung, đồng thời cho sidebar thu/mở được ở desktop và chỉ tô màu item đang active.

**Architecture:** Khai báo 9 semantic color token trong `src/styles.css` (Tailwind 4 `@theme` + override `prefers-color-scheme: dark`) → dựng `PageContainer` + `SectionCard` ở `src/components/` → migrate AppShell/Sidebar và 3 view (Home, DocumentLibrary, Wizard) sang token + primitive. Trạng thái thu/mở sidebar nằm ở Zustand slice `ui`, persist `localStorage`, hydrate sau mount để không vỡ SSR.

**Tech Stack:** TanStack Start (React 19 + Vite), Ant Design 5, Tailwind CSS 4, Zustand, i18next, Vitest, Playwright.

**Spec:** `docs/specs/ui-consistency-shell/design.md`

## Global Constraints

- Worktree: `client/.worktrees/ui-consistency-shell`, `.claude/.worktrees/ui-consistency-shell`, `docs/.worktrees/ui-consistency-shell` — branch `refactor/ui-consistency-shell`. TUYỆT ĐỐI không commit trên `main`.
- Convention FE: đọc `client/.claude/CLAUDE.md` + rule `component-folder`, `components`, `views`, `stores`, `locales`, `imports`, `jsx` trước khi sửa `client/src/**`.
- Mỗi component = 1 folder + `index.tsx`, arrow function, **đúng 1** `export default`, props viết inline tại tham số (KHÔNG `type Props`).
- Interactive element dùng antd (`Button`, `Tooltip`, `Skeleton`…), KHÔNG raw `<button>`.
- Import cross-layer dùng alias `#/`; type-only dùng `import type` (`verbatimModuleSyntax` bật).
- Mọi text hiển thị đi qua `t(...)`; key phải có ĐỦ ở cả `src/locales/en/translation.json` và `src/locales/vi/translation.json`.
- Màu surface/border/text trong `src/views/**` và `src/components/**` phải dùng token mới (`bg-surface`, `border-line`, `text-body`…) — KHÔNG hard-code `slate-*` cho các vai trò này. Màu semantic khác (green/amber/red/blue của report) giữ nguyên.
- Mobile-first: base = mobile, cộng lên `md:`/`lg:`. `p-6` đứng một mình (không có base nhỏ hơn) là mùi lỗi.
- Sau MỌI task chạm code: `yarn format && yarn lint && yarn type-check && yarn test` phải xanh trước khi commit.
- Commit message: Conventional Commits, scope `ui-shell`.

---

## File Structure

**Tạo mới (client):**

| File                                              | Trách nhiệm                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/PageContainer/index.tsx`          | Bọc trang: canh giữa, `max-w-[1600px]`, padding trang                  |
| `src/components/SectionCard/index.tsx`            | Card chuẩn: header/body/footer, biến thể `fill` + `stickyFooter`       |
| `src/components/SectionCard/__tests__/SectionCard.test.tsx` | Test primitive                                                |
| `src/components/PageContainer/__tests__/PageContainer.test.tsx` | Test primitive                                            |
| `src/stores/slices/ui.ts`                         | Zustand slice `ui` — `isSidebarCollapsed` + persist                    |
| `src/stores/slices/__tests__/ui.test.ts`          | Test slice + đọc/ghi localStorage                                      |
| `e2e/ui-consistency-shell/sidebar.e2e.ts`         | E2E scenario 1/4/5a/6/9/11/12                                          |

**Sửa (client):** `src/styles.css` · `src/stores/index.ts` · `src/locales/{en,vi}/translation.json` · `src/views/AppShell/index.tsx` · `src/views/AppShell/components/Sidebar/index.tsx` + test · `src/views/Home/index.tsx` + 3 mains · `src/views/DocumentLibrary/mains/DocumentList/index.tsx` · `src/views/DocumentLibrary/components/DocumentRow/index.tsx` · `src/views/Wizard/index.tsx` · `src/views/Wizard/components/DocumentInputStep/index.tsx` · `src/views/Wizard/mains/{StepReview,StepResult}/index.tsx` · `e2e/home-dashboard-library/library.e2e.ts`

**Sửa (docs / .claude):** `.claude/uiux/frontend-reference.md` · `docs/.superdesign/design-system.md` · `client/.claude/rules/layout-primitives.md` (mới) · `client/.claude/CLAUDE.md`

---

### Task 1: Semantic color token

**Files:**
- Modify: `client/.worktrees/ui-consistency-shell/src/styles.css`

**Interfaces:**
- Produces: utility Tailwind `bg-app`, `bg-surface`, `bg-surface-subtle`, `border-line`, `divide-line`, `text-body`, `text-muted`, `text-faint`, `bg-primary`, `text-primary`, `text-accent` — dùng bởi mọi task sau.

- [ ] **Step 1: Chuẩn bị worktree**

```bash
cd client/.worktrees/ui-consistency-shell
yarn install
```

Nếu `yarn install` báo lock file EPERM/EBUSY trên Windows: đóng process đang giữ file, hoặc chạy lại; xem memory `windows-worktree-yarn-locks`.

- [ ] **Step 2: Thêm token vào `src/styles.css`**

Chèn NGAY SAU dòng `@import "tailwindcss";`:

```css
/*
 * Semantic color tokens (source of truth: .claude/uiux/frontend-reference.md §1).
 * Plain `@theme` — NOT `@theme inline` — so utilities compile to `var(--color-*)`
 * and the dark block below can flip them. `@theme inline` would bake the light
 * value into every utility and break dark mode.
 * Dark switch = `prefers-color-scheme`, same signal Tailwind's `dark:` variant
 * and AntdProvider's algorithm already use (no class-based theme toggle yet).
 */
@theme {
  --color-app: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-subtle: #f8fafc;
  --color-line: #e2e8f0;
  --color-body: #0f172a;
  --color-muted: #64748b;
  --color-faint: #94a3b8;
  --color-primary: #2563eb;
  --color-accent: #2563eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-app: #0f172a;
    --color-surface: #1e293b;
    --color-surface-subtle: #111827;
    --color-line: #334155;
    --color-body: #ffffff;
    --color-muted: #cbd5e1;
    --color-faint: #64748b;
    --color-primary: #4f46e5;
    --color-accent: #818cf8;
  }
}
```

- [ ] **Step 3: Kiểm chứng utility được sinh ra**

Tạo file tạm `src/__token-probe.tsx` (xoá ở step 5):

```tsx
export const Probe = () => (
  <div className="bg-app bg-surface bg-surface-subtle border-line divide-line text-body text-muted text-faint bg-primary text-primary text-accent" />
);
```

Run: `yarn build`
Expected: build PASS. Sau đó kiểm tra CSS output có biến:

```bash
grep -o "\-\-color-surface-subtle" .output/public/assets/*.css | head -1
```

Expected: in ra `--color-surface-subtle`.

- [ ] **Step 4: Xoá file probe**

```bash
rm src/__token-probe.tsx
```

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/styles.css
git commit -m "feat(ui-shell): add semantic color tokens with dark-mode overrides"
```

---

### Task 2: `PageContainer`

**Files:**
- Create: `src/components/PageContainer/index.tsx`
- Test: `src/components/PageContainer/__tests__/PageContainer.test.tsx`

**Interfaces:**
- Produces: `PageContainer` — props `{ children, className? }`; render `<div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 {className}">`.

- [ ] **Step 1: Viết test fail trước**

`src/components/PageContainer/__tests__/PageContainer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageContainer from "../index";

describe("PageContainer", () => {
  it("applies the shared page frame classes", () => {
    render(<PageContainer>body</PageContainer>);

    const frame = screen.getByText("body");
    expect(frame.className).toContain("mx-auto");
    expect(frame.className).toContain("max-w-[1600px]");
    expect(frame.className).toContain("p-4");
    expect(frame.className).toContain("md:p-6");
  });

  it("appends caller classes after the frame classes", () => {
    render(<PageContainer className="space-y-6">body</PageContainer>);

    expect(screen.getByText("body").className).toContain("space-y-6");
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn test src/components/PageContainer`
Expected: FAIL — không resolve được `../index`.

- [ ] **Step 3: Implement**

`src/components/PageContainer/index.tsx`:

```tsx
import type { PropsWithChildren } from "react";

/**
 * Shared page frame — every route body is wrapped in exactly one of these so
 * page width and padding cannot drift per view (design: §4.2). Full-bleed up
 * to 1600px, then centred so text lines stay readable on ultrawide screens.
 */
const PageContainer = ({
  children,
  className = ""
}: PropsWithChildren<{ className?: string }>) => (
  <div className={`mx-auto w-full max-w-[1600px] p-4 md:p-6 ${className}`}>
    {children}
  </div>
);

export default PageContainer;
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `yarn test src/components/PageContainer`
Expected: PASS (2 test).

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/components/PageContainer
git commit -m "feat(ui-shell): add PageContainer primitive"
```

---

### Task 3: `SectionCard`

**Files:**
- Create: `src/components/SectionCard/index.tsx`
- Test: `src/components/SectionCard/__tests__/SectionCard.test.tsx`

**Interfaces:**
- Consumes: token từ Task 1.
- Produces: `SectionCard` — props inline:
  `{ children, title?: ReactNode, description?: ReactNode, extra?: ReactNode, footer?: ReactNode, fill?: boolean, stickyFooter?: boolean, className?: string, bodyClassName?: string }`.
  Header chỉ render khi có `title` hoặc `extra`. Footer chỉ render khi có `footer`.

- [ ] **Step 1: Viết test fail trước**

`src/components/SectionCard/__tests__/SectionCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SectionCard from "../index";

describe("SectionCard", () => {
  it("renders title as a level-2 heading with the shared type scale", () => {
    render(<SectionCard title="Recent matches">body</SectionCard>);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Recent matches");
    expect(heading.className).toContain("text-xl");
    expect(heading.className).toContain("font-bold");
  });

  it("omits the header when there is no title and no extra", () => {
    render(<SectionCard>body</SectionCard>);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders description, extra and footer when provided", () => {
    render(
      <SectionCard
        title="Title"
        description="Sub"
        extra={<span>Extra</span>}
        footer={<span>Foot</span>}
      >
        body
      </SectionCard>
    );

    expect(screen.getByText("Sub")).toBeDefined();
    expect(screen.getByText("Extra")).toBeDefined();
    expect(screen.getByText("Foot")).toBeDefined();
  });

  it("uses the shared surface and border tokens", () => {
    const { container } = render(<SectionCard>body</SectionCard>);

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("border-line");
    expect(card.className).toContain("rounded-xl");
  });

  it("bodyClassName replaces the default body padding", () => {
    render(<SectionCard bodyClassName="p-0">body</SectionCard>);

    const body = screen.getByText("body");
    expect(body.className).toContain("p-0");
    expect(body.className).not.toContain("md:p-6");
  });

  it("fill adds the desktop internal-scroll classes", () => {
    const { container } = render(<SectionCard fill>body</SectionCard>);

    expect((container.firstElementChild as HTMLElement).className).toContain(
      "lg:h-full"
    );
    expect(screen.getByText("body").className).toContain("lg:overflow-y-auto");
  });

  it("stickyFooter pins the footer below lg only", () => {
    render(<SectionCard stickyFooter footer={<span>Foot</span>}>body</SectionCard>);

    const footer = screen.getByText("Foot").parentElement as HTMLElement;
    expect(footer.className).toContain("sticky");
    expect(footer.className).toContain("lg:static");
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn test src/components/SectionCard`
Expected: FAIL — không resolve được `../index`.

- [ ] **Step 3: Implement**

`src/components/SectionCard/index.tsx`:

```tsx
import type { PropsWithChildren, ReactNode } from "react";

/**
 * The one card shape in the app (design: §4.2). Every panel — dashboard tile,
 * library list, wizard step — is a SectionCard so border / surface / padding /
 * heading scale cannot drift per view.
 *
 * `fill` opts into the desktop layout the wizard needs: the card locks to the
 * available height and the body scrolls inside it. `stickyFooter` keeps the
 * primary CTA reachable while the page scrolls below lg.
 */
const SectionCard = ({
  children,
  title,
  description,
  extra,
  footer,
  fill = false,
  stickyFooter = false,
  className = "",
  bodyClassName = "p-4 md:p-6"
}: PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  fill?: boolean;
  stickyFooter?: boolean;
  className?: string;
  bodyClassName?: string;
}>) => (
  <div
    className={`flex flex-col rounded-xl border border-line bg-surface shadow-sm ${
      fill ? "lg:h-full lg:overflow-hidden" : ""
    } ${className}`}
  >
    {(title || extra) && (
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-4 md:px-6 md:py-5">
        <div className="min-w-0">
          {title && <h2 className="text-xl font-bold text-body">{title}</h2>}
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
    )}

    <div
      className={`${bodyClassName} ${
        fill ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : ""
      }`}
    >
      {children}
    </div>

    {footer && (
      <div
        className={`flex shrink-0 items-center justify-between gap-4 border-t border-line bg-surface-subtle px-4 py-4 md:px-6 ${
          stickyFooter
            ? "sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:pb-4"
            : ""
        }`}
      >
        {footer}
      </div>
    )}
  </div>
);

export default SectionCard;
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `yarn test src/components/SectionCard`
Expected: PASS (7 test).

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/components/SectionCard
git commit -m "feat(ui-shell): add SectionCard primitive"
```

---

### Task 4: Nhãn i18n mới

**Files:**
- Modify: `src/locales/en/translation.json`, `src/locales/vi/translation.json`
- Modify: `src/views/AppShell/components/Sidebar/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Produces: key `nav.collapse`, `nav.expand`; giá trị mới cho `nav.home`, `nav.match`, `nav.savedCvs`, `nav.savedJds`, `library.title.cv`, `library.title.jd`, `home.stat.savedCvs`, `home.stat.savedJds`.

- [ ] **Step 1: Cập nhật `src/locales/en/translation.json`**

`nav` thành:

```json
"nav": {
  "home": "Dashboard",
  "match": "CV ↔ JD Matching",
  "savedCvs": "Curriculum Vitae",
  "savedJds": "Job Descriptions",
  "openMenu": "Open menu",
  "collapse": "Collapse sidebar",
  "expand": "Expand sidebar"
}
```

`library.title` thành `{ "cv": "Curriculum Vitae", "jd": "Job Descriptions" }`.
`home.stat.savedCvs` thành `"Curriculum Vitae"`, `home.stat.savedJds` thành `"Job Descriptions"`.

- [ ] **Step 2: Cập nhật `src/locales/vi/translation.json`**

```json
"nav": {
  "home": "Tổng quan",
  "match": "Đối chiếu CV ↔ JD",
  "savedCvs": "Sơ yếu lý lịch",
  "savedJds": "Mô tả công việc",
  "openMenu": "Mở menu",
  "collapse": "Thu gọn thanh bên",
  "expand": "Mở thanh bên"
}
```

`library.title` thành `{ "cv": "Sơ yếu lý lịch", "jd": "Mô tả công việc" }`.
`home.stat.savedCvs` thành `"Sơ yếu lý lịch"`, `home.stat.savedJds` thành `"Mô tả công việc"`.

- [ ] **Step 3: Sửa test đang assert nhãn cũ**

Trong `Sidebar.test.tsx`, đổi 4 assertion thành:

```tsx
expect(await screen.findByRole("link", { name: /dashboard/i })).toBeDefined();
expect(screen.getByRole("link", { name: /cv .* jd matching/i })).toBeDefined();
expect(screen.getByRole("link", { name: /curriculum vitae/i })).toBeDefined();
expect(screen.getByRole("link", { name: /job descriptions/i })).toBeDefined();
```

- [ ] **Step 4: Chạy test**

Run: `yarn test`
Expected: PASS toàn bộ. Nếu `Home.test` / `DocumentLibrary.test` fail vì assert chuỗi cũ → sửa sang chuỗi mới (đây là hành vi mong muốn, không phải bug).

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/locales src/views
git commit -m "feat(ui-shell): clearer nav and library labels in en/vi"
```

---

### Task 5: Zustand slice `ui`

**Files:**
- Create: `src/stores/slices/ui.ts`
- Create: `src/stores/slices/__tests__/ui.test.ts`
- Modify: `src/stores/index.ts`

**Interfaces:**
- Produces: `useUiStore` với `{ isSidebarCollapsed: boolean; toggleSidebar: () => void; hydrateSidebar: () => void }`, export lại qua `src/stores/index.ts`. Key localStorage: `ui.sidebarCollapsed`.

- [ ] **Step 1: Viết test fail trước**

`src/stores/slices/__tests__/ui.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../ui";

const KEY = "ui.sidebarCollapsed";

describe("ui store — sidebar collapse", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.setState({ isSidebarCollapsed: false });
  });

  it("defaults to expanded", () => {
    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
  });

  it("toggle flips the state and persists it", () => {
    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");

    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  // [EP] persisted-value classes: "true" / "false" / "" / garbage / missing
  it.each([
    ["true", true],
    ["false", false],
    ["", false],
    ["maybe", false]
  ])("hydrate with %j yields collapsed=%s", (stored, expected) => {
    window.localStorage.setItem(KEY, stored);

    useUiStore.getState().hydrateSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(expected);
  });

  it("hydrate with no stored key leaves the default", () => {
    useUiStore.getState().hydrateSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn test src/stores`
Expected: FAIL — không resolve được `../ui`.

- [ ] **Step 3: Implement slice**

`src/stores/slices/ui.ts`:

```ts
import { create } from "zustand";

const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";

interface UiState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  hydrateSidebar: () => void;
}

/**
 * Shell UI state. The sidebar starts expanded so SSR and the first client
 * render agree; AppShell calls `hydrateSidebar` in an effect to apply the
 * persisted choice once the DOM is live (design: §4.4).
 */
export const useUiStore = create<UiState>((set, get) => ({
  isSidebarCollapsed: false,

  toggleSidebar: () => {
    const next = !get().isSidebarCollapsed;
    set({ isSidebarCollapsed: next });
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Storage disabled (private mode / quota) — keep the in-memory state.
    }
  },

  hydrateSidebar: () => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      // Anything other than the two known values is treated as absent.
      if (stored === "true" || stored === "false") {
        set({ isSidebarCollapsed: stored === "true" });
      }
    } catch {
      // Storage unreadable — stay expanded.
    }
  }
}));
```

- [ ] **Step 4: Export qua barrel**

`src/stores/index.ts`:

```ts
export { useUiStore } from "./slices/ui";
export { useWizardStore } from "./slices/wizard";
```

- [ ] **Step 5: Chạy test để thấy pass**

Run: `yarn test src/stores`
Expected: PASS (8 test — 4 case của `it.each` + 4 case còn lại).

- [ ] **Step 6: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/stores
git commit -m "feat(ui-shell): add ui store slice for sidebar collapse state"
```

---

### Task 6: Sidebar — item đồng nhất, active-only, rail

**Files:**
- Modify: `src/views/AppShell/components/Sidebar/index.tsx`
- Modify: `src/views/AppShell/components/Sidebar/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: nhãn i18n (Task 4), token (Task 1).
- Produces: `Sidebar` nhận prop inline `{ collapsed?: boolean }` (mặc định `false`). AppShell (Task 7) truyền `collapsed` cho aside và **không** truyền cho Drawer.

- [ ] **Step 1: Viết test fail trước**

Thay toàn bộ `Sidebar.test.tsx` bằng:

```tsx
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "#/i18n/config";
import Sidebar from "../index";

function renderSidebar(collapsed = false, initialPath = "/") {
  const rootRoute = createRootRoute({
    component: () => <Sidebar collapsed={collapsed} />
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] })
  });
  return render(<RouterProvider router={router} />);
}

describe("Sidebar", () => {
  it("renders the 4 nav links with accessible names (en)", async () => {
    renderSidebar();

    expect(await screen.findByRole("link", { name: /dashboard/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /cv .* jd matching/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /curriculum vitae/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /job descriptions/i })).toBeDefined();
  });

  it("marks only the current route as active", async () => {
    renderSidebar(false, "/");

    const active = await screen.findByRole("link", { name: /dashboard/i });
    expect(active.getAttribute("aria-current")).toBe("page");

    for (const name of [/cv .* jd matching/i, /curriculum vitae/i, /job descriptions/i]) {
      expect(screen.getByRole("link", { name }).getAttribute("aria-current")).toBeNull();
    }
  });

  it("gives every idle item the same class string", async () => {
    renderSidebar(false, "/");
    await screen.findByRole("link", { name: /dashboard/i });

    const idle = [/cv .* jd matching/i, /curriculum vitae/i, /job descriptions/i].map(
      (name) => screen.getByRole("link", { name }).className
    );

    expect(new Set(idle).size).toBe(1);
  });

  it("keeps accessible names but hides label text when collapsed", async () => {
    renderSidebar(true, "/");

    const link = await screen.findByRole("link", { name: /curriculum vitae/i });
    expect(link).toBeDefined();
    expect(screen.queryByText("Curriculum Vitae")).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn test src/views/AppShell`
Expected: FAIL — "marks only the current route as active" (chưa có `aria-current`) và "gives every idle item the same class string" (item `prominent` khác class).

- [ ] **Step 3: Implement**

Thay toàn bộ `src/views/AppShell/components/Sidebar/index.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { Tooltip } from "antd";
import { FileText, FileUser, LayoutDashboard, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentType } from "react";

interface NavItem {
  to: string;
  icon: ComponentType<{ size?: number }>;
  labelKey: string;
  exact?: boolean;
}

// Icon mapping per .claude/uiux/icon-map.md (nav/navigation).
const NAV_ITEMS: Array<NavItem> = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav.home", exact: true },
  { to: "/wizard", icon: Sparkles, labelKey: "nav.match" },
  { to: "/cv", icon: FileUser, labelKey: "nav.savedCvs" },
  { to: "/jd", icon: FileText, labelKey: "nav.savedJds" }
];

// All four items share one class string — the ONLY visual difference is the
// active state (design: §4.4). The active bar is a ::before pseudo-element so
// no extra DOM node is needed and Playwright locators stay unambiguous.
const baseClassName =
  "relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors";
const idleClassName = "text-muted hover:bg-surface-subtle hover:text-body";
const activeClassName =
  "bg-primary/10 font-semibold text-accent before:absolute before:top-1/2 before:left-0 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']";

/** Primary nav — shared by the `>=lg` aside and the `<lg` Drawer (AppShell). */
const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { t } = useTranslation();

  return (
    <nav className={`flex flex-col gap-1 py-2 ${collapsed ? "px-2" : "px-4"}`}>
      {NAV_ITEMS.map(({ to, icon: Icon, labelKey, exact }) => {
        const label = t(labelKey);

        const link = (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            aria-label={collapsed ? label : undefined}
            className={`${baseClassName} ${
              collapsed ? "justify-center px-0" : "px-3"
            } ${idleClassName}`}
            activeProps={{
              className: activeClassName,
              "aria-current": "page"
            }}
          >
            <Icon size={20} />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );

        return collapsed ? (
          <Tooltip key={to} title={label} placement="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
};

export default Sidebar;
```

Lưu ý khi implement: TanStack `activeProps.className` được **nối thêm** vào `className`, không thay thế — nên `activeClassName` chỉ chứa phần ghi đè, và `text-accent` phải đứng sau `text-muted` trong output. Nếu thứ tự class khiến màu idle thắng, thêm `!` (important) cho `text-accent` HOẶC bỏ `text-muted` khỏi base và đưa vào một biến thể riêng — chọn cách nào thì ghi comment lý do.

- [ ] **Step 4: Chạy test để thấy pass**

Run: `yarn test src/views/AppShell`
Expected: PASS (4 test).

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/views/AppShell/components/Sidebar
git commit -m "feat(ui-shell): uniform sidebar items with active-only highlight and rail mode"
```

---

### Task 7: AppShell — toggle + width + token

**Files:**
- Modify: `src/views/AppShell/index.tsx`
- Create: `src/views/AppShell/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (Task 5), `Sidebar` prop `collapsed` (Task 6), token (Task 1), `nav.collapse`/`nav.expand` (Task 4).

- [ ] **Step 1: Viết test fail trước**

`src/views/AppShell/__tests__/AppShell.test.tsx`:

```tsx
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "#/i18n/config";
import { useUiStore } from "#/stores";
import AppShell from "../index";

function renderShell() {
  const rootRoute = createRootRoute({
    component: () => <AppShell>page body</AppShell>
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  return render(<RouterProvider router={router} />);
}

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.setState({ isSidebarCollapsed: false });
  });

  it("renders the collapse control expanded by default", async () => {
    renderShell();

    const toggle = await screen.findByRole("button", { name: /collapse sidebar/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggling collapses the sidebar and flips the control label", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole("button", { name: /collapse sidebar/i }));

    const toggle = await screen.findByRole("button", { name: /expand sidebar/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(useUiStore.getState().isSidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem("ui.sidebarCollapsed")).toBe("true");
  });

  it("applies the persisted collapsed state after mount", async () => {
    window.localStorage.setItem("ui.sidebarCollapsed", "true");

    renderShell();

    expect(
      await screen.findByRole("button", { name: /expand sidebar/i })
    ).toBeDefined();
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn test src/views/AppShell/__tests__/AppShell.test.tsx`
Expected: FAIL — không tìm thấy button "Collapse sidebar".

- [ ] **Step 3: Implement**

Thay toàn bộ `src/views/AppShell/index.tsx`:

```tsx
import { Button, Drawer } from "antd";
import { Menu, PanelLeftClose, PanelLeftOpen, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PropsWithChildren } from "react";
import { useUiStore } from "#/stores";
import Sidebar from "./components/Sidebar";

/**
 * App shell: `>=lg` a fixed sidebar that collapses to an icon rail; `<lg` a
 * header with a hamburger opening the same nav in an antd Drawer (the rail is
 * desktop-only — a rail on a narrow viewport buys nothing). `<main>` owns its
 * own scroll so the shell never scrolls horizontally (design: §4.4).
 */
const AppShell = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isCollapsed = useUiStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const hydrateSidebar = useUiStore((s) => s.hydrateSidebar);

  // Read the persisted choice only after mount: reading it during render would
  // make the server HTML (always expanded) disagree with the first client pass.
  useEffect(() => {
    hydrateSidebar();
  }, [hydrateSidebar]);

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <aside
        id="app-sidebar"
        className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
          isCollapsed ? "w-16" : "w-72"
        }`}
      >
        <div
          className={`flex items-center gap-3 px-4 py-4 ${
            isCollapsed ? "flex-col" : ""
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <WandSparkles className="text-white" size={18} />
          </div>
          {!isCollapsed && (
            <span className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-body">
              {t("appName")}
            </span>
          )}
          <Button
            type="text"
            aria-label={t(isCollapsed ? "nav.expand" : "nav.collapse")}
            aria-expanded={!isCollapsed}
            aria-controls="app-sidebar"
            icon={
              isCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )
            }
            onClick={toggleSidebar}
            className="text-muted"
          />
        </div>

        <Sidebar collapsed={isCollapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <Button
            type="text"
            aria-label={t("nav.openMenu")}
            icon={<Menu size={20} />}
            onClick={() => setIsDrawerOpen(true)}
            className="text-muted"
          />
          <span className="truncate text-base font-bold tracking-tight text-body">
            {t("appName")}
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <Drawer
        placement="left"
        closable
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={t("appName")}
        width={256}
        styles={{ body: { padding: 0 } }}
      >
        {/* Always expanded: the rail is a desktop affordance only. */}
        <Sidebar />
      </Drawer>
    </div>
  );
};

export default AppShell;
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `yarn test src/views/AppShell`
Expected: PASS (Sidebar 4 test + AppShell 3 test).

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/views/AppShell
git commit -m "feat(ui-shell): collapsible desktop sidebar with persisted state"
```

---

### Task 8: Migrate Home

**Files:**
- Modify: `src/views/Home/index.tsx`, `src/views/Home/mains/HeroCta/index.tsx`, `src/views/Home/mains/StatCards/index.tsx`, `src/views/Home/mains/RecentMatches/index.tsx`
- Modify (nếu fail): `src/views/Home/__tests__/Home.test.tsx`

**Interfaces:**
- Consumes: `PageContainer`, `SectionCard` (Task 2, 3), token (Task 1).

- [ ] **Step 1: `Home/index.tsx`**

```tsx
import PageContainer from "#/components/PageContainer";
import HeroCta from "./mains/HeroCta";
import RecentMatches from "./mains/RecentMatches";
import StatCards from "./mains/StatCards";

/**
 * Home dashboard — hero CTA into the wizard, stat cards, recent match
 * history. Mock: docs/ui-designs/home-dashboard-library/home.html.
 */
const Home = () => (
  <PageContainer className="space-y-6">
    <HeroCta />
    <StatCards />
    <RecentMatches />
  </PageContainer>
);

export default Home;
```

- [ ] **Step 2: `HeroCta`**

Đổi phần tử ngoài cùng từ `<div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:…">` thành:

```tsx
<SectionCard className="relative overflow-hidden">
```

(import `SectionCard from "#/components/SectionCard"`). Bên trong: `text-slate-900 dark:text-white` → `text-body`; `text-slate-500 dark:text-slate-400` → `text-muted`; icon trang trí `text-slate-100 dark:text-slate-700/30` → `text-line` (giữ `-right-4 -bottom-8 hidden md:block`).

- [ ] **Step 3: `StatCards`**

`StatTile` bỏ antd `Card`, dùng `SectionCard`. Vì `SectionCard` không có prop `loading`, dùng antd `Skeleton`:

```tsx
import { Skeleton, Statistic } from "antd";
import SectionCard from "#/components/SectionCard";

function StatTile({ testId, icon, value, label, subtext, loading }: {
  testId: string;
  icon: React.ReactNode;
  value: string | number;
  label: string;
  subtext?: string;
  loading: boolean;
}) {
  return (
    <SectionCard className="h-full">
      <div data-testid={testId}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : (
          <>
            <div className="mb-4 w-fit rounded-lg bg-surface-subtle p-2 text-muted">
              {icon}
            </div>
            <Statistic value={value} />
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-wider text-faint uppercase">
                {label}
              </span>
              {subtext && (
                <span className="text-xs text-faint italic">{subtext}</span>
              )}
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
```

`data-testid` phải nằm trên phần tử LUÔN render (kể cả khi loading) vì e2e/unit test đang query nó.

- [ ] **Step 4: `RecentMatches`**

Đổi `<Card title={...} className="shadow-sm" extra={...}>` thành:

```tsx
<SectionCard title={t("home.recent.title")} extra={...} bodyClassName="p-0">
```

Bỏ import `Card` khỏi antd. Trong `locale.emptyText`: `text-slate-300 dark:text-slate-600` → `text-faint`, `text-slate-400 dark:text-slate-500` → `text-muted`. Trong `extra`: `text-slate-400 dark:text-slate-500` → `text-faint`.

- [ ] **Step 5: Chạy test**

Run: `yarn test src/views/Home`
Expected: PASS. Nếu fail vì test assert class/nhãn cũ → cập nhật test cho khớp hành vi mới.

- [ ] **Step 6: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/views/Home
git commit -m "refactor(ui-shell): migrate Home to PageContainer + SectionCard"
```

---

### Task 9: Migrate DocumentLibrary

**Files:**
- Modify: `src/views/DocumentLibrary/mains/DocumentList/index.tsx`, `src/views/DocumentLibrary/components/DocumentRow/index.tsx`
- Modify (nếu fail): `src/views/DocumentLibrary/__tests__/DocumentLibrary.test.tsx`

- [ ] **Step 1: `DocumentList` — khung trang**

Đổi wrapper `<div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">` thành `<PageContainer className="space-y-6">`. Header giữ nguyên cấu trúc, đổi màu:

```tsx
<header>
  <h1 className="text-2xl font-bold tracking-tight text-body">
    {t(`library.title.${kindKey}`)}
  </h1>
  {!savedQuery.isLoading && !savedQuery.isError && (
    <p className="mt-1 text-sm text-muted">
      {t("library.subtitle", { count: docs.length })}
    </p>
  )}
</header>
```

- [ ] **Step 2: `DocumentList` — gộp danh sách vào 1 card**

Đổi khối `docs.length > 0 && (<ul className="space-y-3">…</ul>)` thành:

```tsx
{docs.length > 0 && (
  <SectionCard bodyClassName="p-0">
    <ul className="divide-y divide-line">
      {docs.map((doc) => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          deleting={deletingId === doc.id}
          onPreview={() => setPreviewId(doc.id)}
          onRename={() => setRenameTarget(doc)}
          onDelete={() => handleDelete(doc.id)}
        />
      ))}
    </ul>
  </SectionCard>
)}
```

Empty state: `border-slate-300 dark:border-slate-700` → `border-line`; `text-slate-400` → `text-faint`; `text-slate-600 dark:text-slate-300` → `text-body`; `text-slate-500 dark:text-slate-400` → `text-muted`. Error: giữ `text-red-600 dark:text-red-400` (màu semantic, không đổi).

- [ ] **Step 3: `DocumentRow` — bỏ viền riêng**

Đổi `<li className="flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">` thành:

```tsx
<li className="flex items-center gap-4 px-4 py-3 md:px-6">
```

Đổi màu bên trong: icon tile `bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400` → `bg-surface-subtle text-muted`; tiêu đề `text-slate-800 dark:text-slate-100` → `text-body`; ngày `text-slate-500 dark:text-slate-400` → `text-muted`.

- [ ] **Step 4: Chạy test**

Run: `yarn test src/views/DocumentLibrary`
Expected: PASS (test query theo role/text, không theo class — nếu có assert class cũ thì cập nhật).

- [ ] **Step 5: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/views/DocumentLibrary
git commit -m "refactor(ui-shell): migrate DocumentLibrary to shared primitives"
```

---

### Task 10: Migrate Wizard

**Files:**
- Modify: `src/views/Wizard/index.tsx`, `src/views/Wizard/components/DocumentInputStep/index.tsx`, `src/views/Wizard/mains/StepReview/index.tsx`, `src/views/Wizard/mains/StepResult/index.tsx`

- [ ] **Step 1: `Wizard/index.tsx`**

Đổi `<div className="mx-auto flex h-full max-w-5xl flex-col p-4 md:p-8">` thành:

```tsx
<PageContainer className="flex h-full flex-col">
```

- [ ] **Step 2: `DocumentInputStep` → `SectionCard fill stickyFooter`**

Thay khối JSX ngoài cùng (từ `<div className="flex flex-col rounded-xl border border-slate-100 …">` tới `</div>` cuối) bằng:

```tsx
<SectionCard
  fill
  stickyFooter
  title={t(`${stepCopyKey}.title`)}
  description={t(`${stepCopyKey}.description`)}
  footer={
    <>
      <Button
        type="text"
        size="large"
        disabled={!onBack}
        icon={<ArrowLeft size={16} />}
        onClick={onBack}
        className="!text-muted"
      >
        {t("action.back")}
      </Button>
      <Button
        type="primary"
        size="large"
        disabled={!canSubmit}
        loading={isSubmitting || createDocument.isPending}
        onClick={() => void handleNext()}
        iconPosition="end"
        icon={<ArrowRight size={16} />}
      >
        {t("action.next")}
      </Button>
    </>
  }
>
  {/* nội dung body giữ nguyên: UploadPasteTabs, SaveForReuseButton, SavedDocRadioList, validationError */}
</SectionCard>
```

Trong body: eyebrow `text-sm font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500` → `text-xs font-semibold tracking-wider text-faint uppercase`.

- [ ] **Step 3: `StepReview`**

3 nhánh render:

- Nhánh "thiếu doc": `<div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-100 bg-white p-16 shadow-sm dark:…">` → `<SectionCard className="h-full" bodyClassName="flex h-full flex-col items-center justify-center gap-4 p-8 md:p-16">`; text → `text-muted`.
- Nhánh loading: tương tự, `bodyClassName="flex h-full items-center justify-center gap-3 p-8 md:p-16"`; spinner + text → `text-faint`.
- Nhánh chính: `<SectionCard fill title={t("wizard.stepReview.title")} description={t("wizard.stepReview.description")} bodyClassName="p-0" className="h-full" footer={<>…nút Back + Run match…</>}>`, body là grid 2 cột hiện có với `divide-slate-100 dark:divide-slate-700/50` → `divide-line`, mỗi `<section className="flex min-h-0 flex-col p-4 md:p-6">` (bỏ `p-6` desktop-first), eyebrow → thang chữ mới (`text-xs font-semibold tracking-wider text-faint uppercase`), khung preview `border-slate-100 dark:border-slate-700/50` → `border-line`.
- Khối `error`: `px-8 pb-6` → `px-4 pb-4 md:px-6`.

- [ ] **Step 4: `StepResult`**

- Nhánh loading + nhánh lỗi: `rounded-xl border border-slate-100 bg-white p-8 shadow-sm md:p-16 dark:…` → `<SectionCard className="h-full" bodyClassName="flex h-full … p-8 md:p-16">` như StepReview.
- Nhánh chính: khối ngoài cùng → `<SectionCard fill bodyClassName="p-0" className="h-full" footer={…nút hiện có…}>`.
- Đổi màu theo token: `text-slate-900 dark:text-white` → `text-body`; `text-slate-500/600 dark:text-slate-300/400` → `text-muted`; `text-slate-400 dark:text-slate-500` → `text-faint`; `border-slate-100 dark:border-slate-700/50` → `border-line`; `bg-slate-50/50 dark:bg-slate-900/30` → `bg-surface-subtle`; `bg-slate-100 dark:bg-slate-900/50` (icon tile) → `bg-surface-subtle`.
- Eyebrow `text-xs font-semibold tracking-wider text-faint uppercase`.
- **GIỮ NGUYÊN** màu semantic của báo cáo: `text-green-*`, `text-amber-*`, `text-blue-*`/`dark:text-indigo-*`, `bg-blue-50`/`dark:bg-indigo-500/5`, `stroke-blue-600`/`dark:stroke-indigo-500`, `bg-slate-200 dark:bg-slate-900` của thanh progress (đổi thành `bg-line` cho nền thanh).

- [ ] **Step 5: Chạy test**

Run: `yarn test src/views/Wizard`
Expected: PASS (`Wizard.test`, `Stepper.test`, `DocumentInputStep.test`, `StepReview.test`, `StepResult.test`). Test nào assert class cũ → cập nhật.

- [ ] **Step 6: Green checks + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test
git add src/views/Wizard
git commit -m "refactor(ui-shell): migrate Wizard steps to shared primitives"
```

---

### Task 11: Quét sót + build

**Files:** không tạo mới — chỉ sửa những chỗ grep còn sót.

- [ ] **Step 1: Quét hard-code còn sót**

```bash
cd client/.worktrees/ui-consistency-shell
grep -rn "dark:bg-slate-8" src/views src/components || echo CLEAN
grep -rn "border-slate-1" src/views src/components || echo CLEAN
grep -rn "max-w-4xl\|max-w-5xl\|max-w-6xl" src/views || echo CLEAN
grep -rn "md:p-8" src/views || echo CLEAN
```

Expected: cả 4 lệnh in `CLEAN`. Còn hit → sửa sang token/primitive tương ứng (trừ trường hợp có comment giải thích tại chỗ).

- [ ] **Step 2: Kiểm tra không còn `prominent`**

```bash
grep -rn "prominent" src || echo CLEAN
```

Expected: `CLEAN`.

- [ ] **Step 3: Full green checks**

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
```

Expected: tất cả PASS.

- [ ] **Step 4: Commit (nếu step 1 có sửa)**

```bash
git add -A src
git commit -m "refactor(ui-shell): sweep leftover hard-coded surface colours"
```

---

### Task 12: E2E

**Files:**
- Create: `e2e/ui-consistency-shell/sidebar.e2e.ts`
- Modify: `e2e/home-dashboard-library/library.e2e.ts`

**Tiền đề**: cần server (:5200) + client dev chạy. Từ worktree, nếu port mặc định đang bận thì dùng port riêng và **CLIENT_ORIGIN của server phải khớp** — xem memory `e2e-worktree-port-cors`; truyền `E2E_BASE_URL=http://localhost:<port>`.

- [ ] **Step 1: Reconcile `library.e2e.ts`**

Dòng ~152: `page.getByRole("link", { name: "Saved CVs" })` → `{ name: "Curriculum Vitae" }`.
Dòng ~161: `page.getByRole("heading", { name: "Saved CVs" })` → `{ name: "Curriculum Vitae" }`.

Thêm vào `test.describe("saved CV library")` — scenario 8 (data rendering):

```ts
test("[data-render] uses the clearer library labels, not the old wording", async ({
  page
}) => {
  await page.goto("/cv");
  await waitHydrated(page);
  await expect(page.getByText("Saved CVs")).toHaveCount(0);
  await expect(page.getByText("Saved JDs")).toHaveCount(0);
});
```

- [ ] **Step 2: Viết `e2e/ui-consistency-shell/sidebar.e2e.ts`**

```ts
import { expect, test } from "@playwright/test";

const STORAGE_KEY = "ui.sidebarCollapsed";

/** Waits for hydration the same way the other suites do. */
async function waitHydrated(page: import("@playwright/test").Page) {
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
}

test.describe("app shell sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  // Scenario 1 — happy path
  test("[happy] desktop shows 4 nav items and highlights only the current one", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitHydrated(page);

    for (const name of [
      "Dashboard",
      "CV ↔ JD Matching",
      "Curriculum Vitae",
      "Job Descriptions"
    ]) {
      await expect(page.getByRole("link", { name })).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(
      page.getByRole("link", { name: "Curriculum Vitae" })
    ).not.toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "Curriculum Vitae" }).click();
    await expect(
      page.getByRole("link", { name: "Curriculum Vitae" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current", "page");
  });

  // Scenario 11 — state transition + persistence [ST]
  test("[state] collapse to rail, survives navigation and reload", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitHydrated(page);

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    const rail = page.getByRole("button", { name: "Expand sidebar" });
    await expect(rail).toBeVisible();
    await expect(page.getByText("Curriculum Vitae")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Curriculum Vitae" })
    ).toBeVisible();

    await page.getByRole("link", { name: "Job Descriptions" }).click();
    await expect(rail).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeVisible();
  });

  // Scenario 4 — persisted-value classes [EP]
  test("[validation] a garbage persisted value falls back to expanded", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(
      ([key]) => window.localStorage.setItem(key, "maybe"),
      [STORAGE_KEY]
    );
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeVisible();
  });

  // Scenario 6 — lg breakpoint [BVA]
  test("[boundary] rail exists at 1024 but not at 1023", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  });

  // Scenario 11 — viewport × state [DT]
  test("[state] a collapsed desktop preference does not affect the mobile drawer", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitHydrated(page);
    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByRole("button", { name: "Open menu" }).click();

    await expect(page.getByText("Curriculum Vitae")).toBeVisible();
  });

  // Scenario 12 — a11y
  test("[a11y] the toggle is keyboard operable and reports its state", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitHydrated(page);

    const toggle = page.getByRole("button", { name: "Collapse sidebar" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "app-sidebar");

    await toggle.focus();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("button", { name: "Expand sidebar" })
    ).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeFocused();
  });

  // Scenario 9 — i18n
  test("[i18n] nav labels render in Vietnamese", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitHydrated(page);

    await page.evaluate(() => {
      void (
        window as unknown as { __i18n: { changeLanguage: (l: string) => void } }
      ).__i18n.changeLanguage("vi");
    });

    await expect(page.getByRole("link", { name: "Tổng quan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sơ yếu lý lịch" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mô tả công việc" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Thu gọn thanh bên" })
    ).toBeVisible();
  });
});
```

Trước khi chạy: kiểm tra cách đổi locale trong `e2e/home-dashboard-library/library.e2e.ts` (dùng `window.__i18n.changeLanguage`) và dùng đúng cách đó; nếu helper `waitHydrated` đã có ở file dùng chung thì import lại thay vì viết lại.

- [ ] **Step 3: Chạy suite E2E (gate A)**

```bash
yarn test:e2e --project=desktop e2e/ui-consistency-shell
yarn test:e2e
```

Expected: PASS. Fail → `superpowers:systematic-debugging`, ghi `docs/specs/ui-consistency-shell/e2e-bugs.md`, tối đa 3 vòng.

- [ ] **Step 4: Viết `docs/specs/ui-consistency-shell/e2e.md`**

Chép Scenario Matrix từ `design.md` §8, ghi kết quả PASS/FAIL từng scenario + gap còn lại (nếu có).

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test(ui-shell): e2e for collapsible sidebar and renamed nav labels"
```

---

### Task 13: Đồng bộ design system + convention

**Files:**
- Modify: `.claude/.worktrees/ui-consistency-shell/uiux/frontend-reference.md`
- Modify: `docs/.worktrees/ui-consistency-shell/.superdesign/design-system.md`
- Create: `client/.worktrees/ui-consistency-shell/.claude/rules/layout-primitives.md`
- Modify: `client/.worktrees/ui-consistency-shell/.claude/CLAUDE.md`

- [ ] **Step 1: `.claude/uiux/frontend-reference.md`**

- §1: thêm cột "Tailwind utility" ánh xạ token → `bg-app` / `bg-surface` / `bg-surface-subtle` / `border-line` / `text-body` / `text-muted` / `text-faint` / `bg-primary` / `text-accent`, kèm ghi chú khai báo ở `client/src/styles.css` bằng `@theme` (không `@theme inline`).
- §2: eyebrow/label đổi thành `text-xs font-semibold tracking-wider uppercase`; card title h2 `text-xl font-bold`.
- §5: page = `p-4 md:p-6`, `max-w-[1600px]` canh giữa (bỏ mô tả "full-bleed, không cần max-w").
- §5b bảng desktop: sidebar `w-72` mở ↔ `w-16` rail (bỏ "288px" cũ nếu mâu thuẫn).
- §7: thêm 3 pattern — `PageContainer`, `SectionCard` (header/body/footer + `fill` + `stickyFooter` + `bodyClassName`), sidebar nav-item (4 item đồng nhất, active = `bg-primary/10 text-accent` + bar `::before`, rail = icon + Tooltip).

- [ ] **Step 2: `docs/.superdesign/design-system.md`**

Sync đúng các thay đổi ở step 1 (spacing trang, thang chữ eyebrow, sidebar rail) để mock SuperDesign sau này không sinh lệch.

- [ ] **Step 3: Tạo `client/.claude/rules/layout-primitives.md`**

Frontmatter `paths: src/**`. Nội dung: bảng semantic token + utility; luật "mỗi trang bọc đúng 1 `PageContainer`"; "mọi panel dùng `SectionCard`, KHÔNG dựng card bằng div rời hay antd `Card`"; thang chữ 5 vai trò; cấm hard-code `slate-*` cho surface/border/text (nêu ngoại lệ: màu semantic green/amber/red/blue của report được giữ).

- [ ] **Step 4: Thêm dòng vào bảng Rules của `client/.claude/CLAUDE.md`**

```
| `layout-primitives` | `src/**` — PageContainer / SectionCard, semantic token, thang chữ |
```

- [ ] **Step 5: Commit từng repo**

```bash
git -C .claude/.worktrees/ui-consistency-shell add uiux/frontend-reference.md
git -C .claude/.worktrees/ui-consistency-shell commit -m "docs(uiux): document layout primitives and semantic colour tokens"

git -C docs/.worktrees/ui-consistency-shell add .superdesign/design-system.md specs/ui-consistency-shell
git -C docs/.worktrees/ui-consistency-shell commit -m "docs(ui-consistency-shell): sync design system and add e2e results"

git -C client/.worktrees/ui-consistency-shell add .claude
git -C client/.worktrees/ui-consistency-shell commit -m "docs(client): add layout-primitives rule"
```

---

## Sau khi hết Task 13

Theo root `CLAUDE.md` §5, phần còn lại của flow (ngoài phạm vi plan này, main loop lo):
step 4 `requesting-code-review` → 4.5 security review (dự kiến **skip** — không chạm auth/input/data nhạy cảm; ghi lý do vào `docs/specs/ui-consistency-shell/security-report.md`) → 4.6 drift audit → 4.7 green checks → 4.8 finish branch + README → step 5 PR cho 3 repo.
