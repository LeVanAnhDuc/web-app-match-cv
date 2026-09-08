# ADR-0021 · Bootstrap lại design token: zinc + cyan, ba typeface tự host

> **Ngày:** 2026-09-03
> **Trạng thái:** accepted
> **Liên quan:** ADR-0003 · NFR-A11Y-01 · NFR-A11Y-04

## 1. Bối cảnh

`MASTER.md` bản cũ khoá hai thứ: **system font ONLY** (cấm mọi custom font) và **ngôn ngữ
thiết kế đồng bộ với `web-app-ducker-id`, chỉ được khác accent màu**. Hai dòng đó chặn mọi
thay đổi nhận diện, nên "thiết kế lại toàn bộ UI" không thực hiện được mà không phá chúng.

Cùng lúc, đo tương phản bảng màu cũ lộ ra hai lỗi **đã ship**: eyebrow dùng `text-faint`
(slate-400 trên slate-50 = **2.45:1**, cần 4.5) và màu semantic của báo cáo giữ nguyên
Tailwind `-600` (green **3.30:1**, amber **3.19:1** trên trắng). Đây là chữ người dùng
đọc thật, không phải chi tiết trang trí.

## 2. Quyết định

Chạy lại `design-bootstrap --force` với brief "dụng cụ đo". Bảng màu mới: neutral **zinc**
không nhuộm hue, accent **cyan** (`#0e7490` light / `#0891b2` dark). Typeface: **Space
Grotesk** (heading) · **Inter** (body/UI) · **JetBrains Mono** (`tabular-nums`, chỉ cho
số), nạp qua `@fontsource/*` tự host. Signature element đổi từ `list-row` sang **`readout`**.
Kèm ba sửa a11y: eyebrow `faint` → `muted`, thêm token `line-strong` cho viền control,
semantic ở light dồn về `-700`. `faint` bị **cấm dùng cho chữ**.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ system font, chỉ đổi màu | `design-bootstrap` bước 2 bắt buộc ≥2 typeface family; giữ lệnh cấm font là tự bỏ một nửa giá trị của lần bootstrap |
| Giữ đồng bộ với Ducker ID | Ba app chỉ chung methodology, không chung code — phá không làm gãy gì về kỹ thuật, và giữ thì Match CV không có nhận diện riêng |
| Nhận nguyên output bước 1 | Nó trả pattern trang marketing (`Contact Sales`, `Client Logos`) cho một app không có màn login, `Fira Code` cho heading (mono có ligature lập trình), và amber accent **trùng màu `warning` = gap** |
| Google Fonts qua CDN | Thêm request render-blocking cho app SSR; `@fontsource` giữ được tinh thần "không phụ thuộc CDN" của luật cũ |

## 4. Hệ quả

**Được:**

- Cả hai theme đo **0 FAIL** WCAG AA — sửa hai lỗi tương phản đang tồn tại.
- Số liệu có typeface riêng với `tabular-nums`: điểm và delta không nhảy cột khi đổi giá trị.
- Accent cyan không đụng green/amber/red của strengths / gaps / error.

**Mất / phải chấp nhận:**

- Match CV **thôi trông giống** Ducker ID. Khi FR-18 xong, luồng login sẽ nhảy giữa hai
  ngôn ngữ thiết kế — đó là lúc phải chọn: hoặc thống nhất lại, hoặc chấp nhận đường nối.
- Thêm ba webfont vào bundle; cần preload woff2 + `font-display: swap`, nếu không SSR
  hydrate sẽ nhấp nháy (§5 luật 4 đã ghi lại một lần như vậy).
- Primary cũ (`blue-600`/`indigo-*`) nằm cứng trong class ở 7 chỗ chứ không qua token,
  nên đổi accent **không tự lan tới chúng** — phải sửa tay từng chỗ.

**Điều kiện xem lại quyết định này:** khi FR-18 (SSO qua Ducker ID) tới và luồng login
bắt hai app phải cùng ngôn ngữ thiết kế, hoặc khi có phép đo cho thấy webfont làm chậm
first paint quá ngưỡng.
