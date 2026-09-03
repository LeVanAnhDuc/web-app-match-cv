# Match CV — Design System (MASTER)

> **Trả lời:** Màu, chữ, bo góc, mật độ nào được dùng — và cái nào bị cấm?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · bootstrap lại toàn bộ token theo [ADR-0021](../../decisions/0021-token-zinc-cyan-ba-typeface.md) (bản trước: system font + slate/blue, đồng bộ với `web-app-ducker-id`)
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

Match CV **không còn** đồng bộ ngôn ngữ thiết kế với app anh em `web-app-ducker-id`; nó có
nhận diện riêng ([ADR-0021](../../decisions/0021-token-zinc-cyan-ba-typeface.md)). Ba app
chỉ chung methodology và convention, không chung code.

## 1. Ràng buộc cứng

1. **Ba typeface, ba vai trò, tự host.** `Space Grotesk` (heading) · `Inter` (body/UI) ·
   `JetBrains Mono` (**chỉ** cho số, kèm `font-variant-numeric: tabular-nums`). Nạp qua
   `@fontsource/*` (npm, self-host) + preload woff2 + `font-display: swap`. **Cấm Google
   Fonts CDN** và mọi font qua CDN khác — app SSR, một request render-blocking là một lần
   nhấp nháy khi hydrate (§5 luật 4).
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
8. **Chỉ dữ liệu được phép rực.** Vỏ app là zinc trung tính; màu bão hoà dành cho con số
   và trạng thái. Đây là lý do accent tồn tại ở 10%, không phải 30%.

## 2. Màu

Neutral là **zinc** (không nhuộm hue), accent là **cyan**. Không trộn slate/gray/stone,
không purple/teal/pink ngẫu hứng.

### 2a. Token ngữ nghĩa

| Token | Light | Dark | Vai trò |
| --- | --- | --- | --- |
| `app` | `#fafafa` zinc-50 | `#09090b` zinc-950 | nền app shell |
| `surface` | `#ffffff` | `#18181b` zinc-900 | nền card / panel |
| `surface-subtle` | `#f4f4f5` zinc-100 | `#09090b` zinc-950 | footer card, icon tile, empty box |
| `line` | `#e4e4e7` zinc-200 | `#3f3f46` zinc-700 | đường kẻ **trang trí**: divider, viền card |
| `line-strong` | `#71717a` zinc-500 | `#71717a` zinc-500 | viền **control**: input, checkbox, dropzone, select |
| `body` | `#18181b` zinc-900 | `#fafafa` zinc-50 | chữ chính |
| `muted` | `#52525b` zinc-600 | `#a1a1aa` zinc-400 | chữ phụ **và eyebrow** |
| `faint` | `#71717a` zinc-500 | `#71717a` zinc-500 | **chỉ phi-văn-bản**: icon stroke, placeholder |
| `primary` | `#0e7490` cyan-700 | `#0891b2` cyan-600 | nền nhấn, hành động chính, trạng thái active |
| `primary-hover` | `#155e75` cyan-800 | `#06b6d4` cyan-500 | hover của primary |
| `accent-text` | `#0e7490` cyan-700 | `#22d3ee` cyan-400 | **chữ** nhấn |
| `success` | `#15803d` green-700 | text `#4ade80` / fill `#22c55e` | điểm khớp, tích cực |
| `warning` | `#b45309` amber-700 | text `#fbbf24` / fill `#f59e0b` | gap, thiếu |
| `error` | `#b91c1c` red-700 | text `#f87171` / fill `#ef4444` | lỗi |

Chữ trên nền `primary`: **trắng** ở light (5.36:1), **`#09090b`** ở dark (5.40:1) — đảo
theo theme, đã duyệt, không phải lỗi.

**Ba luật đo được, mỗi luật vá một lỗi đã ship:**

1. **`faint` bị cấm dùng cho chữ.** Eyebrow dùng `muted`. Bản trước để eyebrow ở
   slate-400 trên slate-50 = **2.45:1**, mà đó là chữ `text-xs uppercase` đọc thật.
2. **Viền control dùng `line-strong`, không dùng `line`.** `line` (zinc-200 trên trắng =
   1.27:1) hợp lệ cho divider trang trí, nhưng viền input là thứ **duy nhất** chỉ ra ranh
   giới của control nên phải ≥3:1. Default của antd cũng mắc lỗi này.
3. **Semantic ở light dùng `-700`, không `-600`.** green-600 chỉ được **3.30:1** và
   amber-600 **3.19:1** trên trắng — chữ strengths và gaps dưới ngưỡng ở theme sáng.
   `-600` vẫn dùng được cho **fill** (bar, icon) ở ngưỡng 3:1, **không** cho chữ.

Cả hai theme đã đo **0 FAIL** WCAG AA. Thêm hoặc đổi một hex ⇒ **đo lại**, không ước lượng.

### 2b. Hợp đồng utility trong code

Token khai báo thành CSS variable bằng Tailwind 4 `@theme` trong `client/src/styles.css`
— **không dùng `@theme inline`**: inline nướng giá trị light vào từng utility và làm
chết dark mode. Override trong `@media (prefers-color-scheme: dark)`.

Trong `client/src/**` **dùng utility, KHÔNG hard-code `zinc-*` / `cyan-*`** cho
surface/border/text:

| Utility | Biến |
| --- | --- |
| `bg-app` | `--color-app` |
| `bg-surface` · `bg-surface-subtle` | `--color-surface` · `--color-surface-subtle` |
| `border-line` · `divide-line` | `--color-line` |
| `border-line-strong` | `--color-line-strong` |
| `text-body` · `text-muted` · `text-faint` | `--color-body` · `--color-muted` · `--color-faint` |
| `bg-primary` · `hover:bg-primary-hover` | `--color-primary` · `--color-primary-hover` |
| `text-accent` | `--color-accent` |
| `text-success` · `text-warning` · `text-error` | `--color-success` · `--color-warning` · `--color-error` |

Màu semantic của báo cáo **cũng đi qua token** (`text-success` / `text-warning`), khác bản
trước cho phép giữ class Tailwind gốc — chính ngoại lệ đó là nguồn của lỗi tương phản #3.

### 2c. antd `ConfigProvider`

```ts
theme={{
  cssVar: true,
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: isDark ? '#0891b2' : '#0e7490',
    colorBorder: '#71717a',
    borderRadius: 8,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
}}
```

⚠️ `colorPrimary` **phải bằng** `--color-primary` của cùng theme. Lệch hai giá trị này
là một nút antd primary và một phần tử Tailwind primary ra hai màu khác nhau — đã xảy ra
một lần ở bảng màu cũ (antd giữ `#6366f1`, tức giá trị `primary-hover`, trong khi CSS giữ
`#4f46e5`). `colorBorder` phải bằng `line-strong`, không phải `line`, vì antd dùng nó cho
viền input.

## 3. Chữ

Dùng đúng **5 vai trò + số**, không tự chế biến thể:

| Vai trò | Family | Class |
| --- | --- | --- |
| Page title (h1) | Space Grotesk | `font-head text-2xl font-bold tracking-tight text-body` |
| Card title (h2) | Space Grotesk | `font-head text-xl font-bold text-body break-words` |
| Eyebrow / label | Inter | `text-xs font-semibold tracking-wider uppercase text-muted` |
| Body | Inter | `text-sm text-body` |
| Meta / secondary | Inter | `text-sm text-muted` |
| **Số** | JetBrains Mono | `font-mono tabular-nums font-medium` |

Ngoài các vai trò trên: title trong row `text-sm font-semibold`, badge `text-xs
font-medium`. Weight: `font-medium` (button/label) · `font-semibold` (title) ·
`font-bold` (heading lớn). `tracking-tight` chỉ cho heading lớn. Eyebrow **không**
dùng `text-sm font-bold`, **không** `tracking-widest`, và **không** `text-faint`.

**Số luôn dùng mono + `tabular-nums`** — điểm, delta, `%`, `••••1234`. Không có nó thì
con số nhảy cột mỗi lần đổi giá trị, và cả màn kết quả rung khi ba nhà cung cấp trả về
lệch nhau.

Card title phải có `break-words` (`overflow-wrap: anywhere`): tiêu đề card ở màn kết quả
là model id (`anthropic/claude-3.5-sonnet`), một chuỗi không có chỗ ngắt tự nhiên, và ở
375px nó đẩy header rộng hơn card.

Hierarchy dựng bằng **size + weight + muted**, không bằng nhiều màu.

## 4. Hình khối và mật độ

- **Bo góc**: control / button / input / badge `rounded-md` (8px) · card / list-item /
  panel `rounded-xl` (12px) · icon tile `rounded-lg` (10px) · pill `rounded-full`.
  antd `borderRadius: 8`. **Cấm `rounded-2xl` tràn lan.**
- **Đổ bóng**: card `shadow-sm` hoặc chỉ `border border-line`; popover/modal
  `shadow-lg`. **Cấm `shadow-xl` / `shadow-2xl`** cho card thường.
- **Mật độ**: card `p-4 md:p-6` (không `p-8`/`p-10`) · header/footer trong card
  `px-4 py-4 md:px-6 md:py-5` · nhịp section `gap-6` · nhóm control `gap-4` · icon + label
  `gap-2`/`gap-3`.
- **Hit-area** control ≥ 40px ở mobile (antd `size="large"`). Nút trong header card ở
  mobile là full-width, không `size="small"` — 32px không đạt ngưỡng cảm ứng.

## 4b. Chuyển động, z-index, trạng thái

**Thang thời lượng** — cứng, không vượt 500ms: micro 100–150ms (hover, nhấn, checkbox) ·
nhỏ 150–250ms (dropdown, tooltip, đổi tab) · vừa 250–350ms (modal, drawer, mở section) ·
lớn 300–500ms (đổi route). Chỉ animate `transform` / `opacity`; **cấm** animate
`width` · `height` · `top` · `left` · `margin` · `padding`. Luôn tôn trọng
`prefers-reduced-motion`. Không animate nhiều phần tử cùng lúc — stagger, hoặc chỉ
animate phần tử tiêu điểm. **Không dùng GSAP / ScrollTrigger**: desktop khoá viewport nên
không có page scroll để trigger.

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
| mobile | base, < 768px | 1 cột · nav trong Drawer · trang scroll tự nhiên · footer CTA sticky |
| tablet | `md` 768–1023 | như mobile + label và spacing rộng hơn; **grid chỉ số lên 2 cột**, nhóm 3 điểm số lên 3 cột |
| desktop | `lg` ≥ 1024 | 2 cột: sidebar `w-72` mở ↔ `w-16` rail · khoá `h-dvh` · scroll nội bộ |

Bảy luật, mỗi luật vá một lỗi đã thật sự xảy ra:

1. **Dùng `dvh`, không `vh`** (`h-dvh` / `min-h-dvh`). `100vh` sai trên mobile vì
   toolbar động. **Cấm `h-screen`.**
2. **Khoá viewport chỉ ở desktop**: `min-h-dvh` + trang scroll ở mobile/tablet;
   `lg:h-dvh lg:overflow-hidden` + body tự scroll ở desktop. Tránh scroll lồng trên touch.
3. **Footer CTA sticky ở mobile/tablet**: `sticky bottom-0 z-10 …
   pb-[max(1rem,env(safe-area-inset-bottom))] lg:static`. Nền **đục** (không `/50`) để
   nội dung không lộ qua khi trôi bên dưới; `env(safe-area-inset-bottom)` chừa
   home-indicator iOS.
   **Ngoại lệ — màn là một cột nhiều card** (Wizard step 4 Kết quả: mỗi nhà cung cấp một
   card): không có `SectionCard` nào để ghim footer vào, nên thanh hành động ghim ở **cấp
   shell** và sticky ở **cả desktop**, tức bỏ `lg:static`. Đây là ca duy nhất luật 3 sai:
   card `fill` tự khoá chiều cao nên footer của nó vốn đã luôn trên màn, còn một cột nhiều
   card thì không.
4. **Đổi layout bằng CSS, không bằng JS.** App SSR → hook breakpoint
   (`Grid.useBreakpoint`, `matchMedia`) trả rỗng trên server ⇒ nhấp nháy khi hydrate.
   Dùng breakpoint class của Tailwind.
5. **Một phần tử = một lần trong DOM.** Không render hai biến thể rồi
   `hidden`/`lg:hidden` cho cùng một thứ — nhân đôi `data-testid`/text làm vỡ locator
   strict-mode của Playwright. Cho **một** element reflow bằng class.
6. **Ẩn chữ ở mobile** dùng `sr-only md:not-sr-only` (giữ trong accessibility tree),
   không `hidden` (biến mất khỏi cả a11y tree lẫn test).
7. **Không `flex-shrink-0` cho khối có thể rộng hơn màn.** Một hàng flex có nhóm nút
   nhãn dài đặt `shrink-0` + `whitespace-nowrap` sẽ **tràn và đè** lên phần bên cạnh, chứ
   không wrap. Nhóm đó phải được co (`shrink`) và `flex-wrap`, hoặc cả hàng xếp dọc — xem
   §6 `SectionCard` header.

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
  `rounded-xl border border-line bg-surface shadow-sm`. Header
  `px-4 py-4 md:px-6 md:py-5` + `border-b border-line`, chỉ render khi có
  `title`/`extra`. Body `p-4 md:p-6`. Footer `border-t border-line bg-surface-subtle`.
  - Slot: `eyebrow` · `title` · `description` · `extra` · `footer`.
  - **Header xếp dọc dưới 768**: khối tiêu đề một hàng, `extra` một hàng riêng
    full-width canh trái. Từ `md:` trở lên là một hàng `justify-between`, và `extra`
    **phải** được co + `flex-wrap` (§5 luật 7).
  - `fill` — khoá chiều cao ở desktop, body scroll nội bộ
    (`lg:h-full lg:overflow-hidden` + `lg:flex-1 lg:overflow-y-auto`). Dùng cho các bước
    Wizard — đây là thứ làm footer của card luôn nằm trên màn ở desktop mà không cần sticky.
  - `stickyFooter` — footer CTA `sticky bottom-0 … lg:static` cho mobile/tablet.
  - `bodyClassName` — override padding body, ví dụ `"p-0"` khi nhét `Table`/list sát mép.

## 7. Signature element — `readout`

Chỗ hiển thị con số. Nó là nhận diện của app vì sản phẩm này bán **một con số giải thích
được** (`overview.md` §1), và thang vạch là thứ làm con số đọc ra *đã được đo* thay vì
*một ý kiến* — đúng [bất biến #7](../../03-design/invariants.md) (LLM ở ngoài công thức).

```
ĐỘ KHỚP TỔNG          ← eyebrow  text-xs uppercase tracking-wider text-muted
73%          ↑ 8      ← font-mono tabular-nums text-4xl · delta semantic
▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░   ← track h-1.5 rounded-full bg-surface-subtle / fill bg-primary
0    ┆    ┆    ┆  100 ← vạch: 3 span absolute left-1/4 · left-1/2 · left-3/4
```

**Hai biến thể, và chọn sai là nói sai:**

- **`scale`** — giá trị là **phần trăm**, nên dải 0–100 thật sự tồn tại: có bar + thang vạch.
- **`plain`** — giá trị là **số đếm** ("12 CV đã lưu"). Không có dải nào, nên **không vẽ
  thang**. Vẽ thang cho số đếm là bịa ra một giá trị tối đa không tồn tại.

Vạch thang dựng bằng **fraction của Tailwind** (`left-1/4` · `left-1/2` · `left-3/4`),
không `repeating-linear-gradient` (§1.4).

Slot `delta` có **bốn** trạng thái, và trạng thái thứ tư là bắt buộc: `up` · `down` ·
`flat` · **`na` "không so được"**. [Bất biến #10](../../03-design/invariants.md) nói delta
chỉ có nghĩa khi cùng chat model **và** cùng embed model; khác model thì API trả cờ.
Không có `na` thì `readout` sẽ vẽ một mũi tên hoàn toàn bịa.

Dùng ở: Wizard step 4, So sánh phiên bản, thẻ chỉ số trang chủ, và bản thu gọn (số + mũi
tên, không thang) trong `list-row`.

## 8. Các khối lặp lại khác

- **`list-row`** — hình dạng lặp nhiều thứ hai (thư viện CV/JD, chọn tài liệu đã lưu, kết
  quả gần đây), và là chỗ hay hỏng nhất:

  ```
  flex items-center gap-4 px-4 py-3 rounded-xl border border-line
    ├─ đầu:   shrink-0            radio dot / icon tile
    ├─ giữa:  min-w-0 flex-1      title `text-sm font-semibold truncate`
    │                             meta  `text-xs text-muted truncate`
    └─ cuối:  shrink-0            readout thu gọn / badge
  ```

  **Không `flex-wrap`.** Thiếu `min-w-0` hoặc thiếu `shrink-0` là nguyên nhân duy nhất của
  mọi ca item wrap xấu. Active/hover: `border-primary bg-primary/10`. Dưới `lg`, nhóm
  hành động nhiều icon thu về **một nút menu** — sáu nút 40px không vừa một dòng ở 375px,
  và luật "không `flex-wrap`" chặn đường thoát bằng cách xuống dòng.
- **Sidebar nav item** — **6 item** dùng **chung một class string**; khác biệt thị giác duy
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
  tint + `check`; idle surface + border + faint; line nối `h-[2px]`. Một markup hai
  trục: base ngang → `lg:` dọc. Label `sr-only md:not-sr-only`.
  **Bước đã xong là `<button>`** — đường đi nhanh về sau cho người đã quen luồng, để họ
  không phải cuộn tìm "Quay lại". Hover: ring `primary/10` quanh dot + nhãn gạch chân.
  Bước hiện tại `aria-current="step"`. Bước **chưa đủ dữ liệu** `aria-disabled` + tooltip
  explainer ("Cần chọn CV và JD trước") — §4b cấm disabled im lặng. Hit-area là dot cộng
  nhãn nên đạt ≥40px ở mọi bề rộng.
  ⚠️ Nhảy về bước 1/2 rồi đổi tài liệu phải **xoá `runId` / `matchId`** trong store, nếu
  không kết quả ở step 4 thuộc về cặp tài liệu khác.
- **Input tabs (Upload / Paste)** — pill group nền `surface-subtle rounded-md`, tab
  active là `surface` + `shadow-sm`.
- **Dropzone** — `border border-dashed border-line-strong rounded-xl`, icon tròn
  primary-tint, hover viền primary + nền `primary/10`.
- **Empty state** — icon `search-x` trong tròn `size-12 bg-surface-subtle` + title
  `text-sm font-medium` + hint `text-xs`. Không để trống.
- **Buttons** — primary fill `rounded-md`; back là text muted; disabled muted +
  `cursor-not-allowed` + explainer. **Một primary action mỗi màn.**

## 9. Accessibility

Ngưỡng đo được ở [`../../02-requirements/nfr.md`](../../02-requirements/nfr.md)
§Accessibility (NFR-A11Y-01…05). Ở tầng thiết kế: radio group đúng semantics (có `name`,
`label` bọc `input`) · focus ring primary luôn thấy · tab order hợp lý · tương phản đạt
ở **cả hai** theme · mọi control có label · hit-area ≥ 40px · `faint` không bao giờ dùng
cho chữ (§2a).

## 10. Ghi chú

- `data-sd-id` chỉ tồn tại trong mock SuperDesign cũ — **không mang vào code thật**.
- Primary cũ (`blue-600` / `indigo-*`) từng nằm cứng trong class ở 7 chỗ thay vì đi qua
  token. Nếu còn gặp một chỗ như vậy thì đó là sót của lần đổi token này, không phải
  ngoại lệ được phép.
