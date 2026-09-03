# ADR-0005 · Gọi AI qua OpenRouter bằng SDK `openai`

> **Ngày:** 2026-07-24 (thay quyết định Gemini ngày 2026-07-14)
> **Trạng thái:** accepted
> **Liên quan:** FR-04 · ADR-0010

## 1. Bối cảnh

Engine hybrid cần **hai** năng lực từ nhà cung cấp: sinh văn bản (báo cáo) và
embedding (vector). Lần chọn đầu là Gemini, nhưng khoá thử nghiệm hết quota
generation nên không chạy được tới đầu.

## 2. Quyết định

Gọi AI qua **OpenRouter**, dùng SDK `openai` (OpenRouter là endpoint
OpenAI-compatible). Mặc định: chat `openai/gpt-4o-mini` cho báo cáo,
`openai/text-embedding-3-small` cho embedding. Cấu hình model qua env
`OPENROUTER_CHAT_MODEL` / `OPENROUTER_EMBED_MODEL`.

**Không có nhánh mock**: không chạy được AI thì báo lỗi, không trả số giả.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Google Gemini trực tiếp (chọn 2026-07-14) | Khoá hết quota generation, không chạy được tới đầu |
| Hai nhà cung cấp khác nhau cho chat và embed | Hai khoá, hai hợp đồng lỗi, không lợi gì ở MVP |
| Fallback sang kết quả mock khi AI lỗi | Số giả trông y hệt số thật — sai âm thầm |

## 4. Hệ quả

**Được:**
- Một khoá phủ cả chat lẫn embeddings.
- SDK `openai` trở thành **giao diện duy nhất** để nói chuyện với AI, nên thêm provider
  về sau chỉ là đổi `baseURL` + tên model ([ADR-0010](0010-provider-whitelist-chat-va-embed.md)).

**Mất / phải chấp nhận:**
- Phụ thuộc một lớp trung gian: OpenRouter hỏng là cả hai chân AI hỏng.
- Model mặc định gắn vào tên của OpenAI, đổi provider thì tên model phải đổi theo.

**Điều kiện xem lại quyết định này:** nếu OpenRouter đổi giá hoặc bỏ endpoint
embeddings.
