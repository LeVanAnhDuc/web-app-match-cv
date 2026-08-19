# Design — `wizard-responsive`

> **Ngày**: 2026-08-06 · **Branch**: `feat/wizard-responsive` (worktree ở `docs/` + `client/`) · **Loại**: sửa UI của feature đã có (`cv-jd-matching-wizard`), FE-only.

## 1. Mục tiêu

`/wizard` hiện là layout **desktop-first, khóa vào viewport**: sidebar `w-72` cố định + `h-screen` + mỗi step tự scroll bên trong. Ở tablet/mobile layout này gãy. Mục tiêu: `/wizard` dùng được ở **tablet (768–1023px)** và **mobile (<768px)**, trong khi **hành vi desktop (≥1024px) không đổi một pixel nào**.

Triệu chứng cụ thể đang có (đo trên code hiện tại):

| # | Triệu chứng | Vị trí |
|---|---|---|
| 1 | `aside w-72` (288px) ăn 74% chiều ngang màn 390px → step body còn ~100px | `client/src/views/Wizard/index.tsx:24` |
| 2 | `h-screen` = `100vh` sai trên iOS/Android (toolbar động) → footer bị cắt | `client/src/views/Wizard/index.tsx:23` |
| 3 | Khóa viewport + scroll lồng nhau: bàn phím ảo mở lên, vùng scroll còn ~200px | `index.tsx:23` + card của 3 step |
| 4 | Step 3: 2 TextArea stack trong khung `min-h-0 flex-1` → mỗi ô cao vài chục px, không dùng được | `mains/StepReview/index.tsx:156-182` |
| 5 | Padding desktop cứng (`p-6`, `m-10`, `px-10`, `p-16`, gauge 160px) chiếm phần lớn màn mobile | `mains/StepResult/index.tsx:87,106,126,169,204,226` |
| 6 | Desktop-first classes (`p-6 md:p-6`) — dư thừa, ngược mobile-first của `standard-tailwind` | `index.tsx:39` |

## 2. Phi mục tiêu

- View `Home` (`src/views/Home/**`) và mọi route khác — **không đụng**.
- Backend, DTO, API contract, Prisma schema — **không đổi**. Feature này không có thay đổi phía server, không có env var mới (§5 step 3.1/3.2 của root CLAUDE.md: N/A).
- Dependency mới — **không thêm gói nào**. Chỉ dùng Tailwind utility + antd API có sẵn.
- i18n key mới — không. Copy hiện tại giữ nguyên.
- Landscape mobile (844×390), gập/foldable, print stylesheet — ngoài scope, ghi ở §9.

## 3. Reuse check (§5 step 1)

Quét trước khi thiết kế, những gì tái dùng được:

- **`Stepper` đã có nhánh `horizontal`** (`components/Stepper/index.tsx:100-130`) — class của nhánh này được tái dùng làm base (mobile/tablet) cho markup responsive hợp nhất, không viết mới từ đầu.
- **Pattern responsive đã tồn tại rải rác**: `StepReview/index.tsx:142` (`flex-col md:flex-row`), `StepResult/index.tsx:125` (`flex-col md:flex-row`), `:159,:169,:208` (`grid-cols-1 md:grid-cols-2`, `lg:grid-cols-2`) — tiếp tục cùng phong cách, không đưa cơ chế mới.
- **`data-testid="stepper-step-N"` + helper `stepperStep()`** (`Stepper/index.tsx:34`, `e2e/.../helpers.ts:70`) — giữ nguyên, và là **ràng buộc thiết kế** (xem §4).
- **Không có util/hook nào để tái dùng** cho breakpoint (`src/hooks/` chỉ có React Query hooks) — và thiết kế này cố ý **không tạo** hook đó (§4).

## 4. Approach — CSS-only, một khối nav tự reflow

Chọn **chuyển layout thuần CSS (Tailwind viewport breakpoint)**, không JS.

### 4.1 Vì sao không dùng JS breakpoint hook

`/wizard` chạy SSR (TanStack Start `shellComponent`; `gotoWizard` phải chờ hydration qua `window.__i18n`). `Grid.useBreakpoint()` của antd (hoặc `matchMedia`) trả `{}` trên server ⇒ HTML SSR luôn là nhánh desktop, client hydrate xong mới đổi ⇒ nhấp nháy sidebar ở mobile + E2E phải chờ thêm một tick mới assert được. Bỏ.

### 4.2 Vì sao KHÔNG render 2 biến thể nav rồi ẩn/hiện

Hướng "aside `hidden lg:flex` + topbar `lg:hidden`" nghe hợp lý nhưng **vỡ suite E2E hiện có**: `Stepper` gắn `data-testid="stepper-step-N"`, và 6 spec dùng `getByTestId("stepper-step-N")` (`accessibility.e2e.ts:30`, `happy-path.e2e.ts:60`, `mutation-and-state.e2e.ts:28`, `review-and-result.e2e.ts:73`, qua `helpers.ts:70`). Stepper xuất hiện 2 lần trong DOM ⇒ locator match 2 element ⇒ **strict-mode violation, fail ở cả 3 viewport kể cả desktop**. Badge `Step n/4` cũng vậy với `i18n.e2e.ts`.

⇒ Hình thái đúng: **một khối nav duy nhất tự đổi hình**, mỗi phần tử tồn tại **đúng một lần** trong DOM. Không nhân đôi node, không strict-mode risk, vẫn SSR-safe.

### 4.3 Container query — cân nhắc và bỏ

`standard-tailwind` phân định: layout cấp trang → viewport breakpoint; component tái dùng nhiều khung rộng → `@container`. Shell wizard *là* layout cấp trang, và `Stepper` hiện không được nhúng vào cột hẹp nào khác ⇒ YAGNI, dùng viewport breakpoint.

## 5. Breakpoint contract

Mobile-first: base = mobile, `md:`/`lg:` cộng lên.

| Tầng | Range | Layout |
|---|---|---|
| mobile | base, <768px | 1 cột · nav ngang trên đỉnh · stepper dot-only (label `sr-only`) · footer sticky · scroll trang tự nhiên |
| tablet | `md` 768–1023px | như mobile + label stepper hiện dưới dot + spacing rộng hơn |
| desktop | `lg` ≥1024px | **giữ nguyên hiện tại**: sidebar 288px, `h-dvh`, scroll nội bộ, footer static |

Đổi `h-screen` → `h-dvh` (chỉ áp ở `lg`) để tránh sai số toolbar iOS; dưới `lg` dùng `min-h-dvh` + scroll trang.

## 6. Thay đổi theo file

### 6.1 `src/views/Wizard/index.tsx` — shell

```tsx
<div className="flex min-h-dvh flex-col bg-slate-50 lg:h-dvh lg:flex-row lg:overflow-hidden dark:bg-slate-900">
  <WizardNav step={step} />
  <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6 lg:overflow-hidden">
    {step === 1 && <StepJD />} … 
  </main>
</div>
```

`<aside>` inline (`index.tsx:24-37`) tách ra **`mains/WizardNav/index.tsx`**. Việc tách này đồng thời sửa một vi phạm đang tồn tại: `client/.claude/rules/views.md` quy định `index.tsx` chỉ import từ `mains/`, nhưng `index.tsx:4` đang import trực tiếp `./components/Stepper`. Sau khi tách, chỉ `mains/WizardNav` import `components/Stepper` — đúng chiều `mains/ → components/`.

### 6.2 `src/views/Wizard/mains/WizardNav/index.tsx` (mới)

Một element `<aside>`/`<nav>` duy nhất, đổi hình bằng class:

| Phần | base (mobile/tablet) | `lg:` (desktop) |
|---|---|---|
| wrapper | `flex flex-col gap-4 border-b border-slate-200 bg-white p-4 md:px-6` | `lg:w-72 lg:shrink-0 lg:gap-10 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-6` |
| hàng brand | `flex items-center justify-between gap-3` | `lg:flex-col lg:items-start lg:gap-10` |
| badge `Step n/4` | trong hàng brand, mép phải | `lg:self-start` (xuống dưới brand) |
| stepper | `<Stepper current={step} />` | cùng instance |

Dark-mode class giữ y như `aside` hiện tại (`dark:border-slate-800 dark:bg-slate-900/40`). Logo tile + tên app là helper **private** `function BrandMark()` co-locate trong file (đúng `component-folder.md`: sub-component dùng-một-chỗ) — không tạo folder riêng.

### 6.3 `src/views/Wizard/components/Stepper/index.tsx`

Bỏ prop `orientation` và cả nhánh `if (orientation === "vertical")`; một markup, hai trục — ngang ở base/`md`, dọc ở `lg`:

| Phần | base (ngang) | `lg:` (dọc) |
|---|---|---|
| container | `flex items-center justify-between` | `lg:flex-col lg:items-stretch` |
| mỗi step | `flex flex-1 items-center last:flex-none` | `lg:flex-none lg:flex-col lg:items-stretch` |
| dot + label | `flex flex-col items-center gap-2` | `lg:flex-row lg:gap-3` |
| connector | `mx-2 h-[2px] flex-1` | `lg:mx-0 lg:my-1 lg:ml-5 lg:h-8 lg:w-[2px] lg:flex-none` |
| dot | `size-9` | `lg:size-10` |
| label | `sr-only md:not-sr-only md:text-xs` | `lg:text-sm` |

- `mb-16` (`:101`) bị xoá — spacing dọc do `WizardNav` quyết.
- Màu/trạng thái (`data-status`, `aria-current`, palette blue/indigo) **không đổi**.
- Label dùng `sr-only` chứ **không** `hidden`: ở mobile label mất khỏi mặt hình nhưng **còn trong accessibility tree** ⇒ `Stepper.test.tsx:10-13` (`getByText`) và các assertion `toBeVisible()` của i18n/a11y spec vẫn xanh ở 390px, không phải sửa assertion.
- Dot là **indicator không click được** ⇒ không áp ngưỡng tap-target.

### 6.4 Ba step card — sticky footer + spacing scale

Áp cùng pattern cho `components/DocumentInputStep/index.tsx:138`, `mains/StepReview/index.tsx:141`, `mains/StepResult/index.tsx:123`:

| Vùng | Hiện tại | Sau |
|---|---|---|
| card | `flex h-full flex-col overflow-hidden` | `flex flex-col lg:h-full lg:overflow-hidden` |
| header | `p-6` | `p-4 md:p-6` |
| body | `min-h-0 flex-1 overflow-y-auto p-6` | `p-4 md:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto` |
| footer | `shrink-0 … p-6` | `sticky bottom-0 z-10 shrink-0 … p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:static lg:pb-6` |
| nền footer | `bg-slate-50/50` | `bg-slate-50 lg:bg-slate-50/50` (sticky cần nền đục) |
| nút footer | antd default (32px) | `size="large"` (40px) ở **mọi** breakpoint — user đã chốt: đồng nhất, không hack `!h-*` theo breakpoint |

`env(safe-area-inset-bottom)` để footer không nằm dưới home-indicator iPhone.

**Riêng từng step**:

- **`DocumentInputStep`** — không đổi logic. `UploadPasteTabs` (`components/UploadPasteTabs/index.tsx`): `mb-8` (`:47`) → `mb-6 md:mb-8`; ruột Dragger `py-6` (`:60`) → `py-4 md:py-6`; icon tile `h-16 w-16` (`:61`) → `size-12 md:size-16`; tiêu đề dropzone `text-lg` (`:64`) → `text-base md:text-lg` (tránh wrap 3 dòng ở 390px).
- **`StepReview`** — grid (`:156`): `grid-cols-1 lg:grid-cols-2`, bỏ `divide-x` dưới `lg` (giữ `divide-y`). Hai TextArea (`:161-168`, `:174-181`): bỏ `style={{ height: "100%" }}` + `!flex-1`, thay bằng class `!h-[40vh] !min-h-56 !resize-none !rounded-xl lg:!h-full lg:!min-h-0 lg:!flex-1` — pane cao cố định ~40vh và tự scroll trong ô ở mobile/tablet, full-height ở desktop. Guard/loading card (`:112`, `:128`) `p-16` → `p-8 md:p-16`.
- **`StepResult`** — gauge `h-40 w-40` (`:126`) → `size-32 md:size-40`; khối điểm `gap-12` (`:125`) → `gap-6 md:gap-12`; grid report `gap-10 p-6` (`:169`) → `gap-6 p-4 md:gap-10 md:p-6`; box suggestions `m-10` (`:204`) → `m-4 md:m-10`; disclaimer `px-10` (`:226`) → `px-4 md:px-10`; loading/error card `p-16` (`:87`, `:106`) → `p-8 md:p-16`. Nội dung/số liệu không đổi.

## 7. E2E Scenario Matrix

Đây là **sửa feature đã có** ⇒ reconcile, không dựng suite mới. Ma trận dưới đây là **delta cho chiều viewport**; ma trận gốc ở `docs/specs/cv-jd-matching-wizard/design.md §7` và map test ở `e2e.md` giữ nguyên nội dung, chỉ **thêm chiều viewport** (mọi row cũ giờ chạy trên 3 project).

EP của chiều viewport: 3 class — mobile `<768` (đại diện **390×844**), tablet `768–1023` (**820×1180**), desktop `≥1024` (**1280×720**).

| # | Category | Scenario (delta responsive) | Gate |
|---|---|---|---|
| 1 | Happy path | **[EP]** Full flow step1→4 (paste JD → paste CV → Review → Run match stub → Result) chạy trọn ở **390×844** và **820×1180**, ngoài **1280×720** đã có. Mọi bước: header card đọc được, CTA bấm được. | A+B |
| 2 | AuthN | **N/A** — auth defer (stub current-user, không có redirect/401 trong MVP). Không đổi bởi responsive. | — |
| 3 | AuthZ | **N/A** — không có role; candidate/recruiter dùng cùng wizard. | — |
| 4 | Validation / expected-error | ✅ Inline error **hiện trên** sticky footer, không bị footer che, ở 390px: `err.fileType` (upload `.exe`), `err.empty` (Next khi rỗng). **[DT]** viewport × loại lỗi: (mobile, file-type) · (mobile, empty) · (desktop, file-type) → cùng một thông báo, chỉ khác vị trí hiển thị; không có combo nào làm mất error. | A |
| 5 | Empty / null states | ✅ Empty state reuse list ("No saved job descriptions yet" / "No saved CVs yet") render đủ ở 390px, không tràn ngang, không bị footer sticky cắt. | A+B |
| 6 | Boundary | ✅ **[BVA]** biên breakpoint: `767` → nav ngang + label `sr-only`; `768` → label hiện dưới dot; `1023` → vẫn nav ngang; `1024` → sidebar 288px. Biên hẹp nhất hỗ trợ: `320` (iPhone SE) → không scroll ngang. Biên chiều cao: `844` → footer nằm trong viewport không cần scroll. | A |
| 7 | Filter / search | **N/A** — wizard không có filter/search; reuse là radio list đơn giản (MVP). | — |
| 8 | Data rendering | ✅ **[Error Guessing]** dữ liệu dài không phá layout ở 390px: tên file 80 ký tự không khoảng trắng trong dropzone; title saved-doc dài trong radio list → wrap/truncate, **không** tạo scroll ngang. Số liệu step 4 vẫn `NN%` (không đổi). | A |
| 9 | i18n | ✅ **[DT]** locale × viewport: (VI, 390) · (VI, 820) · (EN, 390) · (EN, 820). VI dài hơn EN ⇒ nhắm đúng label stepper ở 768–820 (nơi label hiện dưới dot) và badge `Step n/4`: không overflow, không scroll ngang. Đổi locale qua `window.__i18n` như suite hiện có. | A+B |
| 10 | Error / loading | ✅ Card loading (`Loader2` + copy) và card error (`err.matchFailed` + "Start over") ở step 3/4 render **căn giữa, không tràn** tại 390px sau khi `p-16` → `p-8 md:p-16`. | A |
| 11 | Mutation safety / state | ✅ **[ST]** ở 390px: `1→2→3` giữ `jdDocId`/`cvDocId`; `3→Back→2` không mất state; step 4 "Start over" reset về 1. **Invalid/edge transition (bắt buộc)**: đang **scroll tới đáy** step 1 rồi bấm Next → step 2 phải hiện **header card trong viewport** (scroll reset về đầu step), không đổ user vào giữa trang. Mutation-heavy (tạo document thật) ⇒ **A only**; gate B chỉ verify render/scroll. | A only |
| 12 | Accessibility | ✅ Label stepper `sr-only` ở 390px vẫn nằm trong accessibility tree (`getByText` + `toBeVisible` xanh); `aria-current="step"` không đổi; **đúng 1** phần tử `stepper-step-N` trong DOM ở mọi viewport; nút footer `size="large"` ⇒ cao 40px; thứ tự focus không đổi (DOM order y như desktop). | A+B |
| 13 | **Không scroll ngang** (feature-specific) | ✅ Invariant: với mỗi step 1–4 × {390, 820} → `document.documentElement.scrollWidth <= window.innerWidth`. Đây là assertion bắt lỗi tràn phổ biến nhất của responsive. | A+B |
| 14 | **Footer sticky chạm tới được** (feature-specific) | ✅ Với mỗi step 1–4 tại 390×844: nút CTA chính (`Next` / `Run match` / `Save report`) có bounding box **trong viewport ngay khi vào step**, không cần scroll. Và nội dung cuối cùng của body (item cuối reuse list) **scroll tới được**, không bị footer che vĩnh viễn. | A+B |
| 15 | **Dark mode × viewport** (feature-specific) | ✅ **[DT]** theme × viewport: (dark, 390) · (light, 390) · (dark, 1280). Footer sticky phải **đục** ở cả 2 theme (không lộ nội dung trôi bên dưới); border nav đổi đúng cạnh (`border-b` ở mobile, `border-r` ở desktop) trong cả 2 theme. | B (visual) |

**Error Guessing bổ sung — ghi nhận, xử lý ngoài E2E**: bàn phím ảo mở lên khi focus TextArea (Playwright không emulate được ⇒ verify tay ở gate B/thiết bị thật); landscape mobile 844×390 (ngoài scope §2); iOS safe-area (chỉ verify được trên thiết bị thật — đã phòng bằng `env(safe-area-inset-bottom)`); double-tap Next ở mobile → đã có `loading` disable ở `DocumentInputStep` (không phải delta của responsive).

## 8. Verification

### 8.1 Vitest

- `Stepper.test.tsx` — giữ nguyên assertion, chỉ bỏ chỗ truyền `orientation`.
- **Test mới** (chốt chặn hồi quy đúng cái bẫy §4.2): render `Wizard` → `getAllByTestId("stepper-step-1")` phải có **đúng 1** phần tử. Ngăn người sau lại render 2 biến thể nav và làm vỡ selector E2E.

### 8.2 Playwright — 3 project

```ts
projects: [
  { name: "desktop", use: { ...devices["Desktop Chrome"] } },                                        // 1280×720
  { name: "tablet",  use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
  { name: "mobile",  use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 },  hasTouch: true } }
]
```

Tất cả đều **chromium**: cố ý **không** dùng device descriptor `iPhone 13` / `iPad (gen 7)` vì chúng ép `defaultBrowserType: "webkit"` ⇒ phải cài thêm browser, run chậm hơn, không đổi lấy giá trị gì cho việc test CSS breakpoint.

**Toàn bộ suite × 3 project** (quyết định của user) — 8 spec hiện có + `responsive.e2e.ts` mới = 9 spec. `workers: 1` ⇒ wall-clock ~×3. Hệ quả đã lường: một số spec cũ có thể cần chỉnh selector/assertion để xanh ở 390px — sửa spec đó và ghi lại trong `e2e.md`; **không** nới lỏng assertion để cho qua.

Spec mới `e2e/cv-jd-matching-wizard/responsive.e2e.ts` phủ row 6, 13, 14 (+ phần đo được của 11): assertion suy từ `page.viewportSize()` nên chạy được trong cả 3 project; row 6 dùng `page.setViewportSize()` cho các biên `320/767/768/1023/1024`.

### 8.3 Sửa kèm (file đang đụng)

1. **`e2e/cv-jd-matching-wizard/helpers.ts:2`** import `../../src/features/matching/types` — path đã chết sau migration layer-first (#6), chỉ sống sót vì là `import type` nên esbuild xoá đi. Trỏ lại `#/types/Matching`.
2. **`e2e/db-cleanup.ts` — bug chặn cả run, phát hiện khi chạy gate A**: `DELETE FROM "Document"` fail với FK violation vì `MatchResult` tham chiếu `Document` bằng `onDelete: Restrict` (Prisma default) và DB dev đã tích luỹ row `MatchResult`. `globalSetup` chết ⇒ **0 test chạy được**. Fix: xoá `MatchResult` trước, rồi `Document`. Bug có sẵn từ Plan 2, không do responsive — chỉ lộ khi DB có match thật.
3. **`playwright.config.ts` — thêm `E2E_BASE_URL`**: `baseURL` cứng `:5300` nên không test được worktree khi checkout chính đang giữ port. Đổi thành `process.env.E2E_BASE_URL ?? "http://localhost:5300"`, kèm key trong `.env.example` (§5 step 3.1) + ghi ở README. Vận hành: server phải allow origin đó qua `CLIENT_ORIGIN` của **chính nó** ⇒ khi test worktree thì dựng thêm instance server riêng (`PORT=5201 CLIENT_ORIGIN=http://localhost:5302`), KHÔNG đụng process của người khác.
4. **`src/styles.css`** — comment trỏ `src/providers/AntdProvider.tsx`, file thật là `src/contexts/AntdProvider/index.tsx` (drift từ migration layer-first).

### 8.4 Green checks gate (§4.7)

`yarn format` → `yarn lint` → `yarn type-check` → `yarn test` → `yarn build` (FE), rồi dual-gate §4.3. Phải xanh hết trước PR.

## 9. Artifact ngoài code

- **`.claude/uiux/frontend-reference.md:42`** — dòng spacing hiện chỉ có `page p-6 lg:p-8`, thiếu tầng mobile ⇒ cập nhật thành `p-4 md:p-6 lg:p-8`, và ghi thêm quy ước sticky-footer mobile (`pb-[max(1rem,env(safe-area-inset-bottom))]`).
- **`docs/.superdesign/design-system.md`** — sync lại tầng spacing mobile ở trên để mock SuperDesign ra đúng.
- **Step 1.5 SuperDesign (user đã chốt: chạy đầy đủ)** — dựng mock HTML `docs/ui-designs/wizard-responsive/`, mỗi file **light + dark trong cùng file** (section dark thêm `class="dark"`), feed `docs/.superdesign/design-system.md` + replica HTML hiện có ở `docs/ui-designs/cv-jd-matching-wizard/`: `step1-jd-mobile`, `step1-jd-tablet`, `step3-review-mobile`, `step4-result-mobile`. **Gate blocking**: user duyệt mock rồi mới sang `writing-plans`.
- **§4.6 drift audit** — sau code, audit `client/.claude/CLAUDE.md` (không có command/struct mới ngoài `mains/WizardNav`; `playwright.config.ts` có thêm 2 project ⇒ có thể cần ghi). Ghi chú sẵn: comment trong `client/src/styles.css` đang trỏ `src/providers/AntdProvider.tsx` trong khi file thật là `src/contexts/AntdProvider/` — drift có sẵn, sửa nếu audit xác nhận.

## 10. Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Spec cũ vỡ ở 390px vì selector/copy phụ thuộc layout | Trung bình | Đã chọn `sr-only` thay `hidden` cho label để giữ a11y tree; phần còn lại sửa từng spec + ghi vào `e2e.md`, không nới assertion |
| `!h-[40vh]` trên TextArea của antd bị override | Thấp | `TextArea` render thẳng `<textarea>` (không wrapper khi không `showCount`), `!` prefix + `hashPriority="high"` đã dùng sẵn ở dự án; nếu vẫn vỡ thì bọc div và set height ở div |
| Sticky footer + `z-10` chồng lên antd Modal/Dropdown | Thấp | antd Modal z-index 1000 ⇒ vẫn nằm trên; verify ở scenario 14 và ở modal "Save for reuse" |
| E2E wall-clock ×3 làm gate 4.7 chậm | Đã lường | User đã chọn; nếu quá lâu, có thể nâng `workers` sau (ngoài scope) |
| `size="large"` đổi diện mạo desktop | Đã chấp nhận | User chốt: đồng nhất mọi breakpoint |

## 10b. Security review (§4.5) — SKIPPED, có lý do

Không tạo `security-report.md` cho feature này. Diff chỉ gồm: class Tailwind, tách `mains/WizardNav` (di chuyển markup có sẵn), `size="large"` cho antd `Button`, config Playwright + test. **Không** đụng auth/authz (chưa có auth — stub user), **không** đổi validation input (`handleFileChange`/`handleNext` giữ nguyên logic), **không** đổi luồng dữ liệu hay endpoint, **không** render nội dung untrusted mới. Không có attack surface nào bị chạm ⇒ theo root CLAUDE.md §4.5 (cosmetic/refactor → skip, ghi lý do).

Ngoại lệ đáng ghi: `playwright.config.ts` nhận thêm `E2E_BASE_URL`, và `e2e/db-cleanup.ts` xoá thêm bảng `MatchResult`. Cả hai **chỉ nằm trong đường test** (không vào bundle production) và trỏ DB dev qua `E2E_DATABASE_URL` như trước.

## 11. Follow-up ngoài scope

- Landscape mobile (844×390) và foldable.
- Bàn phím ảo: nếu thực tế còn bí ở step 3, cân nhắc `svh`/`visualViewport` — chỉ làm khi có bằng chứng trên thiết bị thật.
- Nâng `workers` của Playwright để bù wall-clock ×3.
