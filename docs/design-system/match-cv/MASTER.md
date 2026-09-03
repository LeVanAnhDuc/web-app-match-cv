# Match CV — Design System (MASTER)

> **Trả lời:** Màu, chữ, bo góc, mật độ nào được dùng — và cái nào bị cấm?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · gộp từ `.claude/uiux/{frontend-reference,standards}.md` + `docs/.superdesign/design-system.md` + phần còn giá trị của skill `standard-uiux` (đã xoá)
> **Cập nhật khi:** thêm/bỏ một token · đổi bảng màu · đổi layout primitive · đổi signature element

**Nguồn đúng của token.** Mọi mockup và mọi màn hình đọc file này. Không màu mới, không
token tự nghĩ, không hex ngoài §2.

## 0. File này thắng cái gì

| Nguồn | Vai trò |
| --- | --- |
| **`MASTER.md`** (file này) | **Token + layout primitive.** Thắng mọi nguồn khác |
| [`design-guide.md`](design-guide.md) | **Ý đồ** — khi nào dùng gì và tại sao. Không chứa token |
| [`icon-map.md`](icon-map.md) | Khái niệm/action → icon Lucide |
| [`ux-copy.md`](ux-copy.md) | Câu chữ EN + VI, tone |
| `client/.claude/rules/*` · `skills/standard-tailwind` | Cách viết class trong code. Không được mâu thuẫn với file này |
| `docs/.superdesign/` · `docs/ui-designs/` | **Lịch sử, đóng băng 2026-09-03.** Không sinh thêm |

Stack là **Ant Design + Tailwind**, không phải shadcn/Radix — mọi hướng dẫn UI mặc định
giả định shadcn đều **không áp dụng** ([ADR-0003](../../decisions/0003-fe-tanstack-start-antd-tailwind.md)).
Ngôn ngữ thiết kế đồng bộ với app anh em `web-app-ducker-id` (system font, neutral
slate/zinc, 60-30-10); khác biệt duy nhất được phép là **accent màu** (product identity).

## 1. Ràng buộc cứng

1. **System font ONLY** — `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
   "Helvetica Neue", Arial, sans-serif`. **Cấm** Google Fonts, Fontshare, Switzer,
   Clash Grotesk, mọi custom font qua CDN.
2. **Luôn có cả light lẫn dark.** Một thiết kế chỉ có một theme là chưa xong.
3. **Mobile-first.** Class gốc là mobile, cộng `md:` / `lg:` lên. Cấm desktop-first
   kiểu `p-6 md:p-6`.
4. **Không magic number.** Mọi spacing/màu/radius lấy từ scale ở dưới. Không `p-[13px]`,
   không hex ngoài §2.
5. **Icon chỉ Lucide** (`lucide-react`, hoặc `@ant-design/icons` khi tương đương), theo
   [`icon-map.md`](icon-map.md). **Cấm emoji làm icon**, cấm trộn nhiều bộ icon.
6. **60-30-10**: 60% neutral (bg/surface/muted) · 30% semantic phụ · 10% accent.
7. **Phân tách bằng border, shadow tiết chế.** Border làm phần lớn việc; shadow chỉ cho
   lớp nổi.

## 2. Màu

### 2a. Token ngữ nghĩa

| Token | Light | Dark | Vai trò |
| --- | --- | --- | --- |
| `primary` | `#2563eb` blue-600 | `#4f46e5` indigo-600 | nền nhấn, hành động chính, trạng thái active |
| `primary-hover` | `#1d4ed8` blue-700 | `#6366f1` indigo-500 | hover của primary |
| `accent-text` | `#2563eb` | `#818cf8` indigo-400 | **chữ** nhấn — dark cần indigo-400 mới đủ tương phản |
| `app` | `#f8fafc` slate-50 | `#0f172a` slate-900 | nền app shell |
| `surface` | `#ffffff` | `#1e293b` slate-800 | nền card / panel |
| `surface-subtle` | `#f8fafc` | `#111827` | footer card, icon tile, empty box |
| `line` | `#e2e8f0` slate-200 | `#334155` slate-700 | mọi viền và đường kẻ |
| `line-subtle` | `#f1f5f9` slate-100 | `#1e293b` slate-800 | đường kẻ mờ |
| `body` | `#0f172a` slate-900 | `#ffffff` | chữ chính |
| `muted` | `#64748b` slate-500 | `#cbd5e1` slate-300 | chữ phụ |
| `faint` | `#94a3b8` slate-400 | `#64748b` slate-500 | chữ mờ, eyebrow |
| success | green-600 | green-500 | điểm khớp, tích cực |
| warning | amber-600 | amber-500 | gap, thiếu |
| error | red-600 | red-500 | lỗi |

**Primary đổi hue theo theme** (blue ở light, indigo ở dark) — đã duyệt, không phải lỗi.
Neutral là **slate**, không trộn zinc/gray. Không purple/teal/pink ngẫu hứng.

Màu semantic của báo cáo (strengths / gaps / suggestions) **giữ nguyên class Tailwind
gốc**, không token hoá.

### 2b. Hợp đồng utility trong code

Token khai báo thành CSS variable bằng Tailwind 4 `@theme` trong `client/src/styles.css`
— **không dùng `@theme inline`**: inline nướng giá trị light vào từng utility và làm
chết dark mode. Override trong `@media (prefers-color-scheme: dark)`.

Trong `client/src/**` **dùng utility, KHÔNG hard-code `slate-*`** cho surface/border/text:

| Utility | Biến |
| --- | --- |
| `bg-app` | `--color-app` |
| `bg-surface` · `bg-surface-subtle` | `--color-surface` · `--color-surface-subtle` |
| `border-line` · `divide-line` | `--color-line` |
| `text-body` · `text-muted` · `text-faint` | `--color-body` · `--color-muted` · `--color-faint` |
| `bg-primary` | `--color-primary` |
| `text-accent` | `--color-accent` |

### 2c. antd `ConfigProvider`

```ts
theme={{
  cssVar: true,
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: isDark ? '#4f46e5' : '#2563eb',
    borderRadius: 8,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
}}
```

⚠️ `colorPrimary` **phải bằng** `--color-primary` của cùng theme. Lệch hai giá trị này
là một nút antd primary và một phần tử Tailwind primary ra hai màu khác nhau — đã xảy ra
một lần (antd giữ `#6366f1`, tức giá trị `primary-hover`, trong khi CSS giữ `#4f46e5`),
sửa 2026-09-03.

## 3. Chữ

**Font**: system sans (§1.1). Dùng đúng **5 vai trò** này, không tự chế biến thể:

| Vai trò | Class |
| --- | --- |
| Page title (h1) | `text-2xl font-bold tracking-tight text-body` |
| Card title (h2) | `text-xl font-bold text-body` |
| Eyebrow / label | `text-xs font-semibold tracking-wider uppercase text-faint` |
| Body | `text-sm text-body` |
| Meta / secondary | `text-sm text-muted` |

Ngoài 5 vai trò trên: title trong row `text-sm font-semibold`, badge `text-xs
font-medium`. Weight: `font-medium` (button/label) · `font-semibold` (title) ·
`font-bold` (heading lớn). `tracking-tight` chỉ cho heading lớn. Eyebrow **không**
dùng `text-sm font-bold`, **không** `tracking-widest`.

Hierarchy dựng bằng **size + weight + muted**, không bằng nhiều màu.

## 4. Hình khối và mật độ

- **Bo góc**: control / button / input / badge `rounded-md` (8px) · card / list-item /
  panel `rounded-xl` (12px) · icon tile `rounded-lg` (10px) · pill `rounded-full`.
  antd `borderRadius: 8`. **Cấm `rounded-2xl` tràn lan.**
- **Đổ bóng**: card `shadow-sm` hoặc chỉ `border border-line`; popover/modal
  `shadow-lg`. **Cấm `shadow-xl` / `shadow-2xl`** cho card thường.
- **Mật độ**: card `p-4 md:p-6` (không `p-8`/`p-10`) · header/footer trong card
  `px-4 py-4 md:px-6` · nhịp section `gap-6` · nhóm control `gap-4` · icon + label
  `gap-2`/`gap-3`.
- **Hit-area** control ≥ 40px ở mobile (antd `size="large"`).

## 4b. Chuyển động, z-index, trạng thái

**Thang thời lượng** — cứng, không vượt 500ms: micro 100–150ms (hover, nhấn, checkbox) ·
nhỏ 150–250ms (dropdown, tooltip, đổi tab) · vừa 250–350ms (modal, drawer, mở section) ·
lớn 300–500ms (đổi route). Chỉ animate `transform` / `opacity`; **cấm** animate
`width` · `height` · `top` · `left` · `margin` · `padding`. Luôn tôn trọng
`prefers-reduced-motion`. Không animate nhiều phần tử cùng lúc — stagger, hoặc chỉ
animate phần tử tiêu điểm.

**Thang z-index** — không chế số ngoài thang: base `1` → dropdown `10` → sticky `20` →
modal `30` → toast `50`. Modal/drawer đặt `overscroll-behavior: contain`; element tương
tác đặt `touch-action: manipulation`.

**Trạng thái tải**: skeleton là mặc định (khớp đúng kích thước nội dung nó thay, hiện tối
thiểu 300ms) · spinner chỉ trong button hoặc full-page · progress bar chỉ khi biết % thật
· optimistic UI khi kết quả đoán được. Mất mạng → banner + tự retry khi có lại, disable
action cần mạng, **giữ nguyên input người dùng đã gõ**.

**Button**: một primary cho một section, **không đặt hai primary cạnh nhau**. Đủ 6 trạng
thái — default · hover (sáng/tối 10–15%, KHÔNG đổi kích thước) · active (`scale(0.98)`) ·
focus (ring thấy rõ) · disabled (**bắt buộc kèm explainer** — xem skill
`standard-accessibility` §Silent Disabled) · loading (spinner thay chữ, **giữ nguyên kích
thước**). Nhãn phải cụ thể theo hành động ("Chạy match", không phải "Tiếp tục") — câu chữ
lấy ở [`ux-copy.md`](ux-copy.md).

**Form**: một cột (ngoại lệ: cặp field hiển nhiên như City/Zip) · label **trên** input,
không inline · validate lúc `blur`, không validate trong khi đang gõ · lỗi hiện **ngay
dưới field** đó, không gom lên đầu form · submit ở đáy, full-width ở mobile.

## 5. Responsive

| Tầng | Range | Quy ước |
| --- | --- | --- |
| mobile | base, < 768px | 1 cột · nav ngang trên đỉnh · trang scroll tự nhiên · footer CTA sticky |
| tablet | `md` 768–1023 | như mobile + label và spacing rộng hơn |
| desktop | `lg` ≥ 1024 | 2 cột: sidebar `w-72` mở ↔ `w-16` rail · khoá `h-dvh` · scroll nội bộ |

Sáu luật, mỗi luật vá một lỗi đã thật sự xảy ra:

1. **Dùng `dvh`, không `vh`** (`h-dvh` / `min-h-dvh`). `100vh` sai trên mobile vì
   toolbar động. **Cấm `h-screen`.**
2. **Khoá viewport chỉ ở desktop**: `min-h-dvh` + trang scroll ở mobile/tablet;
   `lg:h-dvh lg:overflow-hidden` + body tự scroll ở desktop. Tránh scroll lồng trên touch.
3. **Footer CTA sticky ở mobile/tablet**: `sticky bottom-0 z-10 …
   pb-[max(1rem,env(safe-area-inset-bottom))] lg:static`. Nền **đục** (không `/50`) để
   nội dung không lộ qua khi trôi bên dưới; `env(safe-area-inset-bottom)` chừa
   home-indicator iOS.
4. **Đổi layout bằng CSS, không bằng JS.** App SSR → hook breakpoint
   (`Grid.useBreakpoint`, `matchMedia`) trả rỗng trên server ⇒ nhấp nháy khi hydrate.
   Dùng breakpoint class của Tailwind.
5. **Một phần tử = một lần trong DOM.** Không render hai biến thể rồi
   `hidden`/`lg:hidden` cho cùng một thứ — nhân đôi `data-testid`/text làm vỡ locator
   strict-mode của Playwright. Cho **một** element reflow bằng class.
6. **Ẩn chữ ở mobile** dùng `sr-only md:not-sr-only` (giữ trong accessibility tree),
   không `hidden` (biến mất khỏi cả a11y tree lẫn test).

Layout cấp trang → `md:`/`lg:`. Component tái dùng ở nhiều khung rộng → `@container`.
Mockup vẽ ở **375 / 768 / 1440**; không được có scroll ngang ở bất kỳ tầng nào.

## 6. Layout primitive — BẮT BUỘC

Hai component này là khung của mọi màn hình. **Không dựng lại bằng `div` rời, không
dùng antd `<Card>`** (nó có padding/radius riêng → lệch).

- **`PageContainer`** (`client/src/components/PageContainer`) —
  `mx-auto w-full max-w-[1600px] p-4 md:p-6`. Mỗi trang bọc **đúng một** cái. Full-bleed
  tới 1600px rồi canh giữa, để màn ultrawide không có dòng text quá dài. Không còn
  `max-w-4xl/5xl/6xl` per-view, không `md:p-8`.
- **`SectionCard`** (`client/src/components/SectionCard`) — **hình dạng card duy nhất**:
  `rounded-xl border border-line bg-surface shadow-sm`. Header `px-4 py-4 md:px-6 md:py-5`
  + `border-b border-line`, chỉ render khi có `title`/`extra`. Body `p-4 md:p-6`. Footer
  `border-t border-line bg-surface-subtle`.
  - Slot: `title` · `description` · `extra` · `footer`.
  - `fill` — khoá chiều cao ở desktop, body scroll nội bộ
    (`lg:h-full lg:overflow-hidden` + `lg:flex-1 lg:overflow-y-auto`). Dùng cho các bước Wizard.
  - `stickyFooter` — footer CTA `sticky bottom-0 … lg:static` cho mobile.
  - `bodyClassName` — override padding body, ví dụ `"p-0"` khi nhét `Table`/list sát mép.

## 7. Signature element — list-row

Hình dạng lặp lại nhiều nhất (thư viện CV/JD, chọn tài liệu đã lưu, kết quả gần đây),
và là chỗ hay hỏng nhất:

```
flex items-center gap-4 px-4 py-3 rounded-xl border border-line
  ├─ đầu:   shrink-0            radio dot / icon
  ├─ giữa:  min-w-0 flex-1      title `text-sm font-semibold truncate`
  │                             meta  `text-xs text-muted truncate`
  └─ cuối:  shrink-0            badge `text-xs px-2 py-0.5 rounded bg-surface-subtle`
```

**Không `flex-wrap`.** Thiếu `min-w-0` hoặc thiếu `shrink-0` là nguyên nhân duy nhất của
mọi ca item wrap xấu. Active/hover: `border-primary bg-primary/5`.

## 8. Các khối lặp lại khác

- **Sidebar nav item** — 4 item dùng **chung một class string**; khác biệt thị giác duy
  nhất là trạng thái active.
  - base `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium`
  - idle `text-muted hover:bg-surface-subtle hover:text-body`
  - active `bg-primary/10 font-semibold text-accent` + thanh dọc 3px bằng `::before`
    (không thêm DOM node) + `aria-current="page"`
  - rail (`w-16`) `justify-center px-0`, ẩn `<span>` nhãn, giữ `aria-label`, bọc antd
    `<Tooltip placement="right">`
  - **Không có item "nổi bật vĩnh viễn"** — fill màu vĩnh viễn đè mất tín hiệu active.
  - Toggle: antd `<Button type="text">` icon `PanelLeftClose`/`PanelLeftOpen`,
    `aria-expanded` + `aria-controls="app-sidebar"`. State ở Zustand slice `ui`, persist
    `localStorage` key `ui.sidebarCollapsed`, hydrate trong `useEffect` sau mount (SSR
    luôn render trạng thái mở). Mobile (`<lg`) **không có rail** — hamburger + antd
    `Drawer` render nav bản mở rộng.
- **Stepper** — dot `size-9 lg:size-10 rounded-full`; active primary fill; done primary
  tint + `check`; idle surface + border + muted; line nối `h-[2px]`. Một markup hai
  trục: base ngang → `lg:` dọc. Label `sr-only md:not-sr-only`.
- **Input tabs (Upload / Paste)** — pill group nền `surface-subtle rounded-md`, tab
  active là `surface` + `shadow-sm`.
- **Dropzone** — `border border-dashed border-line rounded-xl`, icon tròn primary-tint,
  hover viền primary + nền `primary/5`.
- **Empty state** — icon `search-x` trong tròn `size-12 bg-surface-subtle` + title
  `text-sm font-medium` + hint `text-xs`. Không để trống.
- **Buttons** — primary fill `rounded-md`; back là text muted; disabled muted +
  `cursor-not-allowed`. **Một primary action mỗi màn.**
- **Kết quả match (step 4)** — gauge % lớn + progress bar cho semantic và keyword; ba
  danh sách strengths (success) / gaps (warning) / suggestions (lightbulb) dạng row `gap-3`.

## 9. Accessibility

Ngưỡng đo được ở [`../../02-requirements/nfr.md`](../../02-requirements/nfr.md)
§Accessibility (NFR-A11Y-01…05). Ở tầng thiết kế: radio group đúng semantics (có `name`,
`label` bọc `input`) · focus ring primary luôn thấy · tab order hợp lý · tương phản đạt
ở **cả hai** theme · mọi control có label · hit-area ≥ 40px.

## 10. Ghi chú

- `data-sd-id` chỉ tồn tại trong mock SuperDesign cũ — **không mang vào code thật**.
- Có thể hợp nhất primary về một hue duy nhất (indigo cả hai theme) sau, nếu muốn bỏ
  chuyện đổi hue theo theme. Chưa làm.
