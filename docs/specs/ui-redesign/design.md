# Thiết kế lại toàn bộ UI

Liên quan: FR-03 · FR-05 · FR-06 · FR-07 · FR-09 · FR-12 · FR-14 · FR-15 ·
NFR-A11Y-01 · NFR-A11Y-02 · NFR-A11Y-03 · NFR-A11Y-04 · NFR-I18N-01 ·
[ADR-0003](../../decisions/0003-fe-tanstack-start-antd-tailwind.md) ·
[ADR-0021](../../decisions/0021-token-zinc-cyan-ba-typeface.md) ·
bất biến #7, #10

## 1. Vấn đề

Không phải "UI trông cũ". Ba thứ đo được:

1. **Hai lỗi tương phản đang ship.** Eyebrow dùng `text-faint` = **2.45:1** (cần 4.5), và
   màu semantic của báo cáo giữ Tailwind `-600` = green **3.30:1** / amber **3.19:1** trên
   trắng. Đây là chữ strengths và gaps — nội dung chính của báo cáo. Vi phạm NFR-A11Y-01.
2. **Token bị bỏ qua ở 7 chỗ.** Primary nằm cứng dưới dạng `blue-600` / `indigo-*` trong
   class thay vì đi qua biến, nên hệ token không thật sự điều khiển màu app.
3. **Chuỗi khoá chiều cao sai.** `AppShell` dùng `h-screen` không điều kiện, phá §5 luật 1
   và 2 của MASTER — hệ quả là thanh hành động của Wizard trôi xuống dưới nội dung và
   người dùng phải cuộn tới cuối mới bấm được.

Định vị sản phẩm (`overview.md` §1) là **một con số giải thích được**, nhưng UI hiện tại
không nói điều đó: con số dùng cùng font với chữ thường, không có thang đo, và gauge tròn
đọc như một đồ trang trí.

## 2. Hướng thiết kế — dụng cụ đo

Vỏ app trung tính, **chỉ dữ liệu được phép rực**. Chi tiết token ở
[`MASTER.md`](../../design-system/match-cv/MASTER.md); lý do chọn ở ADR-0021. Ba trụ:

- **Neutral zinc không nhuộm hue** — bảng màu cũ nhuộm xanh mọi thứ, làm mất 60% neutral
  và triệt tiêu ý nghĩa của accent.
- **Accent cyan** — không đụng green / amber / red đã thuộc về strengths / gaps / error.
  Output của `design-bootstrap` bước 1 đề xuất amber accent, tức **trùng màu "bạn đang
  thiếu cái này"**; đã loại.
- **Số có typeface riêng** — JetBrains Mono + `tabular-nums`. Không có nó, ba nhà cung cấp
  trả về ba giá trị lệch nhau là cả màn rung.

## 3. Signature element: `readout` thay gauge

`MASTER.md` §7 đổi signature từ `list-row` sang `readout`; `list-row` xuống §8.

`readout` = eyebrow + số mono lớn + delta + **thang vạch 0–100**. Thang vạch là phần mang
nghĩa: nó nói con số **đã được đo**, chứ không phải một ý kiến — khớp bất biến #7 (LLM
không có mặt trong công thức). Nó gộp hai thứ MASTER cũ tách rời ("gauge % lớn" + "progress
bar") thành một hình dạng, dùng lại ở Wizard step 4, So sánh phiên bản, thẻ chỉ số trang
chủ, và bản thu gọn trong `list-row`.

Hai quyết định bên trong nó, cả hai đều là *nói đúng* chứ không phải thẩm mỹ:

- **Màn so sánh phiên bản mất điểm bản cũ, và đó là ý định** *(xác nhận 2026-09-07)*.
  `ScoreBar` cũ có prop `before` nên vẽ được cả cặp `61% → 75%`; `readout` mang **một** con
  số theo thiết kế, nên sau Task 9 màn hình chỉ còn điểm bản mới cộng delta có dấu. Giữ
  nguyên vì **delta chính là câu trả lời** mà FR-14 hỏi (*"CV của bạn đã tốt lên bao nhiêu"*),
  còn con số gốc là dữ kiện trung gian. E2E giờ **assert điểm gốc KHÔNG xuất hiện**, để
  việc đưa nó trở lại là một thay đổi có ý thức chứ không phải một hệ quả âm thầm nữa.

- **Biến thể `plain` không vẽ thang.** "12 CV đã lưu" không có dải 0–100 nào; vẽ thang cho
  nó là bịa ra một giá trị tối đa không tồn tại.
- **Delta có trạng thái `na` "không so được".** Bất biến #10: delta chỉ có nghĩa khi cùng
  chat model *và* cùng embed model. Hôm nay điều kiện đó được xử lý bằng một `Alert` rời ở
  `ComparisonReport`; `readout` mang nó vào chính chỗ hiển thị số, nên không thể vẽ mũi tên
  mà quên mất cảnh báo.

## 4. Thanh hành động luôn trên màn

Yêu cầu: người dùng không phải cuộn tới cuối mới bấm được `Quay lại` / `Tiếp tục`. Cơ chế
khác nhau theo cấu trúc màn, không phải theo bề rộng:

| Màn | Cơ chế | Vì sao |
| --- | --- | --- |
| Wizard step 1–3 | footer của `SectionCard` + `fill` | Card khoá chiều cao, body scroll nội bộ ⇒ footer vốn đã luôn trên màn. Chỉ cần chuỗi khoá đúng |
| Wizard step 4 | thanh ghim ở **cấp shell**, sticky cả ở desktop | Step 4 là **một cột nhiều card** (mỗi nhà cung cấp một card), không có `SectionCard` nào để ghim footer vào |

Đây là ngoại lệ duy nhất của MASTER §5 luật 3 (`lg:static`), đã ghi vào luật đó.

## 5. Stepper bấm được

Bước **đã xong** thành `<button>` — đường đi nhanh cho người đã quen luồng, thay vì cuộn
tìm nút `Quay lại`. Bước chưa đủ dữ liệu `aria-disabled` + tooltip explainer (§4b cấm
disabled im lặng). Không cho nhảy tiến: step 3 cần cả hai tài liệu, step 4 cần một run.

**Hệ quả phải xử lý, không phải tuỳ chọn:** nhảy về bước 1/2 rồi đổi tài liệu thì `runId`
và `matchId` trong `wizardStore` trở thành cũ, và step 4 sẽ hiển thị kết quả của **cặp tài
liệu khác**. `goBack` hiện không xoá chúng. Stepper bấm được làm ca này dễ gặp hơn nhiều
nên nó là một task có test riêng.

## 6. Ba sửa a11y ở tầng token

| Sửa | Trước | Sau |
| --- | --- | --- |
| Eyebrow `faint` → `muted`; `faint` **cấm dùng cho chữ** | 2.45:1 | 7.41:1 |
| Thêm token `line-strong` cho viền control | 1.27:1 | 4.83:1 |
| Semantic ở light dồn về `-700` | 3.19–3.30:1 | 4.56–4.81:1 |

`line` (zinc-200) vẫn hợp lệ cho divider trang trí — WCAG 1.4.11 không áp cho đường kẻ
thuần trang trí. Nhưng viền input là thứ **duy nhất** chỉ ra ranh giới control nên phải
≥3:1; default `colorBorder` của antd cũng mắc lỗi này, nên phải set trong `ConfigProvider`.

Cả hai theme đã đo **0 FAIL** WCAG AA trước khi vẽ bất kỳ mockup nào.

## 7. Header card xếp dọc ở mobile

`SectionCard` header cũ là một hàng flex với `extra` đặt `flex-shrink:0` và nút
`whitespace-nowrap`. Ba hành động của step 4 (`Cải thiện CV` · `Viết thư ứng tuyển` ·
`So phiên bản`) cộng lại rộng hơn 375px, và vì `extra` bị cấm co nên nó **tràn và đè lên
tiêu đề**.

Dưới 768: header xếp dọc, `extra` một hàng riêng full-width. Từ `md:`: một hàng, `extra`
được co + `flex-wrap`. Thành luật §5 số 7 vì nó không riêng của step 4.

Ba hành động của step 4 ở mobile mỗi cái chiếm trọn một dòng — **không** thu vào menu như
nhóm icon của thư viện. Khác biệt: nhóm thư viện là 6 nút icon phụ trợ, còn ba nút này là
mục đích của màn (hai cái sinh ra thứ mới từ báo cáo, cái thứ ba nhìn lại xem CV có tốt
lên). Full-width cũng đưa hit-area lên 40px, đạt NFR-A11Y-03.

## 8. Phạm vi

**11 màn** × 375 / 768 / 1440, cộng dark ở shell + step 4 + specimen, cộng 6 modal. Mockup
đã duyệt: canvas nội trú, 49 artboard. Theo `feature-flow`, **không có mock nào được lưu
vào repo** — layout nào cần sống lâu hơn feature này thì nằm ở `MASTER.md`, divergence nào
cần một quyết định thật thì nằm ở ADR.

**Không đổi:** `PageContainer`, API của `SectionCard` (chỉ thêm slot `eyebrow`), cấu trúc
route, mọi hành vi server, mọi endpoint. Đây là feature **chỉ ở tầng trình bày** — không
FR mới, không US mới. Việc theo dõi nằm ở `04-state/backlog.md`.

**Kéo theo, phải sửa trong cùng PR:** `client/.claude/rules/layout-primitives.md` chép lại
bảng token và thang chữ nên nó trôi ngay khi `MASTER.md` đổi.

## 9. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Ba webfont làm nhấp nháy khi SSR hydrate (§5 luật 4 đã ghi một lần) | `@fontsource` tự host + preload woff2 + `font-display: swap`; kiểm bằng mắt trên app thật ở bước 5 của flow |
| Đổi accent không lan tới 7 chỗ hard-code | Grep `blue-|indigo-` trong `client/src` phải về **0** hit; đưa vào bước verify |
| `colorPrimary` của antd lệch `--color-primary` | Đã xảy ra một lần ở bảng màu cũ. Test đọc cả hai giá trị |
| Sửa `h-screen` làm vỡ scroll ở một tầng bề rộng | Playwright đã có 3 project viewport; chạy đủ cả ba |
