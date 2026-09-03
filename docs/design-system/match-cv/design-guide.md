# Design Guide — ý đồ thiết kế

> **Trả lời:** Ý đồ thiết kế — khi nào dùng gì, và tại sao?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · chuyển từ `.claude/uiux/`
> **Cập nhật khi:** xuất hiện một pattern mới · đổi nguyên tắc thiết kế

> Rút từ mock `cv-jd-matching-wizard` (user duyệt 2026-07-24). Token nằm ở
> [`MASTER.md`](MASTER.md) — file này **không** chứa token.

## 1. Design Principles

- **Trustworthy SaaS, uncluttered**: nhiều whitespace, card bo tròn lớn, 1 hành động chính rõ ràng mỗi màn.
- **Wizard tuyến tính**: stepper luôn hiển thị tiến trình 4 bước; mỗi bước 1 nhiệm vụ; primary "Next" phải, "Back" trái.
- **Progressive disclosure**: input chính (upload/paste) trước; reuse + save phụ, đặt dưới, nhẹ hơn.
- **Light + dark ngang nhau**: mọi màn hỗ trợ cả hai (dark đổi primary sang indigo + nền slate-900).

## 2. Màu — khi nào dùng gì

primary = hành động chính + trạng thái active. success (green) = điểm khớp/tích cực. warning (amber) = gap/thiếu. text-muted = phụ/metadata. Không dùng màu ngoài palette (xem [`MASTER.md`](MASTER.md) §1).

## 3. States

- **Empty**: reuse list chưa có → icon `search-x` + câu rõ nghĩa + hint (không để trống).
- **Loading**: parse file / chạy match (đồng bộ vài giây) → skeleton/spinner + disable action.
- **Error**: file sai type/size/parse fail → thông báo rõ, cho thử lại.
- **Disabled**: "Back" ở step 1; action khi thiếu input.

## 4. Card — khi nào

Mỗi bước wizard = 1 card chính. Panel phụ (save toggle, reuse) là sub-panel `surface-subtle` trong card.

## 5. Icon

1 khái niệm → 1 icon nhất quán (Lucide). Xem [`icon-map.md`](icon-map.md).

## 6. Accessibility — không bỏ qua

Radio group đúng semantics; focus ring; keyboard nav stepper; contrast 2 theme; label mọi control.

## 7. Do / Don't

- ✅ Dùng radio list cho reuse (thấy ngay). ❌ Đừng nhét vào dropdown.
- ✅ Luôn xuất light + dark. ❌ Đừng hardcode màu ngoài token.
- ✅ 1 primary action/màn. ❌ Đừng nhiều nút primary cạnh nhau.
