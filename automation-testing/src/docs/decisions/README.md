# docs/decisions/

**Vì sao requirement lại như vậy.** Một file mỗi module: `<module>.md`, đi cặp với `requirements/<module>.md`.

Các mục:

1. **Nguồn**: file trong `docs/` của app và file code đã đọc (đường dẫn), requirement user đưa trong chat (chép nguyên
   văn, kèm ngày), ngày đọc.
2. **Quyết định chốt qua hỏi đáp**: `Q1 …` câu hỏi → quyết định → REQ bị ảnh hưởng. Quyết định mới thay quyết định cũ.
3. **Tài khoản test**: dùng tài khoản nào, trạng thái gì, tạo bằng gì (không ghi mật khẩu).
4. **Ngoài phạm vi**: thứ cố ý không test và lý do.
5. **Tech debt liên quan**.

Khi kỳ vọng của test bị nghi ngờ, đây là nơi trả lời "ai quyết định, lúc nào".
