# DOCUMENTS — Lưu tài liệu, cô lập theo user (FR-02) và thư viện `/cv` + `/jd` (FR-07)

## Lưu tài liệu — `POST /documents`

- **REQ-DOCUMENTS-01** `save=true` bắt buộc có `title` không rỗng sau khi trim; thiếu hoặc chỉ khoảng trắng → 400 `documents.errors.titleRequiredWhenSaving` theo ngôn ngữ của request. Title được lưu ở dạng đã trim.
- **REQ-DOCUMENTS-02** `save=true` → `isSaved=true` và tài liệu hiện trong `GET /documents?kind=<kind>&saved=true`; `save=false` → `isSaved=false`, không hiện trong thư viện nhưng vẫn đọc được qua `GET /documents/:id`.
- **REQ-DOCUMENTS-03** `save=false` không có title → title tự suy từ dòng đầu tiên không rỗng (đã trim); dài hơn 80 ký tự thì cắt còn 80 ký tự + `…`.
- **REQ-DOCUMENTS-04** Giới hạn đầu vào, vượt thì 400: `title` ≤ 200 ký tự, `sourceText` ≤ 100 000 ký tự, không có file mà text rỗng/chỉ khoảng trắng → `documents.errors.emptyText`, file > 10 MB → `documents.errors.fileTooLarge`, file không phải PDF/DOCX → `documents.errors.unsupportedFileType` (sai loại được kiểm trước, nên file vừa sai loại vừa quá cỡ nhận thông báo sai loại).
- **REQ-DOCUMENTS-05** Upload PDF/DOCX → `sourceFormat` = `pdf`/`docx`, `rawText` là text trích từ file, file gốc (`fileData` + `fileMime`) được lưu **bất kể `save`**; dán text → `sourceFormat=text`, không lưu file gốc. `DocumentDto` và `DocumentSummaryDto` không bao giờ chứa `fileData`/`fileMime`.
- **REQ-DOCUMENTS-06** Người chưa có session gọi `POST /documents` → server tạo user khách, trả cookie `mcv_session` và tài liệu thuộc về khách đó; khi khách đăng nhập, tài liệu của khách chuyển sang user thật và thành `isSaved=true`.

## Danh sách — `GET /documents`

- **REQ-DOCUMENTS-07** Chỉ trả tài liệu của user hiện tại, lọc theo `kind` (CV|JD) và `saved` khi có, sắp `createdAt` giảm dần; mỗi phần tử gồm `{id, kind, title, sourceFormat, parentId, createdAt}`, không có `rawText`.
- **REQ-DOCUMENTS-08** `kind` không thuộc `CV|JD` → 400.
- **REQ-DOCUMENTS-09** Danh sách chỉ dành cho user đã đăng nhập: không session hoặc session khách → 401 `{ code: "SIGN_IN_REQUIRED" }` với message `auth.errors.signInRequired` theo ngôn ngữ của request.

## Chi tiết + file gốc

- **REQ-DOCUMENTS-10** `GET /documents/:id` trả `DocumentDto` (có `rawText`) cho chủ sở hữu; khách được gọi nhưng chỉ đọc được tài liệu của chính mình.
- **REQ-DOCUMENTS-11** Tài liệu của user khác và tài liệu không tồn tại đều → 404 `documents.errors.notFound`, cùng một body (không phân biệt được hai trường hợp); `:id` không phải UUID → 400.
- **REQ-DOCUMENTS-12** `GET /documents/:id/file` trả đúng byte gốc, `Content-Type` = mime gốc (`application/pdf` hoặc MIME DOCX), `Content-Disposition` mặc định `inline`, `attachment` khi `?download=1`, tên file `<title đã sanitize>.<pdf|docx>`.
- **REQ-DOCUMENTS-13** File gốc của tài liệu dán text (không có file), của user khác, hoặc không tồn tại → 404 `documents.errors.noOriginalFile`.
- **REQ-DOCUMENTS-14** Tên file trong `Content-Disposition` không cho header injection: mọi chuỗi ký tự ngoài `[\w.-]` thành một `_`, cắt còn 100 ký tự; response có `X-Content-Type-Options: nosniff`.

## Đổi tên — `PATCH /documents/:id`

- **REQ-DOCUMENTS-15** `title` được trim; 1–200 ký tự → 200 + `DocumentDto` với title mới (đọc lại thấy title mới); rỗng, chỉ khoảng trắng, thiếu, không phải chuỗi hoặc > 200 ký tự → 400; đặt lại đúng tên cũ → 200.
- **REQ-DOCUMENTS-16** Đổi tên tài liệu của user khác → 404 và title của họ không đổi; khách hoặc không session → 401.

## Xoá — `DELETE /documents/:id`

- **REQ-DOCUMENTS-17** Tài liệu không được kết quả match nào tham chiếu → 204, sau đó `GET /documents/:id` → 404.
- **REQ-DOCUMENTS-18** Tài liệu được ≥1 `MatchResult` tham chiếu (làm CV hoặc làm JD) → 409 `documents.errors.inUseByMatch`; tài liệu và kết quả match giữ nguyên.
- **REQ-DOCUMENTS-19** Xoá tài liệu của user khác, đã xoá hoặc không tồn tại → 404; khách hoặc không session → 401.
- **REQ-DOCUMENTS-20** Xoá tài liệu là bản trước (`parent`) của tài liệu khác → 204, bản sau còn nguyên và `parentId` của nó thành `null`.
- **REQ-DOCUMENTS-34** Xoá tài liệu chỉ được một `MatchRun` chưa có kết quả tham chiếu không bao giờ trả 5xx: hoặc 409 `documents.errors.inUseByMatch` (tài liệu giữ nguyên), hoặc 204 (tài liệu và run rỗng cùng bị xoá).

## UI thư viện `/cv`, `/jd`

- **REQ-DOCUMENTS-21** Người chưa đăng nhập hoặc khách mở `/cv` hay `/jd` → thấy cổng đăng nhập: tiêu đề `gate.cv` / `gate.jd`, mô tả `gate.description`, link `auth.signInWithDucker` tới `<API>/auth/login?returnTo=<đường dẫn hiện tại>` và link `gate.backMatching` về `/wizard`; trang không gọi API danh sách.
- **REQ-DOCUMENTS-22** User đã đăng nhập: h1 `library.title.cv` / `library.title.jd`, phụ đề `library.subtitle` với đúng số tài liệu đã lưu của kind đó.
- **REQ-DOCUMENTS-23** Mỗi dòng có title (dài thì cắt, trang không cuộn ngang), badge định dạng `format.pdf|docx|text` (không phải enum thô) và ngày tạo theo locale UI; `/cv` chỉ có CV đã lưu, `/jd` chỉ có JD đã lưu; mới nhất ở trên.
- **REQ-DOCUMENTS-24** Nút icon `library.action.menu` mở menu: Preview, Rename, "Mark as a new version of…", Download (chỉ khi tài liệu có file gốc), Delete; "Compare versions" chỉ có ở `/cv` và chỉ khi tài liệu có `parentId`.
- **REQ-DOCUMENTS-25** Trong lúc tải chưa hiện phụ đề đếm hay trạng thái rỗng; tải lỗi → `role="alert"` `library.loadError`; rỗng → `library.empty.cv|jd`, `library.emptyHint` và nút `library.emptyCta` dẫn tới `/wizard`.
- **REQ-DOCUMENTS-26** Xem trước mở modal có tiêu đề là title tài liệu: PDF vẽ bằng canvas (`pdf-preview`), DOCX dựng DOM (`docx-preview`), text hiện `rawText` trong `<pre>` dạng chữ thuần (không render HTML); trong lúc tải hiện `preview.loading`; tải file gốc lỗi → `role="alert"` `preview.error`, trang không crash.
- **REQ-DOCUMENTS-27** Xem trước không gửi request nào ra host ngoài (không viewer bên thứ ba); chỉ gọi API của app.
- **REQ-DOCUMENTS-28** Footer modal xem trước có `preview.download` (chỉ PDF/DOCX) và `preview.close`; Esc hoặc nút đóng → modal đóng và gỡ khỏi DOM; đổi ngôn ngữ UI khi đang xem PDF không gây lỗi trang.
- **REQ-DOCUMENTS-29** Đổi tên: modal `library.rename.title`, input có label `library.rename.label`, điền sẵn title cũ, tối đa 200 ký tự; Save bị khoá khi trim rỗng; Enter = Save; thành công → toast `library.rename.success`, modal đóng, dòng hiện title mới; lỗi → toast `library.rename.failed`, modal vẫn mở. Không cập nhật lạc quan: dòng đổi sau khi server trả về.
- **REQ-DOCUMENTS-30** Tải xuống (menu hoặc footer xem trước) → trình duyệt nhận file `<title>.<pdf|docx>` đúng định dạng gốc.
- **REQ-DOCUMENTS-31** Xoá: Popconfirm `library.delete.confirm` với nút `library.action.delete` và `action.cancel`; xác nhận thành công → toast `library.delete.success`, dòng biến mất, phụ đề đếm giảm 1; 409 → toast `library.delete.inUse`, dòng còn nguyên; lỗi khác → `library.delete.failed`; huỷ → không gửi request xoá; trong lúc xoá mục Delete bị khoá.
- **REQ-DOCUMENTS-32** Mọi chuỗi UI và message lỗi của server ở trên có cả `en` và `vi`, không hiện raw key.
- **REQ-DOCUMENTS-33** Menu hành động, modal và popconfirm dùng được bằng bàn phím: nút icon có accessible name, Enter mở menu, Esc đóng menu/modal, focus nằm trong modal khi Tab.
- **REQ-DOCUMENTS-35** Xem trước PDF hiện **mọi** trang của file, không chỉ trang 1.
- **REQ-DOCUMENTS-36** Modal xem trước hiện `preview.error` (không quay vô hạn) khi `GET /documents/:id` lỗi (vd tài liệu vừa bị xoá ở tab khác).
- **REQ-DOCUMENTS-37** Trạng thái lỗi tải danh sách có nút thử lại; bấm → gọi lại API và hiện danh sách khi thành công.
- **REQ-DOCUMENTS-38** Tên file tải về giữ được tên gốc có dấu: `Content-Disposition` kèm `filename*=UTF-8''<title đã percent-encode>.<ext>` (RFC 5987) bên cạnh `filename` ASCII an toàn.
