# ADR-0011 · Multi-provider = N request độc lập + hiện dần

> **Ngày:** 2026-08-06
> **Trạng thái:** accepted
> **Liên quan:** FR-10 · NFR-PERF-05 · NFR-REL-04 · NFR-REL-05

## 1. Bối cảnh

User chọn N provider cho một cặp CV↔JD. Mỗi provider tốn 3 call AI và mất từ vài giây
tới vài chục giây. Provider chậm nhất không được kéo cả màn hình xuống theo.

## 2. Quyết định

Client bắn **N request song song**, mỗi provider một `MatchResult` trong cùng một
`MatchRun`. Card nào xong trước render trước, các card còn lại ở skeleton.
**Partial success là trạng thái hợp lệ**: provider lỗi thì lưu row `status=failed` +
`errorCode` và trả 201 — không ném 5xx (5xx chỉ còn cho lỗi cấu hình).

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Một request gom N provider, trả về khi xong hết | Wall-clock bằng provider chậm nhất **và** một provider lỗi làm hỏng cả lần chạy |
| Hàng đợi nền + polling / streaming | Hạ tầng chưa có, và không cần: N nhỏ, mỗi lần chạy là một hành động user chủ động |
| Ném 503 khi provider lỗi | Lần chạy hỏng biến mất khỏi lịch sử — đúng lúc dữ liệu **đã** rời hệ thống |

## 4. Hệ quả

**Được:**
- Wall-clock ≈ provider chậm nhất, không phải tổng.
- Lỗi của một bên là dữ liệu đọc lại được, không phải một sự cố nuốt mất.

**Mất / phải chấp nhận:**
- Cost là 3N call cho một lần bấm, nên UI phải nói rõ user đang chọn mấy provider (NFR-COST-01).
- Không cap số provider; ràng buộc duy nhất là user nhìn thấy con số trước khi bấm.

**Điều kiện xem lại quyết định này:** khi có hàng đợi nền (cần cho FR-19).
