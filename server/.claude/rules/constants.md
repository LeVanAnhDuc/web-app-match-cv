---
name: constants
paths:
  - "src/**"
---

Magic value / giá trị domain lặp lại → đặt thành **named constant**, không hardcode inline rải rác. Project nhỏ → giữ nhẹ, thực dụng.

## Quy tắc

1. **Named constant thay vì magic literal**: số/regex/threshold có ý nghĩa domain đặt tên `UPPER_SNAKE_CASE`:
   - `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`, `ALLOWED_FILE_TYPE_REGEX` (documents.controller).
   - `TITLE_FALLBACK_LENGTH = 80` (documents.service).
   - `SEMANTIC_WEIGHT = 0.6`, `KEYWORD_WEIGHT = 0.4`, `MIN_TOKEN_LENGTH = 2`, `MAX_MATCH_CHARS = 20_000` (matching.service).
   - `PARSE_TIMEOUT_MS = 15_000`, `MAX_EXTRACTED_CHARS = 2_000_000`, `PDF_MIME`, `DOCX_MIME` (parsing.ts).
2. **Đặt gần nơi dùng — module-local `const`** ở đầu file, đủ cho project quy mô này. KHÔNG dựng `src/constants/` global cho domain value trừ khi thực sự cross-module.
3. **Value dùng chéo file trong cùng module → export từ file sở hữu concept**: vd `PDF_MIME` / `DOCX_MIME` export từ `parsing.ts`, controller import lại — KHÔNG khai trùng literal ở nhiều nơi.
4. **Constant nhiều dòng / là danh sách** (vd `STOPWORDS` set) vẫn để module-local, có comment giải thích ý đồ + phạm vi (như comment "conservative stopword list").
5. **KHÔNG hardcode env** thành constant — env đi qua config layer (`env.validation.ts`, xem `config.md`). Constant chỉ chứa magic value không phụ thuộc runtime.
6. Số có đơn vị dùng separator dễ đọc (`100_000`, `2_000_000`, `20_000`) và comment nêu rõ đơn vị / lý do (security cap, cost bound) khi không hiển nhiên.

Nguyên tắc: cùng một giá trị xuất hiện ≥2 chỗ, HOẶC một literal cần giải thích "tại sao con số này" → tách thành named constant. Một literal tầm thường dùng đúng 1 chỗ thì không cần over-engineer.
