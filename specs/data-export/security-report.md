# Security Report — `data-export`

> Cổng §4.5, chạy 2026-08-09 trên toàn bộ diff của branch `feat/data-export` (4 repo).
> Hai vòng: **audit độc lập** (verdict ban đầu **BLOCK**) → fix wave → **re-review** (verdict **MERGE**).
> Phương pháp: dispatch security-audit subagent theo §4.5 (slash `/security-review` không có trong project này), song song với final whole-branch review. Hai bên chạy độc lập và **cùng tìm ra một lỗi Critical giống nhau**.

## Verdict cuối: ⚠️ CONDITIONAL

An toàn để merge và chạy **local-only** — đúng điều kiện mà ADR #9 đã đặt ra cho toàn dự án. **Chưa an toàn để deploy public**, và có 2 mục dưới đây phải xử lý trước khi deploy, độc lập với việc Auth về hay chưa.

## Bối cảnh mô hình đe doạ

- **Không có auth.** Mọi request chạy dưới `STUB_USER_ID` hard-code; cô lập per-user chỉ tồn tại nhờ tầng service filter theo `userId`.
- `AiCredential` giữ API key AI của user, mã hoá AES-256-GCM tách làm 3 cột `encryptedKey` / `keyIv` / `keyTag`. Bất biến của dự án: 3 cột này **không bao giờ** rời tầng service.
- `Document.fileData` giữ file gốc user upload, cap 10MB. `Document.title` là text user kiểm soát hoàn toàn.

## Findings đã sửa trong branch này

### [High → đã sửa] Toàn bộ kho tài liệu bị nạp vào RAM trước khi gửi byte đầu tiên

**Ở đâu**: `server/src/modules/me/me.service.ts`, `me.controller.ts`

**Vấn đề**: `buildExportArchive()` chạy hết vòng lặp append **trước khi** return, controller `await` nó. Không ai tiêu thụ `PassThrough` trong lúc đó, nên `async.queue` concurrency-1 của archiver tắc ở backpressure và **mọi Buffer đã append nằm lại**. Bộ nhớ đỉnh = tổng toàn bộ file của user, **đúng con số mà một fix round trước đó tuyên bố đã loại bỏ** — comment trong code khẳng định điều ngược lại với thực tế.

**Tác động**: 10MB/file × số file không giới hạn. ~200 tài liệu ≈ 2GB resident → OOM giết tiến trình cho mọi user. Thêm nữa `res.on("close") → archive.abort()` đăng ký **sau** giai đoạn tốn kém, nên client ngắt kết nối không huỷ được gì.

**Đã sửa**: vòng lặp append chuyển sang chạy **detached** để controller kịp pipe trước. Xem mục "Còn tồn tại" — sửa này cải thiện nhưng **chưa chặn hẳn**.

### [Medium → đã sửa] Zip cụt được giao cho client dưới dạng 200 OK

**Ở đâu**: `me.service.ts` + `StreamableFile` mặc định của Nest

**Vấn đề**: `stream.destroy(err)` được viết với chủ ý "cho client thấy file hỏng rõ ràng". Nó làm **ngược lại**: handler mặc định của Nest gọi `res.end()` khi header đã gửi — đó là một chunked-encoding kết thúc sạch. `fetch` resolve bình thường, `arrayBuffer()` trả zip một phần, UI hiện thông báo **thành công**.

**Tác động**: mất dữ liệu âm thầm trên chính một tính năng về data-portability. User có export chết ở tài liệu 3/5 nhận được file hỏng kèm chữ "đã tải xong".

**Đã sửa**: `setErrorHandler` tự viết, `res.destroy(err)` khi `headersSent`.

### [Medium → đã sửa] Ciphertext bị đọc khỏi DB và truyền qua ranh giới module vô cớ

**Ở đâu**: `me.service.ts`, `export-manifest.ts`

**Vấn đề**: `aiCredential.findMany` không có `select` nên nạp cả `encryptedKey`/`keyIv`/`keyTag`; `ExportInput` còn **bắt buộc** 3 field đó, ép caller đưa secret cho một hàm thuần không bao giờ đọc tới chúng. Mapper hiện tại đúng, nhưng một `console.log(input)`, một error mang theo object input, hay một lần refactor sang spread là đủ biến chúng thành bytes trong zip.

**Đã sửa**: `select` tường minh chỉ 10 cột cần export; 3 field bị gỡ khỏi `Pick` của `ExportInput`. Secret giờ **không bao giờ được materialize** trên đường này.

### [Low → đã sửa] Các mục nhỏ

`Cache-Control: no-store` (response chứa toàn bộ PII, trước đó cacheable) · `findUniqueOrThrow` trả 500 thô thay vì `NotFoundException` i18n · lỗi trước khi gửi header lộ `err.message` thô với status 400 · `URL.revokeObjectURL` gọi cùng tick với click (Safari huỷ download).

## Đã kiểm tra, không có vấn đề

- **Tên entry trong zip**: `slugifyDocumentName` lowercase → NFD → xoá `\p{M}` → map `đ` → gộp mọi thứ ngoài `[a-z0-9]` thành `-`. Một allow-list duy nhất đó loại sạch `../`, `/`, `\`, ổ đĩa, `/` đầu chuỗi, NUL, và ký tự đảo hướng RTL trong một bước. Slug cắt 60 ký tự trước hậu tố 6 hex. Đuôi lấy từ allow-list 2 mime, không bao giờ từ tiêu đề. **Không tìm ra đường thoát khỏi `documents/`.**
- **Đụng độ tên entry**: cần slug 60 ký tự trùng **và** 6 hex đầu của UUID server sinh trùng — không đạt được bằng cách đặt tiêu đề.
- **Header injection**: mọi byte của `Content-Disposition` là `export-<ngày>.zip` do server sinh, chỉ `[a-z0-9-.]`. Không có đường cho dữ liệu user vào.
- **Cô lập per-user**: cả 5 truy vấn đều filter `userId`, gồm cả `$queryRaw` (tagged template → tham số bind `$1`, không SQL injection) và lần đọc bytes trong vòng lặp (`findFirst` có `userId`, không phải `findUnique` theo id trần).
- **Mapping manifest**: field-by-field, không spread. Assertion pin **chính xác tập key** trong spec khiến một cột thêm sau này làm **fail test** thay vì rò rỉ.
- **Swagger**: `@ApiOkResponse` khai `application/zip` không kèm schema; không DTO nào chứa cột credential được đăng ký.
- **Logging**: không có `Logger`, `console`, hay serialize error object ở bất kỳ đâu trong `src/modules/me/`.
- **Client**: `href` là blob URL do browser sinh, `download` là hằng số client — không có đường từ bytes server hay `Content-Disposition` vào. Không `innerHTML`. Copy lỗi lấy từ i18n, không bao giờ từ message của server.

## Còn tồn tại — phải xử lý trước khi deploy public

### 1. [Medium] Hàng đợi append vẫn không có chặn trên

`archiver.append()` đồng bộ và đẩy vào `async.queue` **không giới hạn**; nó không trả tín hiệu backpressure. Vòng lặp chỉ bị ghìm bởi round-trip DB, không bởi tốc độ archiver rút hàng. Với client chậm hơn DB — tức **mọi client ở xa** — mức đỉnh vẫn xấp xỉ toàn bộ kho tài liệu.

Fix wave đã chuyển từ *"chắc chắn buffer toàn bộ trước khi gửi gì"* sang *"buffer theo chênh lệch tốc độ DB và socket"*. Là cải thiện thật, **không phải** chặn thật. Muốn chặn cứng thì vòng lặp phải `await` sự kiện `'entry'` của archiver cho từng tài liệu.

### 2. [Medium] Không có rate limit riêng cho endpoint đắt nhất

Chỉ có `ThrottlerModule` toàn cục 100 req/60s, dùng chung với `GET /health`. Tức cho phép 100 lần export toàn kho mỗi phút mỗi IP, và không có guard chống chạy song song. Kết hợp với mục 1 thì một vòng lặp request rẻ tiền là đủ làm cạn bộ nhớ.

Đề xuất: `@Throttle({ default: { ttl: 3_600_000, limit: 5 } })` trên handler, kèm guard chặn export thứ hai đang bay của cùng user bằng 429.

### 3. [Medium] Server bind `0.0.0.0` trong khi chưa có auth

`app.listen(port)` lắng nghe trên mọi network interface. Dữ liệu này vốn đã lấy được không cần auth qua `/documents` và `/match/:id`, nên đây là **khuếch đại** chứ không phải lỗ mới — nhưng nó gom toàn văn CV, báo cáo AI, file PDF gốc và metadata credential vào **một request ẩn danh duy nhất**. CORS không cứu được: nó chặn browser đọc, không chặn `curl`.

Ai chung mạng LAN (quán cà phê, khách sạn, văn phòng) chạy được `curl http://<host>:5200/api/v1/me/export` và mang đi trọn bộ PII.

Đề xuất: `app.listen(port, "127.0.0.1")` trong lúc auth còn defer.

> **Mục 2 và 3 cố ý không sửa trong branch này** — cả hai là thay đổi phạm vi toàn ứng dụng (`src/main.ts`, chính sách rate-limit), vượt ra ngoài feature. Cần quyết định của owner.

## Rủi ro chấp nhận theo thiết kế

- **Không có auth** — defer theo Roadmap; cô lập per-user chỉ dựa vào filter `userId` ở tầng service. Chấp nhận cho vận hành local. **Nhưng endpoint này là cái không được ship trước khi auth về.**
- **Export chứa toàn văn CV, báo cáo AI và file gốc** — đó là chính tính năng; độ nhạy cảm là bản chất, không phải khiếm khuyết.
- **Metadata credential (`label`, `keyLast4`, `provider`, tên model) có trong export** — đã ghi là chỉ để hiển thị, không đủ tái tạo key.
- **Ngày trong tên file do client tính** có thể lệch server 1 ngày — đánh đổi đã ghi trong code, thuần thẩm mỹ.

## Ghi chú về quy trình

Lỗi High được **hai review độc lập cùng tìm ra** (security audit và final whole-branch review), trong khi **7 vòng review theo từng task đều bỏ lọt**. Lý do có tính cấu trúc: review theo task soi vòng lặp **cô lập** và xác nhận nó đúng — chỗ sai nằm ở **hình dạng lời gọi**, chỉ nhìn thấy khi trace từ controller xuống service. Đây là lý do tồn tại của cổng review toàn branch.
