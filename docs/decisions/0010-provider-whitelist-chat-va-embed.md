# ADR-0010 · Chỉ nhận provider có **cả** chat lẫn embeddings

> **Ngày:** 2026-08-06 (xác nhận 2026-08-08)
> **Trạng thái:** accepted
> **Liên quan:** FR-09 · FR-10 · ADR-0004 · ADR-0005

## 1. Bối cảnh

FR-10 cho user chạy cùng một cặp CV↔JD qua nhiều provider để đối chiếu. Việc đó chỉ có
nghĩa nếu mọi provider chạy **cùng một công thức điểm** — mà công thức đó cần hai năng
lực: embedding cho `semanticScore`, chat cho `report`.

## 2. Quyết định

Whitelist provider = **có cả chat lẫn embeddings API**. Hiện đạt: OpenRouter, OpenAI,
Google Gemini. Cả ba lái bằng **một SDK `openai`**, khác nhau chỉ ở `baseURL` và tên
model (Gemini có endpoint OpenAI-compatible phủ cả `/embeddings`).

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Nhận Anthropic | Không có embeddings API → không tính được `semanticScore` |
| Nhận provider embed-only (Voyage…) | Không sinh được `report` |
| Ghép chat của bên này với embed của bên kia | Kết quả không còn quy được về "provider nào chấm", nên hết so sánh được |
| Cho provider thiếu embed chạy với `semanticScore` rỗng | Điểm tổng khác thang, hai card cạnh nhau nói hai thứ khác nhau |

## 4. Hệ quả

**Được:**
- Mọi kết quả trong một `MatchRun` so được với nhau vì cùng công thức.
- Thêm provider mới là thêm một dòng cấu hình, không phải một nhánh code.

**Mất / phải chấp nhận:**
- Loại hẳn một số nhà cung cấp mạnh về chat, kể cả khi user muốn dùng.

**Điều kiện xem lại quyết định này:** nếu công thức điểm bỏ vế embedding, hoặc nếu một
provider bị loại bổ sung embeddings API.
