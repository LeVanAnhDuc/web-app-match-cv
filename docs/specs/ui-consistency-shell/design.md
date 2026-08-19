# Design — UI Consistency Shell

> Feature: `ui-consistency-shell` · Branch: `refactor/ui-consistency-shell` · Ngày: 2026-08-08
> Repo đụng: `client/` + `.claude/` + `docs/` — **KHÔNG** đụng `server/`.

## 1. Vấn đề

App shell hiện có 2 vùng (sidebar + content) nhưng luật padding / font / border chưa đồng nhất:

| Điểm lệch                | Thực tế trong code                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Page container           | `max-w-6xl` (Home) · `max-w-4xl` (Library) · `max-w-5xl` (Wizard), đều `p-4 md:p-8` — token quy định full-bleed      |
| Card border              | `border-slate-200` vs `border-slate-100`; dark `slate-700` vs `slate-700/50`                                         |
| Card surface             | `bg-white` vs `dark:bg-slate-800` vs `dark:bg-slate-800/50`                                                          |
| Card padding             | `p-8` (HeroCta) · `p-6` (StepReview, desktop-first) · `p-4 md:p-6` (DocumentInputStep) · `px-4 py-3` (DocumentRow)   |
| Loại card                | antd `<Card>` (StatCards, RecentMatches) vs raw `<div>` (Wizard, Library) → padding/radius/border khác nhau          |
| Heading                  | card title `text-xl font-semibold` (token: `font-bold`); eyebrow lẫn `tracking-wider` / `tracking-widest`, `text-sm` |
| Sidebar                  | `w-64` (token ghi `w-72`); brand `p-6` vs nav `px-4`; item "Match" **luôn** fill xanh → đè mất trạng thái active     |
| Sidebar                  | Không đóng/mở được ở desktop → content bị bó hẹp                                                                     |

## 2. Mục tiêu

1. Một luật spacing / typography / border duy nhất cho **cả** sidebar lẫn content, không thể trôi lại ở feature sau.
2. Sidebar: chỉ item **đang active** đổi màu; toggle thu/mở được ở desktop.
3. Nhãn nav rõ nghĩa (`Saved CVs` → `Curriculum Vitae`, …).
4. Content padding nhỏ hơn, chiếm nhiều bề ngang hơn.

## 3. Quyết định đã chốt

| Chủ đề          | Quyết định                                                                     | Lý do                                                                                 |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Toggle desktop  | Thu thành **rail icon** `w-16` (không ẩn hẳn)                                  | Vẫn điều hướng 1 click, content rộng thêm 224px                                       |
| Toggle mobile   | **Không có** — `<lg` giữ hamburger + antd Drawer như hiện tại                  | Rail trên màn hẹp vô nghĩa; Drawer đã là pattern chuẩn                                |
| Bề rộng content | Full-bleed nhưng chặn `max-w-[1600px]` canh giữa                               | Dùng hết màn thường; màn ultrawide không bị dòng text quá dài                         |
| Padding page    | `p-4 md:p-6` (bỏ `md:p-8`)                                                     | Nhỏ hơn hiện tại, khớp token `.claude/uiux` §5                                        |
| Item "Match"    | Thành nav item thường; bỏ `prominent` fill xanh                                | Fill vĩnh viễn đè mất tín hiệu active; CTA vào wizard đã có ở hero Dashboard           |
| Cách đồng nhất  | **Primitive dùng chung** `PageContainer` + `SectionCard` + semantic token       | Sửa class rời rạc sẽ trôi lại; primitive là điểm chặn duy nhất                        |
| SuperDesign     | **SKIP** step 1.5                                                              | Restyle theo token đã duyệt (2026-07-24), không có màn hình mới → mock không thêm gì  |

## 4. Kiến trúc

### 4.1 Semantic token — `client/src/styles.css`

Tailwind 4 `@theme` khai báo biến, override trong `@media (prefers-color-scheme: dark)` (khớp cơ chế `dark:` hiện tại — app chưa có class-toggle theme, xem `AntdProvider`).

| Utility mới         | Light           | Dark           | Thay cho                                                    |
| ------------------- | --------------- | -------------- | ----------------------------------------------------------- |
| `bg-app`            | `#f8fafc`       | `#0f172a`      | `bg-slate-50 dark:bg-slate-900`                             |
| `bg-surface`        | `#ffffff`       | `#1e293b`      | `bg-white dark:bg-slate-800{,/50}`                          |
| `bg-surface-subtle` | `#f8fafc`       | `#111827`      | `bg-slate-50/50 dark:bg-slate-900/30`                       |
| `border-line`       | `#e2e8f0`       | `#334155`      | `border-slate-{100,200} dark:border-slate-700{,/50}`        |
| `text-body`         | `#0f172a`       | `#ffffff`      | `text-slate-900 dark:text-white`                            |
| `text-muted`        | `#64748b`       | `#cbd5e1`      | `text-slate-500 dark:text-slate-400`                        |
| `text-faint`        | `#94a3b8`       | `#64748b`      | `text-slate-400 dark:text-slate-500`                        |
| `bg-primary`        | `#2563eb`       | `#4f46e5`      | `bg-blue-600 dark:bg-indigo-600`                            |
| `text-accent`       | `#2563eb`       | `#818cf8`      | `text-blue-600 dark:text-indigo-400`                        |

Tên biến CSS tương ứng: `--color-app`, `--color-surface`, `--color-surface-subtle`, `--color-line`, `--color-body`, `--color-muted`, `--color-faint`, `--color-primary`, `--color-accent`.
Tách `primary` (nền) khỏi `accent` (chữ nhấn) vì token doc quy định primary đổi hue theo theme (blue→indigo) còn chữ nhấn ở dark phải là indigo-400 mới đủ tương phản — nav item active dùng `bg-primary/10` + `text-accent`.

Giá trị lấy nguyên từ `.claude/uiux/frontend-reference.md` §1 — đây là **đổi chỗ khai báo**, không đổi màu. Hệ quả: xoá ~60 cặp `dark:` trùng lặp, không còn chỗ nào lệch `slate-100` vs `slate-200` được nữa.

### 4.2 Primitive — `client/src/components/`

Theo rule `components.md` (dùng chung ≥2 view, no business logic), mỗi component 1 folder + `index.tsx`.

```tsx
// PageContainer — bọc mọi trang
<PageContainer className="space-y-6">    // mx-auto w-full max-w-[1600px] p-4 md:p-6
  ...
</PageContainer>

// SectionCard — mọi khối nội dung
<SectionCard
  title            // h2 text-xl font-bold text-body
  description      // p text-sm text-muted
  extra            // node canh phải header (thay antd Card `extra`)
  footer           // node footer
  fill             // opt-in: lg:h-full lg:overflow-hidden + body lg:flex-1 lg:overflow-y-auto
  stickyFooter     // opt-in: footer sticky bottom-0 … lg:static (CTA mobile Wizard)
  bodyClassName    // override padding body (vd "p-0" cho Table / list sát mép)
>
```

`SectionCard` nội bộ: `rounded-xl border border-line bg-surface shadow-sm` · header `px-4 py-4 md:px-6 md:py-5 border-b border-line` (chỉ render khi có `title`) · body `p-4 md:p-6` · footer `px-4 py-4 md:px-6 border-t border-line bg-surface-subtle`.

`stickyFooter` giữ nguyên hành vi mobile hiện có của Wizard: `sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static`.

### 4.3 Thang chữ (chốt cứng)

| Vai trò        | Class                                                        |
| -------------- | ------------------------------------------------------------ |
| Page title h1  | `text-2xl font-bold tracking-tight text-body`                |
| Card title h2  | `text-xl font-bold text-body`                                |
| Eyebrow/label  | `text-xs font-semibold tracking-wider uppercase text-faint`  |
| Body           | `text-sm text-body`                                          |
| Meta/secondary | `text-sm text-muted`                                         |

### 4.4 Sidebar — `views/AppShell`

**Layout**: `lg` mở `w-72` ↔ rail `w-16`, `transition-[width] duration-200`. `<lg` không đổi: header + hamburger + Drawer, Drawer luôn render bản mở rộng.

**Toggle**: antd `<Button type="text">` icon `PanelLeftClose` / `PanelLeftOpen` (lucide) cuối hàng brand; `aria-expanded` + `aria-controls="app-sidebar"` + `aria-label` = `t('nav.collapse'|'nav.expand')`. Rail: brand chỉ còn logo 8×8 canh giữa, nút toggle xuống dòng dưới.

**State**: slice `ui` trong `src/stores/slices/ui.ts` (`isSidebarCollapsed`, `toggleSidebar`), persist `localStorage` key `ui.sidebarCollapsed`.
SSR render mặc định **mở**; đọc localStorage trong `useEffect` sau mount. Đánh đổi đã chấp nhận: người từng thu rail thấy 1 frame mở rồi thu — đổi lại không cần script chặn hydration, và không có hydration mismatch.
Giá trị persist không hợp lệ (không phải `"true"`/`"false"`) → bỏ qua, dùng mặc định mở.

**Nav item** — 4 mục cùng một style, chỉ active khác màu:

```
idle   : flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
         text-muted hover:bg-surface-subtle hover:text-body
active : bg-primary/10 text-primary font-semibold + thanh dọc 3px bên trái
rail   : justify-center px-0 + antd <Tooltip placement="right"> + aria-label
```

Thêm `aria-current="page"` cho item active. Xoá hoàn toàn `prominentClassName` / `prominentActiveClassName` và field `prominent` của `NavItem`.

**Nhãn** (`nav.*`, en / vi):

| Key         | EN                | VI                |
| ----------- | ----------------- | ----------------- |
| `home`      | Dashboard         | Tổng quan         |
| `match`     | CV ↔ JD Matching  | Đối chiếu CV ↔ JD |
| `savedCvs`  | Curriculum Vitae  | Sơ yếu lý lịch    |
| `savedJds`  | Job Descriptions  | Mô tả công việc   |
| `collapse`  | Collapse sidebar  | Thu gọn thanh bên |
| `expand`    | Expand sidebar    | Mở thanh bên      |

Giữ nguyên tên key (`savedCvs`/`savedJds`) để không phải sửa lan; chỉ đổi giá trị.
Kéo theo cho khớp: `library.title.cv/jd` và `home.stat.savedCvs/savedJds` dùng cùng chuỗi "Curriculum Vitae" / "Job Descriptions".

## 5. Migrate content

| File                                       | Đổi                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `Home/index.tsx`                           | `mx-auto max-w-6xl p-4 md:p-8` → `<PageContainer className="space-y-6">`                                                |
| `Home/mains/HeroCta`                       | raw div `p-8 border-slate-200` → `<SectionCard>`; giữ icon trang trí absolute                                           |
| `Home/mains/StatCards`                     | antd `<Card>` → `<SectionCard>`; grid giữ `gap-4`                                                                       |
| `Home/mains/RecentMatches`                 | antd `<Card title extra>` → `<SectionCard title extra bodyClassName="p-0">` để Table sát mép                            |
| `DocumentLibrary/mains/DocumentList`       | `max-w-4xl p-4 md:p-8` → `<PageContainer>`; gộp danh sách vào **1** `<SectionCard bodyClassName="p-0">` + `divide-y divide-line` |
| `DocumentLibrary/components/DocumentRow`   | bỏ `rounded-xl border`, còn `px-4 py-3 md:px-6` — viền do card cha lo                                                   |
| `Wizard/index.tsx`                         | bỏ `max-w-5xl`, `p-4 md:p-8` → `<PageContainer className="flex h-full flex-col">`                                       |
| `Wizard/components/DocumentInputStep`      | card div → `<SectionCard fill stickyFooter title description footer>`; `border-slate-100`→`border-line`                |
| `Wizard/mains/StepReview`                  | như trên; `p-6` (desktop-first) → `p-4 md:p-6`; box empty/loading `p-16` → `p-8 md:p-16`; error `px-8 pb-6` → chuẩn      |
| `Wizard/mains/StepResult`                  | như trên; eyebrow `text-sm font-bold tracking-wider` → thang chữ §4.3                                                   |
| `AppShell/index.tsx`                       | `bg-slate-50 dark:bg-slate-900` → `bg-app`; aside `w-64` → `w-72`/`w-16`; header mobile dùng `border-line bg-surface`   |

## 6. Đồng bộ docs & convention

- `.claude/uiux/frontend-reference.md`: §2 eyebrow `text-xs` · §5 page = `p-4 md:p-6` + `max-w-[1600px]` · §5b sidebar `w-72` ↔ rail `w-16` · §7 thêm pattern PageContainer / SectionCard / sidebar nav-item · §1 thêm bảng ánh xạ token → utility Tailwind.
- `docs/.superdesign/design-system.md`: sync các thay đổi trên (cơ chế §3.3 root CLAUDE.md).
- `client/.claude/rules/layout-primitives.md` (**mới**, paths `src/**`): bắt buộc dùng 2 primitive, bảng semantic token, thang chữ, cấm hard-code `slate-*` cho surface/border/text.
- `client/.claude/CLAUDE.md`: thêm dòng rule mới vào bảng Rules (§4.6 drift audit).

## 7. Ngoài phạm vi (YAGNI)

Không thêm dark-mode toggle thủ công · không đổi brand hue · không refactor state Wizard · không đụng sâu style antd Table · không đụng `server/`.

## 8. E2E Scenario Matrix

**Gate áp dụng**: thay đổi này CÓ behavior user quan sát được (toggle sidebar mới, nhãn nav/tiêu đề trang đổi, luật active đổi) → matrix áp dụng cho **phần delta**; các scenario Wizard/Library sẵn có chỉ **reconcile**, không dựng lại.

Cột `Gate`: `A+B` = cả suite committed lẫn MCP walk; `A only` = gate B chỉ verify render, không thực hiện mutation.

| #   | Category            | Scenario / N/A                                                                                                                                                                                                                                                                                                                    | Gate  |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Happy path          | ✅ Desktop: sidebar mở, 4 nav item đúng nhãn mới, click từng item → điều hướng đúng route và **chỉ** item đó có màu active. Bấm toggle → rail `w-16`, chỉ còn icon, content rộng thêm. Bấm lại → mở.                                                                                                                                | A+B   |
| 2   | AuthN               | N/A — app chưa có auth (mock user cố định, auth defer Roadmap #2).                                                                                                                                                                                                                                                                 | —     |
| 3   | AuthZ               | N/A — chưa có role/permission.                                                                                                                                                                                                                                                                                                     | —     |
| 4   | Validation          | ✅ **[EP]** giá trị persist `ui.sidebarCollapsed` theo lớp: `"true"` → rail · `"false"` → mở · `""` → mở · `"maybe"` (rác) → mở · key vắng → mở. Không có input người dùng nào khác trong thay đổi này.                                                                                                                             | A+B   |
| 5   | Empty / null        | ✅ localStorage sạch (lần đầu vào) → sidebar mở. ✅ Library rỗng: empty-state vẫn render đúng bên trong `SectionCard` mới (regression sau khi bỏ border từng row).                                                                                                                                                                  | A+B   |
| 6   | Boundary            | ✅ **[BVA]** quanh breakpoint `lg`=1024px: `1023` → header + hamburger, không có aside/rail · `1024` → aside + nút toggle, không có hamburger · `1025` → như 1024. Rail width `w-16` ở 1024 vẫn hiện đủ 4 icon không tràn.                                                                                                          | A+B   |
| 7   | Filter / search     | N/A — thay đổi không có filter/search.                                                                                                                                                                                                                                                                                             | —     |
| 8   | Data rendering      | ✅ Không còn chuỗi `"Saved CVs"` / `"Saved JDs"` ở bất kỳ đâu: nav, tiêu đề trang `/cv` `/jd`, stat card Home — tất cả hiển thị "Curriculum Vitae" / "Job Descriptions".                                                                                                                                                            | A+B   |
| 9   | i18n                | ✅ Render **en + vi** cho: 4 nhãn nav, tooltip/aria collapse+expand, tiêu đề `/cv` `/jd`, nhãn stat card. Không có key thiếu (không hiện raw key).                                                                                                                                                                                  | A+B   |
| 10  | Error / loading     | ✅ Library API 5xx → thông báo lỗi vẫn render trong layout mới; loading → Skeleton. ✅ Console sạch sau khi hydrate (không hydration mismatch do sidebar SSR mặc định mở).                                                                                                                                                          | A+B   |
| 11  | Mutation / state    | ✅ **[ST]** transition hợp lệ: mở → rail → mở. ✅ Trạng thái rail giữ nguyên khi đổi route (Dashboard → `/cv` → `/wizard`). ✅ Persist: thu rail → F5 → vẫn rail. ✅ **[DT]** (viewport × state): `lg+mở`→`w-72` có nhãn · `lg+rail`→`w-16` chỉ icon · `<lg+mở`→Drawer, state rail bị bỏ qua · `<lg+rail`→vẫn Drawer đầy đủ nhãn. ✅ Double-click nhanh nút toggle → về đúng 1 trạng thái, không kẹt. Gate B dùng browser context riêng nên localStorage tách biệt, không nhiễm gate A. | A+B   |
| 12  | Accessibility       | ✅ Nút toggle có `aria-expanded` phản ánh đúng state + `aria-controls`. ✅ Item active có `aria-current="page"`. ✅ Rail: mỗi link vẫn có accessible name (aria-label) dù ẩn text. ✅ Keyboard: Tab tới nút toggle, Enter/Space đổi state, focus giữ trên nút sau toggle. ✅ Mobile Drawer giữ focus trap sẵn có của antd.             | A+B   |

**File test**:
- Mới: `client/e2e/ui-consistency-shell/sidebar.e2e.ts` (scenario 1, 4, 5a, 6, 11, 12).
- Reconcile: `client/e2e/home-dashboard-library/library.e2e.ts` — 2 assertion `"Saved CVs"` (link + heading) → nhãn mới; thêm scenario 8.
- i18n (9) gắn vào `client/e2e/cv-jd-matching-wizard/i18n.e2e.ts` hoặc file sidebar mới, tuỳ chỗ đã có helper đổi locale.
- Unit: `Sidebar.test.tsx` (bỏ assert prominent, thêm active-only + rail + aria) · thêm `SectionCard` test · rà `Home.test` / `DocumentLibrary.test` chỗ assert chuỗi đổi.

## 9. Rủi ro

| Rủi ro                                                                    | Giảm thiểu                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@theme` token trùng tên với biến antd `cssVar`                           | Đặt tên riêng (`--color-surface`, `--color-line`…), không trùng prefix `--ant-`        |
| Migrate 11 file dễ sót chỗ hard-code `slate-*`                            | Xong thì grep `dark:bg-slate-8` và `border-slate-1` trong `src/views` phải ra rỗng     |
| Đổi `max-w` Wizard có thể vỡ layout 2 cột StepReview trên màn rất rộng     | Đã chặn `max-w-[1600px]`; kiểm tra ở gate B viewport desktop                           |
| Rail + Tooltip antd trong SSR                                             | Tooltip chỉ render khi hover (client) — không ảnh hưởng markup SSR                     |
