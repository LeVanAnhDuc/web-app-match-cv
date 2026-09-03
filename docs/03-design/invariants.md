# Bất biến chịu lực

> **Trả lời:** Sửa gì thì hệ thống sai **âm thầm** — test vẫn xanh mà kết quả vẫn sai?
> **Trạng thái:** 🟢 đủ — đã rà theo dự án 2026-09-03
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** phát hiện một bất biến mới — thường là ngay sau khi ai đó vừa phá nó

<!-- CÁCH ĐIỀN
ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ DÒNG CODE NÀO.
Bất biến ở đây KHÁC quy ước code: không công cụ nào bắt được, và vi phạm thì code
vẫn chạy, test vẫn xanh, chỉ có kết quả là sai.
GIỮ FILE NÀY < 40 DÒNG NỘI DUNG.
KHÔNG chứa: quy ước format/naming (-> lint config), kiến trúc (-> architecture.md).
-->

## Chung

| # | Bất biến | Vi phạm thì sao |
| --- | --- | --- |
| 1 | Thời gian lưu ở **UTC**. Đổi múi giờ chỉ ở tầng hiển thị | Lệch một ngày ở biên múi giờ. Test viết theo giờ máy vẫn xanh |
| 2 | Mọi mutation kiểm quyền ở **server**, kể cả khi UI đã ẩn nút | Gọi API trực tiếp là sửa được dữ liệu người khác |
| 3 | Chỉ tầng service truy vấn datastore. Controller không query trực tiếp | Bỏ qua lớp kiểm quyền và validate nằm trong service |
| 4 | Không tin `id` từ client để xác định quyền sở hữu — luôn đối chiếu `CurrentUserService.getUserId()` | Truy cập chéo dữ liệu giữa các user. Với mock user hiện tại thì **không lộ ra**, và sẽ lộ đúng lúc Auth về (FR-18) |
| 5 | Tác vụ ghi quan trọng **idempotent** theo một khoá. Seed dùng upsert theo id | Retry hoặc double-click tạo bản ghi trùng |
| 6 | Migration **chỉ tiến**. Không sửa file migration đã chạy ở bất kỳ đâu | Lịch sử schema giữa các môi trường lệch nhau, không hoà giải được |

## Engine chấm điểm

| # | Bất biến | Vi phạm thì sao |
| --- | --- | --- |
| 7 | `overallScore = round(0.6 × semanticScore + 0.4 × keywordScore)`. **LLM không có mặt trong công thức** | Điểm hết tái lập được và trôi theo tâm trạng model. Báo cáo vẫn đọc thấy hợp lý |
| 8 | Đổi tokenizer hoặc trọng số ⇒ **phải chạy lại điểm cho `MatchResult` cũ** (`yarn recompute-scores`) | Hai hệ điểm nằm lẫn trong một bảng; so sánh phiên bản (FR-14) đọc ra delta vô nghĩa |
| 9 | Chỉ có **một** tokenizer: `matching/tokenizer.ts`. Ghép gap (`gap-diff.ts`) dùng lại đúng cái đó | Hai định nghĩa "token" lệch nhau, gap ghép sai mà không ai thấy |
| 10 | Delta giữa hai lần match **chỉ có nghĩa khi cùng chat model và cùng embed model**. Khác model ⇒ API phải trả cờ | `semanticScore` không cùng không gian vector; UI hiện một mũi tên tăng/giảm hoàn toàn bịa |
| 11 | `report.gaps` là free-text LLM sinh lại mỗi lần ⇒ **không bao giờ so nguyên văn** | Mọi gap vừa bị báo "đã đóng" vừa bị báo "mới phát sinh" |
| 12 | Provider và model được **chụp lại trên `MatchResult`**, không suy ngược từ credential hiện tại | User xoá hoặc đổi credential là kết quả cũ đổi ý nghĩa |

## Nội dung do AI sinh

| # | Bất biến | Vi phạm thì sao |
| --- | --- | --- |
| 13 | Mỗi thay đổi CV rewrite phải neo vào một đoạn **nguyên văn và duy nhất** của CV gốc. Kiểm ở **cả lúc sinh lẫn lúc lưu** | Bịa kinh nghiệm lọt vào CV user gửi đi thật — rủi ro pháp lý và đạo đức thuộc về user |
| 14 | CV rewrite **không ghi đè** `Document` gốc: luôn row mới + `parentId` | Mất bản gốc thì không so được phiên bản, và lineage gãy |
| 15 | Số phiên bản **suy từ chuỗi `parentId`** (walk cap 20), không lưu cột | `ON DELETE SET NULL` biến v2 thành gốc mới, cột đã lưu vẫn nói "2" |
| 16 | `report.gaps` đi vào prompt cover letter dưới nhãn **`MUST NOT CLAIM`**, và `omittedRequirements` phải hiện cho user | Lá thư nhận những gì CV không chống lưng được, và không ai biết |

## Dữ liệu rời hệ thống

| # | Bất biến | Vi phạm thì sao |
| --- | --- | --- |
| 17 | Token AI **không bao giờ** rời server dạng plaintext — không response, không log, không error, không Swagger example | Secret bậc cao nhất của app rò qua đường không ai nhìn |
| 18 | Nhật ký tiết lộ ghi **trước** call AI và **fail-closed**: ghi hỏng thì không gọi | Ca đáng lo nhất (dữ liệu đã đi rồi mới lỗi) là đúng ca không được ghi lại |
| 19 | Module chỉ để đọc lại (`ComparisonModule`, lịch sử, xem trước) **không import `AiModule`** | Mỗi lần user đổi dropdown là một lần tài liệu rời hệ thống mà họ không hề bấm gì |
