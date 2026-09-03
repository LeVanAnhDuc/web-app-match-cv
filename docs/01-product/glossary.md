# Thuật ngữ

> **Trả lời:** Khái niệm này gọi là gì trong code, và hiện ra sao trên UI?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** xuất hiện một khái niệm nghiệp vụ mới trong code hoặc UI

<!-- CÁCH ĐIỀN
File này KHOÁ TÊN GỌI. Chỉ thêm dòng khi khái niệm ĐÃ xuất hiện trong code hoặc UI.
KHÔNG chứa: giải thích nghiệp vụ dài (-> overview.md).
-->

| Thuật ngữ | Định nghĩa một câu | Tên trong code | Tên trên UI (VI) | Tên trên UI (EN) |
| --- | --- | --- | --- | --- |
| User | Người dùng của app này, sở hữu mọi tài liệu và kết quả | `User` | Người dùng | User |
| Document | Một CV hoặc JD do user nạp (PDF / DOCX / text), lưu lại để tái dùng | `Document` (`kind` = `CV` \| `JD`) | Tài liệu | Document |
| Lineage | Quan hệ cha–con giữa hai `Document`: bản sửa trỏ về bản gốc | `Document.parentId` | Phiên bản | Version |
| MatchResult | Kết quả chấm một cặp CV↔JD bằng một provider | `MatchResult` | Kết quả | Result |
| MatchRun | Một lần chạy match, gom N `MatchResult` của cùng cặp CV↔JD | `MatchRun` | Lần chạy | Run |
| Overall score | Điểm tổng: `0.6 × semantic + 0.4 × keyword` | `overallScore` | Độ khớp | Match |
| Semantic score | Cosine giữa hai vector embedding của CV và JD | `semanticScore` | Ngữ nghĩa | Semantic |
| Keyword score | `\|JD ∩ CV\| / \|JD\|` ở cấp token sau khi lọc stopword | `keywordScore` | Từ khoá | Keyword |
| Gap | Yêu cầu của JD mà CV không chống lưng được, do LLM nêu | `report.gaps` | Điểm thiếu | Gaps |
| Strength | Điểm khớp mạnh, do LLM nêu | `report.strengths` | Điểm mạnh | Strengths |
| AI credential | API token AI của user, mã hoá at-rest, không bao giờ trả lại plaintext | `AiCredential` | Khoá AI | AI credential |
| Provider | Nhà cung cấp AI đứng sau một credential (OpenRouter / OpenAI / Gemini) | `provider` | Nhà cung cấp | Provider |
| Anchored change | Một thay đổi CV rewrite, neo vào một đoạn nguyên văn duy nhất của CV gốc | `AnchoredChange` | Thay đổi đề xuất | Suggested change |
| Cover letter | Lá thư ứng tuyển sinh từ một cặp CV↔JD đã match | `CoverLetter` | Thư ứng tuyển | Cover letter |
| Mock user | `User` thật trong DB thay cho phiên đăng nhập, khi chưa có auth | `STUB_USER_ID` | — (không hiện) | — |

**Tên bị cấm:**

- Dùng `Document`, **không** dùng `File` / `Resume` / `Upload` cho cùng khái niệm.
- Dùng `MatchResult`, **không** dùng `Score` / `Report` làm tên thực thể (`report` chỉ là
  một trường **trong** `MatchResult`).
- **Không có `Job`** — JD chỉ tồn tại như một `Document`, xem overview §4 Non-Goals.
- Dùng "mock user", **không** dùng "stub user" — khái niệm cũ ám chỉ một id ảo ngoài DB,
  đã bỏ ở [ADR-0008](../decisions/0008-mock-user-la-user-that.md).
