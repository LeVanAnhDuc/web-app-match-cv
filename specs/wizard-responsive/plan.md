# Wizard Responsive (tablet + mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/wizard` dùng được ở tablet (768–1023px) và mobile (<768px), desktop (≥1024px) không đổi hành vi.

**Architecture:** Chuyển layout **thuần CSS** bằng Tailwind viewport breakpoint (mobile-first), không hook breakpoint JS (app SSR ⇒ hydration flash). Nav là **một element duy nhất tự reflow** (không render 2 biến thể ẩn/hiện) để mỗi `data-testid`/text chỉ tồn tại một lần trong DOM. Dưới `lg`: bỏ khóa viewport, scroll trang tự nhiên, footer CTA `sticky bottom-0`.

**Tech Stack:** TanStack Start (React 19 + Vite, SSR) · Tailwind CSS 4 · Ant Design 5 · Vitest · Playwright.

**Spec:** `docs/specs/wizard-responsive/design.md` · **Mock:** `docs/ui-designs/wizard-responsive/*.html` (light + dark).

## Global Constraints

- Repo làm việc: worktree `client/.worktrees/wizard-responsive` (branch `feat/wizard-responsive`). KHÔNG commit lên `main`.
- **Mobile-first**: base class = mobile; `md:` = tablet (≥768px); `lg:` = desktop (≥1024px). KHÔNG viết desktop-first (`p-6 md:p-6`).
- **Desktop ≥1024px phải giữ nguyên diện mạo/hành vi hiện tại**, ngoại lệ duy nhất đã được user chấp nhận: nút footer đổi sang `size="large"` ở mọi breakpoint.
- **KHÔNG** thêm dependency, **KHÔNG** đổi i18n key, **KHÔNG** đổi API/DTO/store, **KHÔNG** sửa `src/routeTree.gen.ts`.
- Chiều cao viewport: dùng `dvh` (`min-h-dvh`, `lg:h-dvh`). CẤM `h-screen`/`100vh`.
- **Một phần tử = một lần trong DOM.** Không được render 2 biến thể của cùng một nội dung rồi `hidden`/`lg:hidden`.
- Ẩn chữ ở mobile: `sr-only md:not-sr-only` (KHÔNG `hidden` — mất khỏi accessibility tree và làm vỡ test).
- Convention: `client/.claude/rules/{component-folder,views,jsx,imports}.md` — component = folder + `index.tsx`, arrow fn, `export default` duy nhất; `views/<V>/index.tsx` chỉ import từ `mains/`; interactive element dùng antd.
- Sau mỗi task: `yarn format && yarn lint && yarn type-check && yarn test` phải xanh.

---

### Task 1: Stepper reflow (một markup, hai trục)

**Files:**
- Modify: `src/views/Wizard/components/Stepper/index.tsx` (bỏ prop `orientation`, gộp 2 nhánh thành 1)
- Test: `src/views/Wizard/components/Stepper/__tests__/Stepper.test.tsx`

**Interfaces:**
- Consumes: `WizardStep` từ `#/types/Wizard`; i18n key `step.jd|step.cv|step.review|step.result`.
- Produces: `<Stepper current={step} />` — **chỉ còn 1 prop** `current: WizardStep`. Task 2 gọi đúng signature này. Giữ nguyên `data-testid="stepper-step-N"`, `data-status`, `aria-current`.

- [ ] **Step 1: Viết test mới cho hành vi label giữ trong a11y tree**

Thêm vào `Stepper.test.tsx`:

```tsx
  it("keeps step labels in the accessibility tree (sr-only, not display:none) so mobile still exposes them", () => {
    render(<Stepper current={1} />);

    const label = screen.getByText(/job description/i);
    expect(label.className).toContain("sr-only");
    expect(label.className).toContain("md:not-sr-only");
    expect(label.className).not.toContain("hidden");
  });

  it("renders exactly one dot per step (no duplicated nav variants)", () => {
    render(<Stepper current={1} />);

    expect(screen.getAllByTestId("stepper-step-1")).toHaveLength(1);
    expect(screen.getAllByTestId("stepper-step-4")).toHaveLength(1);
  });
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn vitest run src/views/Wizard/components/Stepper`
Expected: FAIL — `label.className` hiện là `text-sm font-medium …`, không chứa `sr-only`.

- [ ] **Step 3: Viết implementation — thay toàn bộ phần render của `Stepper`**

Giữ nguyên `STEPS`, `Dot` (chỉ đổi size class trong `Dot`), bỏ tham số `orientation`:

```tsx
      className={[
        "z-10 flex size-9 shrink-0 items-center justify-center rounded-full font-bold transition-colors lg:size-10",
        isActive
```

Phần thân `Stepper`:

```tsx
/** 4-step wizard stepper — dot + connecting line (mock §7). Horizontal on
 * mobile/tablet, vertical rail from `lg` up: one markup, two axes (see
 * docs/specs/wizard-responsive/design.md §6.3). */
const Stepper = ({ current }: { current: WizardStep }) => {
  const { t } = useTranslation();

  const labelClass = (isActive: boolean) =>
    [
      // sr-only (not `hidden`) below md: label stays in the a11y tree so
      // screen readers and role/text-based tests still find it.
      "sr-only md:not-sr-only md:text-xs lg:text-sm",
      isActive
        ? "font-semibold text-slate-900 dark:text-white"
        : "font-medium text-slate-500 dark:text-slate-400"
    ].join(" ");

  return (
    <div className="flex items-center justify-between lg:flex-col lg:items-stretch">
      {STEPS.map((s, idx) => {
        const isDone = s.step < current;
        const isActive = s.step === current;
        const Icon = isDone ? Check : s.icon;
        return (
          <div
            key={s.step}
            className="flex flex-1 items-center last:flex-none lg:flex-none lg:flex-col lg:items-stretch"
          >
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-3">
              <Dot
                step={s.step}
                Icon={Icon}
                isActive={isActive}
                isDone={isDone}
              />
              <span className={labelClass(isActive)}>{t(s.labelKey)}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 h-[2px] flex-1 lg:mx-0 lg:my-1 lg:ml-5 lg:h-8 lg:w-[2px] lg:flex-none ${
                  s.step < current
                    ? "bg-blue-600 dark:bg-indigo-600"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Chạy test**

Run: `yarn vitest run src/views/Wizard/components/Stepper`
Expected: PASS (6 test — 4 cũ + 2 mới). `yarn type-check` sẽ fail ở `views/Wizard/index.tsx` vì còn truyền `orientation` — Task 2 sửa.

---

### Task 2: `mains/WizardNav` + shell reflow

**Files:**
- Create: `src/views/Wizard/mains/WizardNav/index.tsx`
- Modify: `src/views/Wizard/index.tsx`
- Test: `src/views/Wizard/__tests__/Wizard.test.tsx`

**Interfaces:**
- Consumes: `<Stepper current={step} />` (Task 1); `useWizardStore((s) => s.step)`; i18n `appName`, `stepper.progress` (`"Step {{n}} of 4"`).
- Produces: `<WizardNav step={step} />` — prop duy nhất `step: WizardStep`. Đây là component **duy nhất** trong `mains/` mà `index.tsx` import cho phần nav.

- [ ] **Step 1: Viết test guard chống nhân đôi nav**

Thêm vào `Wizard.test.tsx` (trong `describe` mới để không phụ thuộc stub fetch của flow test):

```tsx
describe("wizard shell layout", () => {
  it("renders exactly one nav (no duplicated desktop/mobile variants)", async () => {
    stubApi();
    renderWizard();
    await screen.findByText(/input job description/i);

    // Regression guard: rendering both a desktop aside and a mobile top bar
    // would duplicate these and break Playwright strict-mode locators.
    expect(screen.getAllByTestId("stepper-step-1")).toHaveLength(1);
    expect(screen.getAllByText(/step 1 of 4/i)).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: /match cv/i })).toHaveLength(
      1
    );
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn vitest run src/views/Wizard/__tests__/Wizard.test.tsx`
Expected: FAIL — `yarn type-check`/render lỗi vì `Stepper` không còn nhận `orientation` (Task 1 đã bỏ).

- [ ] **Step 3: Tạo `mains/WizardNav/index.tsx`**

```tsx
import { Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WizardStep } from "#/types/Wizard";
import Stepper from "../../components/Stepper";

/** Brand lockup — private single-use helper for {@link WizardNav}. */
function BrandMark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 dark:bg-indigo-600">
        <Wand2 className="text-white" size={20} />
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        {t("appName")}
      </h1>
    </div>
  );
}

/**
 * Wizard nav — ONE element that reflows: horizontal top bar on mobile/tablet,
 * 288px vertical rail from `lg` up. Deliberately not two hidden/shown variants:
 * that would duplicate the stepper's data-testid and the progress badge in the
 * DOM and break Playwright strict-mode locators (design.md §4.2).
 */
const WizardNav = ({ step }: { step: WizardStep }) => {
  const { t } = useTranslation();

  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b border-slate-200 bg-white p-4 md:px-6 lg:w-72 lg:gap-10 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-6 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-10">
        <BrandMark />
        <div className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 lg:self-start dark:bg-indigo-500/10 dark:text-indigo-400">
          {t("stepper.progress", { n: step })}
        </div>
      </div>
      <Stepper current={step} />
    </aside>
  );
};

export default WizardNav;
```

- [ ] **Step 4: Rewrite `src/views/Wizard/index.tsx`**

```tsx
import { useWizardStore } from "#/stores";
import StepCV from "./mains/StepCV";
import StepJD from "./mains/StepJD";
import StepResult from "./mains/StepResult";
import StepReview from "./mains/StepReview";
import WizardNav from "./mains/WizardNav";

/**
 * Wizard shell: nav (brand + step badge + 4-step Stepper) + current step body.
 * Mobile/tablet: single column, nav on top, page scrolls naturally. From `lg`:
 * two columns locked to the viewport (`h-dvh`), each step scrolls its own body
 * so the footer/Next stays in view. See docs/specs/wizard-responsive/design.md.
 */
const Wizard = () => {
  const step = useWizardStore((s) => s.step);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 lg:h-dvh lg:flex-row lg:overflow-hidden dark:bg-slate-900">
      <WizardNav step={step} />

      <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6 lg:overflow-hidden">
        {step === 1 && <StepJD />}
        {step === 2 && <StepCV />}
        {step === 3 && <StepReview />}
        {step === 4 && <StepResult />}
      </main>
    </div>
  );
};

export default Wizard;
```

- [ ] **Step 5: Chạy test + type-check**

Run: `yarn vitest run src/views/Wizard && yarn type-check`
Expected: PASS cả hai (`index.tsx` không còn import `components/Stepper` ⇒ đúng `rules/views.md`).

---

### Task 3: `DocumentInputStep` + `UploadPasteTabs` — sticky footer, spacing, `size="large"`

**Files:**
- Modify: `src/views/Wizard/components/DocumentInputStep/index.tsx`
- Modify: `src/views/Wizard/components/UploadPasteTabs/index.tsx`
- Test: `src/views/Wizard/components/DocumentInputStep/__tests__/DocumentInputStep.test.tsx`

**Interfaces:** Không đổi props/hành vi. Chỉ class + `size` của antd `Button`.

- [ ] **Step 1: Viết test cho sticky footer + hit-area**

Thêm vào `DocumentInputStep.test.tsx`:

```tsx
  it("pins the footer actions to the viewport below lg and uses large hit-areas", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DocumentInputStep kind="JD" onNext={() => {}} />
      </QueryClientProvider>
    );

    const next = screen.getByRole("button", { name: /next/i });
    expect(next.className).toContain("ant-btn-lg");

    const footer = next.closest("div");
    expect(footer?.className).toContain("sticky");
    expect(footer?.className).toContain("lg:static");
  });
```

> Nếu file test hiện có đã có helper render riêng, dùng helper đó thay cho `QueryClientProvider` inline — đọc file trước khi thêm.

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn vitest run src/views/Wizard/components/DocumentInputStep`
Expected: FAIL — không có class `sticky`, không có `ant-btn-lg`.

- [ ] **Step 3: Sửa `DocumentInputStep/index.tsx`** (4 dòng class + 2 `Button`)

| Dòng hiện tại | Đổi thành |
|---|---|
| `className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50"` | `className="flex flex-col rounded-xl border border-slate-100 bg-white shadow-sm lg:h-full lg:overflow-hidden dark:border-slate-700/50 dark:bg-slate-800/50"` |
| `className="shrink-0 border-b border-slate-100 p-6 dark:border-slate-700/50"` | `className="shrink-0 border-b border-slate-100 p-4 md:p-6 dark:border-slate-700/50"` |
| `className="min-h-0 flex-1 overflow-y-auto p-6"` | `className="p-4 md:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"` |
| `className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/80"` | `className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:static lg:bg-slate-50/50 lg:pb-6 dark:border-slate-700/50 dark:bg-slate-800 lg:dark:bg-slate-800/80"` |

Hai `Button` trong footer: thêm `size="large"` (giữ nguyên mọi prop khác).

- [ ] **Step 4: Sửa `UploadPasteTabs/index.tsx`**

| Hiện tại | Đổi thành |
|---|---|
| `<div className="mb-8">` (wrapper ngoài) | `<div className="mb-6 md:mb-8">` |
| `className="mb-10 !rounded-xl !border-dashed"` (Dragger) | `className="mb-6 !rounded-xl !border-dashed md:mb-10"` |
| `className="flex flex-col items-center justify-center py-6"` | `className="flex flex-col items-center justify-center py-4 md:py-6"` |
| `className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-50 …"` | `className="mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-50 md:size-16 …"` (giữ phần dark) |
| `className="mb-1 text-lg font-medium text-slate-900 dark:text-white"` | `className="mb-1 text-base font-medium text-slate-900 md:text-lg dark:text-white"` |
| `className="mb-10 !rounded-xl"` (TextArea) | `className="mb-6 !rounded-xl md:mb-10"` |

- [ ] **Step 5: Chạy test**

Run: `yarn vitest run src/views/Wizard && yarn type-check`
Expected: PASS.

---

### Task 4: `StepReview` — 2 pane stack, mỗi pane ~40vh

**Files:**
- Modify: `src/views/Wizard/mains/StepReview/index.tsx`
- Test: `src/views/Wizard/mains/StepReview/__tests__/StepReview.test.tsx`

**Interfaces:** Không đổi. Vẫn `useDocument`, `useCreateDocument`, `useRunMatch`, `useWizardStore`.

- [ ] **Step 1: Viết test cho chiều cao pane + stack**

Đọc file test hiện có để tái dùng helper mock; thêm:

```tsx
  it("stacks the two review panes with a fixed height below lg", async () => {
    renderStepReview(); // helper hiện có trong file test

    const jd = await screen.findByLabelText("Job Description");
    expect(jd.className).toContain("!h-[40vh]");
    expect(jd.className).toContain("lg:!h-full");
    expect(jd.getAttribute("style")).not.toContain("height: 100%");
  });
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn vitest run src/views/Wizard/mains/StepReview`
Expected: FAIL — TextArea đang có `style="height: 100%"` và class `!flex-1`.

- [ ] **Step 3: Sửa `StepReview/index.tsx`**

| Hiện tại | Đổi thành |
|---|---|
| card: `className="flex h-full flex-col overflow-hidden rounded-xl …"` | `className="flex flex-col rounded-xl … lg:h-full lg:overflow-hidden"` (giữ border/bg/dark) |
| header: `className="flex shrink-0 flex-col justify-between gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center dark:border-slate-700/50"` | đổi `p-6` → `p-4 md:p-6` |
| grid: `className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-slate-700/50"` | `className="grid grid-cols-1 divide-y divide-slate-100 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-slate-700/50"` |
| 2 pane wrapper: `className="flex min-h-0 flex-col p-6"` | `className="flex flex-col p-4 md:p-6 lg:min-h-0"` |
| 2 TextArea: `autoSize={false} style={{ height: "100%" }} className="!flex-1 !resize-none !rounded-xl"` | `autoSize={false} className="!h-[40vh] !min-h-56 !resize-none !rounded-xl lg:!h-full lg:!min-h-0 lg:!flex-1"` (bỏ hẳn `style`) |
| guard card `p-16` (nhánh `!jdDocId \|\| !cvDocId`) | `p-8 md:p-16` |
| loading card `p-16` | `p-8 md:p-16` |
| footer: `className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/80"` | `className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:static lg:bg-slate-50/50 lg:pb-6 dark:border-slate-700/50 dark:bg-slate-800 lg:dark:bg-slate-800/80"` |

Hai `Button` footer (`Back`, `Run match`): thêm `size="large"`. `Button` trong guard card giữ nguyên size.

- [ ] **Step 4: Chạy test**

Run: `yarn vitest run src/views/Wizard/mains/StepReview && yarn type-check`
Expected: PASS.

---

### Task 5: `StepResult` — thu spacing/gauge cho mobile

**Files:**
- Modify: `src/views/Wizard/mains/StepResult/index.tsx`
- Test: `src/views/Wizard/mains/StepResult/__tests__/StepResult.test.tsx`

**Interfaces:** Không đổi.

- [ ] **Step 1: Viết test**

```tsx
  it("scales the gauge and paddings down on mobile and pins the footer", async () => {
    renderStepResult(); // helper hiện có trong file test (stub useMatchResult)

    const startOver = await screen.findByRole("button", {
      name: /start over/i
    });
    expect(startOver.className).toContain("ant-btn-lg");
    expect(startOver.closest("div")?.className).toContain("sticky");
  });
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `yarn vitest run src/views/Wizard/mains/StepResult`
Expected: FAIL — chưa có `sticky`, chưa có `ant-btn-lg`.

- [ ] **Step 3: Sửa `StepResult/index.tsx`**

| Hiện tại | Đổi thành |
|---|---|
| loading card `… p-16 shadow-sm …` | `… p-8 shadow-sm md:p-16 …` |
| error card `… p-16 shadow-sm …` | `… p-8 shadow-sm md:p-16 …` |
| card: `className="flex h-full flex-col overflow-hidden rounded-xl …"` | `className="flex flex-col rounded-xl … lg:h-full lg:overflow-hidden"` |
| body: `className="min-h-0 flex-1 overflow-y-auto"` | `className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto"` |
| score header: `className="flex flex-col items-center gap-12 border-b border-slate-100 bg-slate-50/50 p-6 md:flex-row …"` | `gap-12` → `gap-6 md:gap-12`; `p-6` → `p-4 md:p-6` |
| gauge: `className="relative h-40 w-40 shrink-0"` | `className="relative size-32 shrink-0 md:size-40"` |
| report grid: `className="grid grid-cols-1 gap-10 p-6 lg:grid-cols-2"` | `className="grid grid-cols-1 gap-6 p-4 md:gap-10 md:p-6 lg:grid-cols-2"` |
| suggestions box: `className="m-10 mt-0 rounded-xl …"` | `className="m-4 mt-0 rounded-xl md:m-10 md:mt-0 …"` |
| disclaimer: `className="px-10 pb-6 text-center text-xs …"` | `className="px-4 pb-6 text-center text-xs md:px-10 …"` |
| footer: `className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 p-6 dark:border-slate-700/50 dark:bg-slate-800/80"` | `className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:static lg:pb-6 dark:border-slate-700/50 dark:bg-slate-800 lg:dark:bg-slate-800/80"` |

Hai `Button` footer (`Start over`, `Save report`): thêm `size="large"`. `Button` trong error card giữ nguyên.

- [ ] **Step 4: Chạy test**

Run: `yarn vitest run src/views/Wizard && yarn type-check`
Expected: PASS toàn bộ unit test của Wizard.

- [ ] **Step 5: Commit (Task 1–5 gộp 1 commit code)**

```bash
git add src/views/Wizard
git commit -m "feat(wizard): responsive layout for tablet and mobile

- single reflowing WizardNav (aside -> top bar below lg), extracted to mains/
- Stepper: one markup two axes, labels sr-only md:not-sr-only, no orientation prop
- steps: natural page scroll + sticky footer below lg, dvh instead of vh
- StepReview panes stack at 40vh; StepResult gauge/padding scale down
- footer buttons size=large for mobile hit-area"
```

---

### Task 6: Playwright 3 viewport + spec responsive + sửa import chết

**Files:**
- Modify: `playwright.config.ts`
- Modify: `e2e/cv-jd-matching-wizard/helpers.ts:2` (import chết)
- Create: `e2e/cv-jd-matching-wizard/responsive.e2e.ts`

**Interfaces:**
- Consumes: helper `gotoWizard`, `pasteText`, `nextButton`, `stepperStep` từ `./helpers`.
- Produces: 3 project name `desktop` / `tablet` / `mobile` (dùng cho `npx playwright test --project=<name>`).

- [ ] **Step 1: Sửa import chết trong `helpers.ts`**

```ts
import type { MatchResultDto } from "../../src/types/Matching";
```

Run: `yarn type-check` → PASS (nếu `e2e/` nằm ngoài tsconfig include thì kiểm bằng `npx tsc --noEmit e2e/cv-jd-matching-wizard/helpers.ts` là đủ để thấy path hợp lệ).

- [ ] **Step 2: Thêm 3 project vào `playwright.config.ts`**

```ts
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true
      }
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true
      }
    }
  ]
```

Kèm comment: cố ý dùng chromium + viewport tường minh thay vì device descriptor `iPhone 13`/`iPad (gen 7)` (chúng ép `defaultBrowserType: "webkit"` ⇒ phải cài thêm browser).

- [ ] **Step 3: Viết `responsive.e2e.ts`** (phủ row 6, 13, 14 + phần đo được của row 11)

```ts
import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import { gotoWizard, nextButton, pasteText } from "./helpers";

// design.md §7 rows 6 / 11 / 13 / 14 — layout invariants per viewport class.
// Runs in all 3 projects; assertions derive from the actual viewport size.

async function hasHorizontalScroll(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
}

test.beforeEach(async () => {
  await cleanDocuments();
});

test.describe("responsive layout", () => {
  test("no horizontal scroll and the primary CTA is in view on step 1", async ({
    page
  }) => {
    await gotoWizard(page);

    expect(await hasHorizontalScroll(page)).toBe(false);

    const next = nextButton(page);
    await expect(next).toBeInViewport();
  });

  test("nav fills the width below lg and is a 288px rail from lg up", async ({
    page
  }, testInfo) => {
    await gotoWizard(page);

    const width = page.viewportSize()?.width ?? 0;
    const nav = page.locator("aside").first();
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();

    if (width >= 1024) {
      expect(Math.round(box!.width)).toBe(288);
    } else {
      expect(Math.round(box!.width)).toBe(width);
    }
    expect(testInfo.project.name).toBeTruthy();
  });

  test("stepper labels are exposed to assistive tech at every viewport", async ({
    page
  }) => {
    await gotoWizard(page);

    // sr-only below md keeps the label in the a11y tree (design.md §6.3).
    await expect(page.getByText("Job Description", { exact: true })).toHaveCount(
      1
    );
    await expect(page.getByTestId("stepper-step-1")).toHaveCount(1);
  });

  test("breakpoint boundaries flip the nav axis at 1024px", async ({ page }) => {
    await gotoWizard(page);
    const nav = page.locator("aside").first();

    await page.setViewportSize({ width: 1023, height: 800 });
    expect(Math.round((await nav.boundingBox())!.width)).toBe(1023);

    await page.setViewportSize({ width: 1024, height: 800 });
    expect(Math.round((await nav.boundingBox())!.width)).toBe(288);

    await page.setViewportSize({ width: 320, height: 800 });
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("advancing a step brings the new step header into view", async ({
    page
  }) => {
    await gotoWizard(page);
    await pasteText(page, "JD text for the responsive scroll-reset check.");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await nextButton(page).click();

    const heading = page.getByRole("heading", {
      name: "Candidate CV / Resume"
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
  });

  test("step 3 stacks both panes and keeps Run match reachable", async ({
    page
  }) => {
    await gotoWizard(page);
    await pasteText(page, "JD text for the step-3 responsive check.");
    await nextButton(page).click();
    await pasteText(page, "CV text for the step-3 responsive check.");
    await nextButton(page).click();

    const jd = page.getByLabel("Job Description");
    const cv = page.getByLabel("CV / Resume");
    await expect(jd).toBeVisible();
    await expect(cv).toBeVisible();

    const width = page.viewportSize()?.width ?? 0;
    const jdBox = (await jd.boundingBox())!;
    const cvBox = (await cv.boundingBox())!;
    if (width >= 1024) {
      expect(Math.abs(jdBox.y - cvBox.y)).toBeLessThan(4); // side by side
    } else {
      expect(cvBox.y).toBeGreaterThan(jdBox.y + jdBox.height - 4); // stacked
    }

    expect(await hasHorizontalScroll(page)).toBe(false);
    await expect(
      page.getByRole("button", { name: "Run match" })
    ).toBeInViewport();
  });
});
```

- [ ] **Step 4: Chạy spec mới ở cả 3 project**

Tiền đề: server `:5200` + client `:5300` đang chạy (§4.3).
Run: `npx playwright test e2e/cv-jd-matching-wizard/responsive.e2e.ts`
Expected: PASS ở `desktop`, `tablet`, `mobile`.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/cv-jd-matching-wizard
git commit -m "test(e2e): add 3 viewport projects + responsive layout spec

- desktop/tablet/mobile chromium projects (explicit viewport, no webkit descriptors)
- responsive.e2e.ts: no-horizontal-scroll, nav axis, breakpoint boundary,
  sticky CTA in viewport, step-3 stacked panes, scroll reset on step advance
- fix dead import in helpers.ts (src/features/matching -> src/types/Matching)"
```

---

### Task 7: Dual-gate §4.3 + green checks + reconcile `e2e.md`

**Files:**
- Modify: `docs/specs/cv-jd-matching-wizard/e2e.md` (repo `docs/` — thêm chiều viewport + spec mới)
- Create (chỉ khi có gate fail): `docs/specs/wizard-responsive/e2e-bugs.md`

- [ ] **Step 1: Green checks FE (theo `client/.claude/CLAUDE.md`)**

Run lần lượt, phải xanh hết:
```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
```

- [ ] **Step 2: Gate A — full suite × 3 viewport**

Run: `npx playwright test`
Expected: 9 spec × 3 project, 0 failed. Spec cũ fail ở 390px ⇒ sửa **spec** (selector/assertion) hoặc **code** nếu là bug layout thật; ghi nguyên nhân vào `e2e.md`. KHÔNG nới lỏng assertion để cho qua.

- [ ] **Step 3: Gate B — MCP walk (Playwright MCP)**

Walk ở 390×844 và 820×1180 (`browser_resize`), light + dark (`emulate` prefers-color-scheme khi có): step 1 → 2 → 3 → 4 (route-stub không áp dụng cho MCP ⇒ chỉ walk tới step 3 rồi verify render, KHÔNG bấm Run match vì không có `OPENROUTER_API_KEY`). Check `browser_console_messages` không có error mới; screenshot làm bằng chứng cho row 15 (dark × viewport).

- [ ] **Step 4: Reconcile `docs/specs/cv-jd-matching-wizard/e2e.md`**

Thêm vào phần "Gates": suite giờ chạy 3 project (`desktop`/`tablet`/`mobile`), kèm kết quả run. Thêm 1 row vào "Scenario → test map":

```markdown
| 6/13/14 Responsive layout (wizard-responsive) | Không scroll ngang · nav ngang <lg / rail 288px ≥lg · biên 1023/1024/320 · CTA sticky trong viewport · step 3 stack 2 pane · scroll reset khi sang step | `responsive.e2e.ts` | A+B |
```

- [ ] **Step 5: Commit (repo `docs/`)**

```bash
git add specs/cv-jd-matching-wizard/e2e.md
git commit -m "docs(e2e): reconcile wizard e2e map with 3 viewport projects"
```

---

### Task 8: Drift audit + PR per repo

- [ ] **Step 1: §4.5 Security review — SKIP có lý do**

Thay đổi thuần layout/CSS: không đụng auth, không đụng input validation (chỉ đổi class), không đụng data flow, không render untrusted content mới. Ghi 1 đoạn "SKIPPED + lý do" vào `docs/specs/wizard-responsive/design.md` (mục cuối) thay vì tạo `security-report.md` rỗng.

- [ ] **Step 2: §4.6 Drift audit `client/.claude/CLAUDE.md`**

Kiểm 2 điểm: (a) `playwright.config.ts` giờ có 3 project ⇒ nếu CLAUDE.md ghi `yarn test:e2e` thì thêm ghi chú project name; (b) comment trong `src/styles.css` trỏ `src/providers/AntdProvider.tsx` nhưng file thật là `src/contexts/AntdProvider/` ⇒ sửa comment. Cập nhật `.claude/uiux/frontend-reference.md` §5/§5b đã làm ở repo `.claude/`.

- [ ] **Step 3: README check (§4.8)**

Setup/config/env/deps **không đổi** ⇒ chỉ cần thêm 1 dòng về e2e project nếu README có mục E2E; nếu không có thì bỏ qua.

- [ ] **Step 4: PR per repo qua skill `creating-github-pr`**

3 repo đã đụng: `docs/` (spec + mock + e2e.md), `client/` (code + test + config), `.claude/` (uiux token). Mỗi repo 1 PR, base `main`, squash-merge + xoá branch + `git pull` main.

- [ ] **Step 5: Dọn worktree (§6.1 item 8–9)**

```bash
git -C docs worktree remove D:/Learn/web-app-match-cv/docs/.worktrees/wizard-responsive
git -C client worktree remove D:/Learn/web-app-match-cv/client/.worktrees/wizard-responsive
git -C .claude worktree remove D:/Learn/web-app-match-cv/.claude/.worktrees/wizard-responsive
```

Nếu báo busy → xoá thư mục bằng `rd /s /q` rồi `git worktree prune`. Kết thúc: `git worktree list` sạch ở cả 3 repo.
