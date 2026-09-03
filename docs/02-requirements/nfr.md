# Yêu cầu phi chức năng

> **Trả lời:** Ngưỡng nào áp cho **mọi** feature, để không phải nhắc lại từng lần?
> **Trạng thái:** 🟢 đủ — đã rà theo dự án 2026-09-03
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** thêm loại tài nguyên mới · thêm nhóm người dùng · sau sự cố sinh ra ngưỡng mới

<!-- CÁCH ĐIỀN
Mỗi dòng phải ĐO ĐƯỢC. Không viết được cách kiểm thì chưa phải yêu cầu.
ID không tái dùng. Bỏ một ngưỡng thì đổi thành ~~(bỏ)~~, không xoá dòng.
Tài liệu thiết kế của feature tham chiếu ID ở dòng `Liên quan:` — KHÔNG chép nội dung sang.
-->

## Performance

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-PERF-01 | Mọi endpoint trả danh sách đều phân trang. Mặc định 20, tối đa 100 | review code |
| NFR-PERF-02 | p95 < 300ms cho endpoint đọc, < 800ms cho endpoint ghi — **không tính endpoint gọi AI** | đo trên môi trường gần production |
| NFR-PERF-03 | Không có truy vấn N+1 trên đường đi chính | bật log query rồi đi qua luồng chính |
| NFR-PERF-04 | Mọi cột dùng để filter hoặc sort đều có index | review migration |
| NFR-PERF-05 | Nhiều provider chạy **song song, N request độc lập**: wall-clock ≈ provider chậm nhất, không phải tổng | đo một lần chạy 3 provider |
| NFR-PERF-06 | Match chạy đồng bộ có UI loading. Không có hàng đợi nền ở giai đoạn này — mọi endpoint AI phải có timeout và trạng thái lỗi trên UI | review + thử tay |

## Cost

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-COST-01 | Một lần chạy N provider tốn **3N call AI** (2 embed + 1 chat mỗi provider). UI phải cho user thấy họ đang chọn mấy provider **trước khi** bấm chạy | thử tay |
| NFR-COST-02 | Màn hình chỉ để **đọc lại** kết quả cũ (so sánh phiên bản, lịch sử, xem trước) **không được gọi AI** | review import graph của module |
| NFR-COST-03 | Tính lại điểm cho dữ liệu cũ phải làm được **không tốn call AI** — `rawText` và `semanticScore` đã lưu | review script |

## Security

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-SEC-01 | Mọi mutation kiểm quyền ở **server**. Không tin bất kỳ dữ liệu nào từ client | test cho từng endpoint |
| NFR-SEC-02 | Không log PII, token, mật khẩu, hay nội dung tài liệu người dùng | review format log |
| NFR-SEC-03 | ~~Rate limit endpoint đăng nhập / đăng ký / quên mật khẩu~~ **(bỏ — chưa có auth, FR-18)**. Thay bằng NFR-SEC-07 | — |
| NFR-SEC-04 | Secret chỉ đọc từ biến môi trường. Không hardcode, không commit | grep + review |
| NFR-SEC-05 | Dependency không có lỗ hổng mức high trở lên | `yarn audit` |
| NFR-SEC-06 | Lỗi trả về client không chứa stack trace, tên bảng, hay câu SQL | test |
| NFR-SEC-07 | Rate limit toàn cục 100 req/60s (`ThrottlerGuard`); endpoint gọi AI có ngưỡng riêng chặt hơn | review guard + test |
| NFR-SEC-08 | Token AI của user mã hoá at-rest bằng **AES-256-GCM**, khoá từ env `CREDENTIAL_ENCRYPTION_KEY`. Không lưu plaintext | review code + đọc DB |
| NFR-SEC-09 | API **không bao giờ** trả lại plaintext token: response chỉ có provider + nhãn + `••••1234` + trạng thái test | test cho từng endpoint |
| NFR-SEC-10 | Token AI không xuất hiện trong log, message lỗi, response `/match`, hay ví dụ Swagger | grep + review |
| NFR-SEC-11 | File nạp lên được kiểm **size limit + type check** trước khi parse | test |

## Accessibility

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-A11Y-01 | Tương phản chữ thường ≥ 4.5:1, chữ lớn ≥ 3:1 | devtools |
| NFR-A11Y-02 | Mọi hành động thao tác được bằng bàn phím, và focus luôn thấy được | thử tay |
| NFR-A11Y-03 | Vùng bấm ≥ 44×44px trên thiết bị cảm ứng | review mockup |
| NFR-A11Y-04 | Mọi input có label liên kết; thông báo lỗi đọc được bởi screen reader | review |
| NFR-A11Y-05 | Tôn trọng `prefers-reduced-motion` | review CSS |

## i18n

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-I18N-01 | Không hardcode chuỗi hiển thị trong code. BE `nestjs-i18n`, FE `i18next`, locale `en` + `vi` | grep |
| NFR-I18N-02 | Thời gian lưu ở UTC; đổi múi giờ chỉ xảy ra ở tầng hiển thị | test |
| NFR-I18N-03 | Định dạng số, tiền, ngày theo locale của người dùng | review |
| NFR-I18N-04 | **Ngôn ngữ nội dung do AI sinh là lựa chọn riêng của user**, không suy từ locale giao diện | test |

## Reliability

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-REL-01 | Mọi lệnh gọi ra ngoài có timeout và có nhánh xử lý lỗi | review |
| NFR-REL-02 | Tác vụ ghi quan trọng là idempotent — retry không tạo bản ghi trùng. Seed cũng vậy (upsert theo id) | test |
| NFR-REL-03 | Không có trạng thái loading vô hạn: mọi request đều có nhánh lỗi trên UI | thử tay |
| NFR-REL-04 | **Lỗi của một provider là dữ liệu, không phải sự cố**: lưu row `status=failed` + `errorCode` và trả 201, không ném 5xx. 5xx chỉ dành cho lỗi cấu hình | test |
| NFR-REL-05 | Partial success là trạng thái hợp lệ: một provider hỏng không được làm hỏng kết quả của provider khác trong cùng lần chạy | test |

## Data & Privacy

| ID | Ngưỡng | Cách kiểm |
| --- | --- | --- |
| NFR-DATA-01 | Trường nào là PII được liệt kê rõ ở bảng dưới | bảng dưới |
| NFR-DATA-02 | Xoá tài khoản thì xoá hoặc ẩn danh hoá toàn bộ PII của tài khoản đó | test |
| NFR-DATA-03 | Có đường khôi phục dữ liệu: backup, hoặc migration ngược đã thử thật | thử thật một lần |
| NFR-DATA-04 | Dữ liệu cô lập theo user: tài liệu và kết quả của user này user khác không đọc được | test cho từng endpoint |
| NFR-DATA-05 | **Trước khi** tài liệu rời hệ thống, UI phải nêu đích danh provider sắp nhận — kể cả khi có nhiều provider trong một lần chạy | thử tay |

**Trường PII trong dự án này:**

| Trường | Nằm ở | Giữ bao lâu |
| --- | --- | --- |
| Nội dung CV / JD (`rawText` + file gốc) | `Document` | Tới khi user xoá — chưa có retention tự động (overview §4) |
| Báo cáo match (`report`) — trích lại nội dung CV/JD | `MatchResult` | như trên |
| Thư ứng tuyển | `CoverLetter` | như trên |
| Token AI của user | `AiCredential`, mã hoá AES-256-GCM | tới khi user xoá |
| `email` · `fullName` · `avatar` · `phone` | `User` (📝 **chưa có trong schema**) | tới khi user xoá |
