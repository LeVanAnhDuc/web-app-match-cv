# DOCUMENTS — Test case

Lăng kính theo thứ tự: truy vết REQ → phân vùng tương đương (text/PDF/DOCX, đã lưu/chưa lưu, CV/JD, chủ/người khác/khách/ẩn danh) → biên (title 199/200/201, text 100 000/100 001, title tự suy 80/81, file 10 MiB + 1, tên file 100) → chuyển trạng thái (đang tải/lỗi/rỗng/có dữ liệu, modal mở/đóng, xoá rồi mới xem) → đoán lỗi (khoảng trắng, đang xoá bấm lại, huỷ, HTML trong text, CRLF trong title) → bảo mật (cô lập user, 404 không phân biệt, header injection, không gửi file ra ngoài).

Tầng API phủ tổ hợp input/biên/bảo mật; UI một case mỗi luồng, chạy trên desktop / tablet / mobile.

## Lưu tài liệu — `POST /documents`

### TC-DOCUMENTS-001 — dán JD với save=false trả 201 DocumentDto dạng text, chưa lưu

- **Requirement:** REQ-DOCUMENTS-02, REQ-DOCUMENTS-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST /documents` JSON `{kind: JD, sourceText, save: false}`
- **Mong đợi:** 201, `kind=JD`, `sourceFormat=text`, `rawText` = text gửi, `isSaved=false`, `parentId=null`, có `id`, `createdAt`
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-002 — lưu CV với save=true và title thì isSaved=true và có trong thư viện

- **Requirement:** REQ-DOCUMENTS-02
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` CV `save=true` + title → `GET /documents?kind=CV&saved=true`
- **Mong đợi:** 201 `isSaved=true`, title đúng; id có trong danh sách đã lưu
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-003 — tài liệu save=false không vào thư viện nhưng vẫn đọc được qua GET theo id

- **Requirement:** REQ-DOCUMENTS-02, REQ-DOCUMENTS-10
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có 1 CV `save=false`
- **Bước:** `GET /documents?kind=CV&saved=true`, `GET /documents/:id`
- **Mong đợi:** id không có trong danh sách; `GET :id` 200 `isSaved=false`
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-004 — save=true thiếu title hoặc title chỉ khoảng trắng trả 400 titleRequiredWhenSaving

- **Requirement:** REQ-DOCUMENTS-01, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` CV `save=true` với title thiếu / chỉ khoảng trắng, `Accept-Language` en và vi
- **Mong đợi:** 400, message = `documents.errors.titleRequiredWhenSaving` đúng ngôn ngữ
- **Kiểm chứng thêm:** không tài liệu nào được tạo
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-005 — title được trim trước khi lưu

- **Requirement:** REQ-DOCUMENTS-01
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` `save=true`, title có khoảng trắng hai đầu
- **Mong đợi:** title lưu ở dạng đã trim
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-006 — save=false không có title thì title là dòng đầu tiên không rỗng

- **Requirement:** REQ-DOCUMENTS-03
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` `save=false` không title, text bắt đầu bằng dòng trống/khoảng trắng
- **Mong đợi:** title = dòng đầu không rỗng đã trim
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-007 — title tự suy giữ nguyên 80 ký tự và cắt dòng 81 ký tự thành 80 ký tự kèm dấu ba chấm

- **Requirement:** REQ-DOCUMENTS-03
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** dòng đầu 80 ký tự; dòng đầu 81 ký tự (BVA)
- **Mong đợi:** 80 → giữ nguyên; 81 → 80 ký tự + `…`
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-008 — không có file mà text rỗng hoặc chỉ khoảng trắng trả 400 emptyText

- **Requirement:** REQ-DOCUMENTS-04, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` không file, `sourceText` thiếu / rỗng / chỉ khoảng trắng, en + vi
- **Mong đợi:** 400 `documents.errors.emptyText` đúng ngôn ngữ
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-009 — title 200 ký tự được nhận, 201 ký tự bị từ chối

- **Requirement:** REQ-DOCUMENTS-04
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` `save=true` title 200 rồi 201 ký tự (BVA)
- **Mong đợi:** 200 → 201 Created, title nguyên vẹn; 201 → 400
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-010 — sourceText 100000 ký tự được nhận, 100001 ký tự bị từ chối

- **Requirement:** REQ-DOCUMENTS-04
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `POST` `sourceText` 100 000 rồi 100 001 ký tự (BVA)
- **Mong đợi:** 100 000 → 201, `rawText` đủ độ dài; 100 001 → 400
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-011 — upload PDF trả 201 sourceFormat pdf với text trích từ file

- **Requirement:** REQ-DOCUMENTS-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** upload `data/files/sample.pdf`
- **Mong đợi:** 201 `sourceFormat=pdf`, `rawText` chứa text của file
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-012 — upload DOCX trả 201 sourceFormat docx với text trích từ file

- **Requirement:** REQ-DOCUMENTS-05
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** upload `data/files/sample.docx`
- **Mong đợi:** 201 `sourceFormat=docx`, `rawText` chứa text của file
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-013 — file không phải PDF hay DOCX trả 400 unsupportedFileType

- **Requirement:** REQ-DOCUMENTS-04, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** upload `.txt` (`text/plain`) và `.png`, en + vi
- **Mong đợi:** 400 `documents.errors.unsupportedFileType` đúng ngôn ngữ
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-014 — file lớn hơn 10 MB trả 400 fileTooLarge

- **Requirement:** REQ-DOCUMENTS-04, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** upload 10 MiB + 1 byte, mime PDF, en + vi (trên biên)
- **Mong đợi:** 400 `documents.errors.fileTooLarge`
- **Kiểm chứng thêm:** biên đúng 10 MiB không test — decisions Q10
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-015 — file vừa sai loại vừa quá cỡ nhận thông báo sai loại

- **Requirement:** REQ-DOCUMENTS-04
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** upload `.txt` 10 MiB + 1 byte
- **Mong đợi:** 400 với message sai loại, không phải quá cỡ
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-016 — file gốc được lưu bất kể save, dán text không lưu file, DTO không lộ file

- **Requirement:** REQ-DOCUMENTS-05
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** upload PDF và DOCX với `save` false/true; dán text
- **Mong đợi:** row DB: file có `fileData` khác null + `fileMime` đúng; text: cả hai null
- **Kiểm chứng thêm:** response POST, `GET :id`, `GET /documents` không có `fileData`/`fileMime`
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-017 — khách chưa có session gửi tài liệu thì nhận 201 và cookie session của user khách mới

- **Requirement:** REQ-DOCUMENTS-06
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** `POST /documents` ẩn danh → `GET :id` bằng cookie nhận được
- **Mong đợi:** 201 + `Set-Cookie: mcv_session`; chủ tài liệu là user khách; cookie đó đọc lại được tài liệu
- **Automated:** `tests/api/documents/create.api.ts`

### TC-DOCUMENTS-018 — tài liệu của khách được chuyển sang user thật và thành đã lưu khi khách đăng nhập

- **Requirement:** REQ-DOCUMENTS-06
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** khách có tài liệu, đăng nhập qua Ducker ID
- **Bước:** đăng nhập xong mở `/cv`
- **Mong đợi:** tài liệu của khách thuộc user thật, `isSaved=true`, hiện trong thư viện
- **Automated:** manual — claim cần callback OIDC; chỉ fake IdP của module auth chạy được (D5, decisions Q12), module auth / guest-mode phủ

## Danh sách — `GET /documents`

### TC-DOCUMENTS-019 — danh sách JD đã lưu chỉ gồm tài liệu của mình, mới nhất trước, không có rawText

- **Requirement:** REQ-DOCUMENTS-07
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 3 JD đã lưu, 1 JD chưa lưu, 1 CV; user khác có 1 CV
- **Bước:** `GET /documents?kind=JD&saved=true`
- **Mong đợi:** đúng 3 JD theo `createdAt` giảm dần; không có JD chưa lưu, CV, tài liệu người khác; mỗi phần tử đúng khoá `{id, kind, title, sourceFormat, parentId, createdAt}`
- **Automated:** `tests/api/documents/list.api.ts`

### TC-DOCUMENTS-020 — saved=false chỉ trả tài liệu chưa lưu

- **Requirement:** REQ-DOCUMENTS-07
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có 1 JD đã lưu, 1 JD chưa lưu
- **Bước:** `GET /documents?kind=JD&saved=false`
- **Mong đợi:** chỉ JD chưa lưu
- **Automated:** `tests/api/documents/list.api.ts`

### TC-DOCUMENTS-021 — không lọc thì trả cả CV lẫn JD của mình và không có tài liệu của người khác

- **Requirement:** REQ-DOCUMENTS-07
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user có CV đã lưu, JD chưa lưu; user khác có CV
- **Bước:** `GET /documents` không query
- **Mong đợi:** cả hai tài liệu của mình, mới nhất trước; không có tài liệu người khác
- **Automated:** `tests/api/documents/list.api.ts`

### TC-DOCUMENTS-022 — kind không phải CV hoặc JD trả 400

- **Requirement:** REQ-DOCUMENTS-08
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `kind` = `cv`, `XX`, `CVJD`, rỗng
- **Mong đợi:** 400 (chỉ assert status — Q7)
- **Automated:** `tests/api/documents/list.api.ts`

### TC-DOCUMENTS-023 — không có session trả 401 SIGN_IN_REQUIRED theo ngôn ngữ

- **Requirement:** REQ-DOCUMENTS-09, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** `GET /documents`, en + vi
- **Mong đợi:** 401 `{code: SIGN_IN_REQUIRED, message: auth.errors.signInRequired}` đúng ngôn ngữ
- **Automated:** `tests/api/documents/list.api.ts`

### TC-DOCUMENTS-024 — session khách trả 401 SIGN_IN_REQUIRED

- **Requirement:** REQ-DOCUMENTS-09
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** session khách
- **Bước:** `GET /documents`
- **Mong đợi:** 401 `SIGN_IN_REQUIRED`
- **Automated:** `tests/api/documents/list.api.ts`

## Chi tiết + file gốc

### TC-DOCUMENTS-025 — chủ sở hữu đọc được DocumentDto kèm rawText

- **Requirement:** REQ-DOCUMENTS-10
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 1 JD dán text
- **Bước:** `GET /documents/:id`
- **Mong đợi:** 200 DocumentDto đủ trường, `rawText` đúng
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-026 — tài liệu của người khác và id không tồn tại cùng trả 404 notFound như nhau

- **Requirement:** REQ-DOCUMENTS-11, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user khác có 1 CV
- **Bước:** `GET :id` tài liệu người khác và UUID không tồn tại, en + vi
- **Mong đợi:** cả hai 404 `documents.errors.notFound`, body giống hệt nhau
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-027 — id không phải UUID trả 400

- **Requirement:** REQ-DOCUMENTS-11
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `GET /documents/abc`, `/123`, UUID + ký tự thừa
- **Mong đợi:** 400
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-028 — khách đọc được tài liệu của mình nhưng không đọc được của người khác

- **Requirement:** REQ-DOCUMENTS-10
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** session khách; user khác có CV PDF
- **Bước:** khách tạo tài liệu rồi đọc; đọc tài liệu + file của người khác
- **Mong đợi:** tài liệu của mình 200; của người khác 404 (cả `:id` và `:id/file`)
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-029 — file PDF trả đúng byte gốc, application/pdf, inline và tên file theo title

- **Requirement:** REQ-DOCUMENTS-12, REQ-DOCUMENTS-14
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có CV upload PDF title `CV_one`
- **Bước:** `GET /documents/:id/file`
- **Mong đợi:** 200, byte = file gốc, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="CV_one.pdf"`, `X-Content-Type-Options: nosniff`
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-030 — download=1 trả Content-Disposition attachment

- **Requirement:** REQ-DOCUMENTS-12
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có CV PDF title `CV_two`
- **Bước:** `GET :id/file?download=1`
- **Mong đợi:** `Content-Disposition: attachment; filename="CV_two.pdf"`
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-031 — file DOCX trả MIME DOCX và đuôi docx

- **Requirement:** REQ-DOCUMENTS-12
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có JD DOCX title `JD_docx`
- **Bước:** `GET :id/file?download=1`
- **Mong đợi:** MIME DOCX, tên file `JD_docx.docx`, byte = file gốc
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-032 — tài liệu dán text, của người khác hoặc không tồn tại trả 404 noOriginalFile

- **Requirement:** REQ-DOCUMENTS-13, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có JD dán text; user khác có CV PDF
- **Bước:** `GET :id/file` cho tài liệu text, của người khác, UUID không tồn tại; en + vi
- **Mong đợi:** 404 `documents.errors.noOriginalFile` đúng ngôn ngữ
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-033 — title có ngoặc kép, xuống dòng, chấm phẩy được sanitize trong tên file

- **Requirement:** REQ-DOCUMENTS-14
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user upload PDF có title chứa ngoặc kép, CRLF, chấm phẩy và `Set-Cookie:`
- **Bước:** `GET :id/file`
- **Mong đợi:** header một dòng `inline; filename="evil_x_1_Set-Cookie_a.pdf"`, response không có `Set-Cookie`
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-034 — title dài hơn 100 ký tự bị cắt còn 100 ký tự trong tên file

- **Requirement:** REQ-DOCUMENTS-14
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user upload PDF title 150 ký tự
- **Bước:** `GET :id/file`
- **Mong đợi:** tên file = 100 ký tự + `.pdf`
- **Automated:** `tests/api/documents/read.api.ts`

### TC-DOCUMENTS-035 — title tiếng Việt có dấu được giữ nguyên qua filename* UTF-8

- **Requirement:** REQ-DOCUMENTS-38, REQ-DOCUMENTS-14
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user upload PDF title `Sơ yếu Lý lịch`
- **Bước:** `GET :id/file?download=1`
- **Mong đợi:** `filename` ASCII an toàn và `filename*=UTF-8''…` giải mã ra `Sơ yếu Lý lịch.pdf`
- **Automated:** `tests/api/documents/read.api.ts`

## Đổi tên — `PATCH /documents/:id`

### TC-DOCUMENTS-036 — đổi tên trả 200 và đọc lại thấy title mới

- **Requirement:** REQ-DOCUMENTS-15
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có JD đã lưu
- **Bước:** `PATCH /documents/:id {title}` rồi `GET :id`
- **Mong đợi:** 200, title mới, `rawText` giữ nguyên; đọc lại thấy title mới
- **Automated:** `tests/api/documents/rename.api.ts`

### TC-DOCUMENTS-037 — title mới được trim

- **Requirement:** REQ-DOCUMENTS-15
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user có CV
- **Bước:** `PATCH` title có khoảng trắng hai đầu
- **Mong đợi:** title đã trim
- **Automated:** `tests/api/documents/rename.api.ts`

### TC-DOCUMENTS-038 — title 199 và 200 ký tự được nhận, 201 ký tự bị từ chối

- **Requirement:** REQ-DOCUMENTS-15
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user có CV
- **Bước:** `PATCH` title 199, 200, 201 ký tự (BVA)
- **Mong đợi:** 199, 200 → 200; 201 → 400 và title giữ giá trị trước
- **Automated:** `tests/api/documents/rename.api.ts`

### TC-DOCUMENTS-039 — title rỗng, chỉ khoảng trắng, thiếu hoặc không phải chuỗi trả 400

- **Requirement:** REQ-DOCUMENTS-15
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có JD
- **Bước:** `PATCH` với title rỗng, chỉ khoảng trắng, thiếu, số, null, mảng
- **Mong đợi:** 400 (chỉ status — Q7); title không đổi
- **Automated:** `tests/api/documents/rename.api.ts`

### TC-DOCUMENTS-040 — đặt lại đúng tên cũ vẫn trả 200

- **Requirement:** REQ-DOCUMENTS-15
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user có CV
- **Bước:** `PATCH` đúng title hiện tại
- **Mong đợi:** 200
- **Automated:** `tests/api/documents/rename.api.ts`

### TC-DOCUMENTS-041 — đổi tên tài liệu của người khác trả 404 và title của họ không đổi

- **Requirement:** REQ-DOCUMENTS-16, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user khác có CV
- **Bước:** `PATCH` tài liệu người khác, en + vi
- **Mong đợi:** 404 `documents.errors.notFound`; title của họ không đổi
- **Automated:** `tests/api/documents/rename.api.ts`

### TC-DOCUMENTS-042 — khách hoặc không có session đổi tên trả 401

- **Requirement:** REQ-DOCUMENTS-16
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có CV
- **Bước:** `PATCH` không cookie và bằng session khách
- **Mong đợi:** 401 `SIGN_IN_REQUIRED`; title không đổi
- **Automated:** `tests/api/documents/rename.api.ts`

## Xoá — `DELETE /documents/:id`

### TC-DOCUMENTS-043 — xoá tài liệu không bị tham chiếu trả 204 và sau đó đọc lại là 404

- **Requirement:** REQ-DOCUMENTS-17
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có JD không bị tham chiếu
- **Bước:** `DELETE /documents/:id` rồi `GET :id`
- **Mong đợi:** 204; row biến mất; `GET` 404
- **Automated:** `tests/api/documents/delete.api.ts`

### TC-DOCUMENTS-044 — tài liệu được kết quả match dùng làm CV trả 409 inUseByMatch và giữ nguyên

- **Requirement:** REQ-DOCUMENTS-18, REQ-DOCUMENTS-32
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** CV + JD được một MatchResult tham chiếu
- **Bước:** `DELETE` CV, en + vi
- **Mong đợi:** 409 `documents.errors.inUseByMatch`; CV và MatchResult còn
- **Automated:** `tests/api/documents/delete.api.ts`

### TC-DOCUMENTS-045 — tài liệu được kết quả match dùng làm JD trả 409 và giữ nguyên

- **Requirement:** REQ-DOCUMENTS-18
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** CV + JD được một MatchResult tham chiếu
- **Bước:** `DELETE` JD
- **Mong đợi:** 409; JD và MatchResult còn
- **Automated:** `tests/api/documents/delete.api.ts`

### TC-DOCUMENTS-046 — xoá tài liệu của người khác, đã xoá hoặc không tồn tại trả 404

- **Requirement:** REQ-DOCUMENTS-19
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user khác có CV; user có tài liệu vừa xoá
- **Bước:** `DELETE` tài liệu người khác, đã xoá, UUID không tồn tại
- **Mong đợi:** 404 `notFound`; tài liệu người khác còn
- **Automated:** `tests/api/documents/delete.api.ts`

### TC-DOCUMENTS-047 — khách hoặc không có session xoá trả 401

- **Requirement:** REQ-DOCUMENTS-19
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có JD
- **Bước:** `DELETE` không cookie và bằng session khách
- **Mong đợi:** 401; tài liệu còn
- **Automated:** `tests/api/documents/delete.api.ts`

### TC-DOCUMENTS-048 — xoá bản trước thì bản sau còn nguyên và mất liên kết parentId

- **Requirement:** REQ-DOCUMENTS-20
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** CV con có `parentId` = CV cha
- **Bước:** `DELETE` CV cha
- **Mong đợi:** 204; CV con còn, `parentId=null`
- **Automated:** `tests/api/documents/delete.api.ts`

### TC-DOCUMENTS-049 — tài liệu chỉ được một lượt match chưa có kết quả tham chiếu không làm server lỗi 5xx

- **Requirement:** REQ-DOCUMENTS-34
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** CV + JD được một MatchRun chưa có kết quả tham chiếu
- **Bước:** `DELETE` CV
- **Mong đợi:** 204 (xoá kèm run rỗng) hoặc 409 `inUseByMatch` (tài liệu còn) — không 5xx
- **Automated:** `tests/api/documents/delete.api.ts`

## UI — cổng đăng nhập

### TC-DOCUMENTS-050 — người chưa đăng nhập mở /cv thấy cổng đăng nhập và không gọi API danh sách

- **Requirement:** REQ-DOCUMENTS-21
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** tab không cookie
- **Bước:** mở `/cv` → bấm `gate.backMatching`
- **Mong đợi:** thấy `gate.cv`, `gate.description`, link `auth.signInWithDucker` = `<API>/auth/login?returnTo=%2Fcv`; không có h1 thư viện; không request `GET /documents?kind=CV&saved=true`; link quay lại dẫn tới `/wizard`
- **Automated:** `tests/e2e/documents/gate.e2e.ts`

### TC-DOCUMENTS-051 — khách mở /jd thấy cổng đăng nhập của JD

- **Requirement:** REQ-DOCUMENTS-21
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** tab với session khách
- **Bước:** mở `/jd`
- **Mong đợi:** thấy `gate.jd`, link đăng nhập `returnTo=%2Fjd`, link quay lại `/wizard`; không request danh sách
- **Automated:** `tests/e2e/documents/gate.e2e.ts`

## UI — danh sách thư viện

### TC-DOCUMENTS-052 — /cv liệt kê CV đã lưu của mình, mới nhất trước, với số đếm đúng

- **Requirement:** REQ-DOCUMENTS-22, REQ-DOCUMENTS-23
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có CV dán text (cũ), CV PDF (mới), CV chưa lưu, JD; user khác có CV
- **Bước:** mở `/cv`
- **Mong đợi:** h1 `library.title.cv`, phụ đề `library.subtitle` count=2, đúng 2 dòng: PDF trước, text sau; không có CV chưa lưu, JD, CV người khác
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-053 — /jd chỉ liệt kê JD đã lưu với tiêu đề và số đếm của JD

- **Requirement:** REQ-DOCUMENTS-22, REQ-DOCUMENTS-23
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 JD, 1 CV đã lưu
- **Bước:** mở `/jd`
- **Mong đợi:** h1 `library.title.jd`, count=1, chỉ dòng JD
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-054 — mỗi dòng có badge định dạng dễ đọc và ngày tạo theo locale

- **Requirement:** REQ-DOCUMENTS-23
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có CV PDF, DOCX, text
- **Bước:** mở `/cv`
- **Mong đợi:** badge `format.pdf` / `format.docx` / `format.text`, không có enum thô; ngày = `Intl.DateTimeFormat(en)` của `createdAt`
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-055 — title 200 ký tự được cắt dòng và không làm trang cuộn ngang

- **Requirement:** REQ-DOCUMENTS-23
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có CV title 200 ký tự
- **Bước:** mở `/cv` (cả 3 viewport)
- **Mong đợi:** dòng hiện, trang không cuộn ngang
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-056 — menu hành động có đúng các mục theo loại tài liệu và trang

- **Requirement:** REQ-DOCUMENTS-24
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** CV PDF có parent, CV text không parent; JD DOCX có parent
- **Bước:** mở menu từng dòng ở `/cv` rồi `/jd`
- **Mong đợi:** CV PDF có parent: Preview, Rename, Compare versions, Mark as a new version of…, Download, Delete; CV text: không Download, không Compare; JD có parent: không Compare
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-057 — thư viện rỗng hiện trạng thái rỗng và nút bắt đầu match dẫn tới /wizard

- **Requirement:** REQ-DOCUMENTS-25
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user chỉ có CV chưa lưu
- **Bước:** mở `/cv` → bấm `library.emptyCta`
- **Mong đợi:** `library.empty.cv`, `library.emptyHint`, phụ đề count=0; nút dẫn tới `/wizard`
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-058 — trong lúc tải chưa hiện số đếm hay trạng thái rỗng

- **Requirement:** REQ-DOCUMENTS-25
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `GET` danh sách JD bị giữ 3 s (stub trả `[]`)
- **Bước:** mở `/jd`
- **Mong đợi:** h1 hiện ngay; trong lúc chờ không có phụ đề đếm, không có trạng thái rỗng; sau đó hiện trạng thái rỗng + count=0
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-059 — tải danh sách lỗi thì hiện thông báo lỗi

- **Requirement:** REQ-DOCUMENTS-25
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** `GET` danh sách CV luôn 500 (stub)
- **Bước:** mở `/cv`
- **Mong đợi:** `role=alert` `library.loadError` (sau các lần retry của react-query); không phụ đề, không trạng thái rỗng
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-060 — trạng thái lỗi có nút thử lại tải lại danh sách

- **Requirement:** REQ-DOCUMENTS-37
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `GET` danh sách CV 500 trong 4 lần đầu, sau đó backend thật; user có 1 CV
- **Bước:** mở `/cv` → bấm nút thử lại
- **Mong đợi:** có nút thử lại; bấm thì dòng CV hiện và thông báo lỗi biến mất
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-061 — giao diện tiếng Việt hiện đủ chuỗi tiếng Việt và không lộ raw key

- **Requirement:** REQ-DOCUMENTS-32
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 CV dán text
- **Bước:** mở `/cv`, đổi sang vi qua `window.__i18n`, mở menu, mở đổi tên
- **Mong đợi:** h1, phụ đề, badge `Văn bản`, ngày theo locale vi, nhãn menu, modal đổi tên đều tiếng Việt; không chuỗi dạng `library.xxx`
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

### TC-DOCUMENTS-062 — menu, modal đổi tên dùng được bằng bàn phím và giữ focus trong modal

- **Requirement:** REQ-DOCUMENTS-33
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 JD
- **Bước:** focus nút Actions → Enter → Esc; mở đổi tên → Tab ×6 → Esc
- **Mong đợi:** Enter mở menu, Esc đóng; focus luôn trong modal khi Tab; Esc đóng modal
- **Automated:** `tests/e2e/documents/library-list.e2e.ts`

## UI — xem trước

### TC-DOCUMENTS-063 — xem trước tài liệu dán text hiện chữ thuần không render HTML và chỉ có nút đóng

- **Requirement:** REQ-DOCUMENTS-26, REQ-DOCUMENTS-28
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có CV dán text chứa thẻ `b` và `img onerror`
- **Bước:** mở xem trước
- **Mong đợi:** modal tiêu đề = title; `<pre>` hiện đúng chuỗi gốc; không sinh phần tử `b`/`img`, không chạy `onerror`; footer chỉ có Close
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-064 — xem trước PDF vẽ trang trên canvas và có nút tải xuống, đóng

- **Requirement:** REQ-DOCUMENTS-26, REQ-DOCUMENTS-28
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có CV PDF
- **Bước:** mở xem trước
- **Mong đợi:** modal tiêu đề = title; canvas trang 1 hiện; footer có Download (`…/file?download=1`) và Close
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-065 — xem trước DOCX dựng nội dung file trong trang

- **Requirement:** REQ-DOCUMENTS-26
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có CV DOCX
- **Bước:** mở xem trước
- **Mong đợi:** `docx-preview` chứa text của file; footer có Download
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-066 — xem trước PDF nhiều trang hiện đủ mọi trang

- **Requirement:** REQ-DOCUMENTS-35
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** CV PDF 3 trang (row seed thẳng DB, file sinh bởi `multiPagePdf(3)`)
- **Bước:** mở xem trước
- **Mong đợi:** 3 canvas
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-067 — tải file gốc lỗi thì hiện đang tải rồi thông báo lỗi và trang vẫn dùng được

- **Requirement:** REQ-DOCUMENTS-26
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** CV PDF; `GET …/file` trả 500 sau 1,5 s (stub)
- **Bước:** mở xem trước → Close
- **Mong đợi:** `preview.loading` rồi `role=alert` `preview.error`; đóng được, dòng vẫn còn, không lỗi trang
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-068 — tài liệu vừa bị xoá ở nơi khác thì modal xem trước báo lỗi thay vì quay mãi

- **Requirement:** REQ-DOCUMENTS-36
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** JD đã lưu; trang đã tải xong rồi JD bị xoá qua API
- **Bước:** mở xem trước JD đó
- **Mong đợi:** `preview.error` thay vì spinner vô hạn
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-069 — xem trước PDF và DOCX không gửi request nào ra host ngoài

- **Requirement:** REQ-DOCUMENTS-27
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có CV PDF và CV DOCX
- **Bước:** xem trước PDF, đóng, xem trước DOCX
- **Mong đợi:** không request nào tới host ngoài localhost; có `GET /documents/:id/file` cho cả hai
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-070 — Esc và nút đóng đều đóng modal xem trước và gỡ nội dung khỏi trang

- **Requirement:** REQ-DOCUMENTS-28, REQ-DOCUMENTS-33
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có JD PDF
- **Bước:** xem trước → Esc; xem trước → Close
- **Mong đợi:** modal đóng; `pdf-preview` không còn trong DOM sau mỗi lần
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

### TC-DOCUMENTS-071 — đổi ngôn ngữ khi đang xem PDF không gây lỗi trang

- **Requirement:** REQ-DOCUMENTS-28
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có CV PDF đang mở xem trước
- **Bước:** đổi ngôn ngữ sang vi
- **Mong đợi:** footer `Đóng`; canvas vẫn hiện, không `preview.error`, không `pageerror`
- **Automated:** `tests/e2e/documents/preview.e2e.ts`

## UI — đổi tên

### TC-DOCUMENTS-072 — đổi tên qua modal thì báo thành công, đóng modal và dòng hiện tên mới

- **Requirement:** REQ-DOCUMENTS-29
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 1 CV
- **Bước:** menu → Rename → nhập tên mới → Save
- **Mong đợi:** input điền sẵn title cũ (tìm theo label); PATCH 200; toast `library.rename.success`; modal đóng; dòng hiện tên mới
- **Kiểm chứng thêm:** `GET :id` trả tên mới
- **Automated:** `tests/e2e/documents/rename.e2e.ts`

### TC-DOCUMENTS-073 — nút lưu bị khoá khi tên chỉ có khoảng trắng và ô nhập giới hạn 200 ký tự

- **Requirement:** REQ-DOCUMENTS-29
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 JD
- **Bước:** mở đổi tên, nhập chỉ khoảng trắng, rỗng, rồi ` x `
- **Mong đợi:** `maxlength=200`; Save khoá với rỗng/khoảng trắng, mở với ` x `
- **Automated:** `tests/e2e/documents/rename.e2e.ts`

### TC-DOCUMENTS-074 — nhấn Enter trong ô tên thì lưu tên mới

- **Requirement:** REQ-DOCUMENTS-29
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 CV
- **Bước:** mở đổi tên, nhập tên có khoảng trắng hai đầu, Enter
- **Mong đợi:** PATCH 200; dòng hiện tên đã trim
- **Automated:** `tests/e2e/documents/rename.e2e.ts`

### TC-DOCUMENTS-075 — server lỗi khi đổi tên thì báo lỗi và modal vẫn mở

- **Requirement:** REQ-DOCUMENTS-29
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 CV; `PATCH` tài liệu đó trả 500 (stub)
- **Bước:** đổi tên → Save
- **Mong đợi:** toast `library.rename.failed`; modal vẫn mở; dòng giữ tên cũ
- **Automated:** `tests/e2e/documents/rename.e2e.ts`

## UI — xoá

### TC-DOCUMENTS-076 — xác nhận xoá thì báo thành công, dòng biến mất và số đếm giảm

- **Requirement:** REQ-DOCUMENTS-31
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 2 CV
- **Bước:** menu → Delete → xác nhận
- **Mong đợi:** DELETE 204; toast `library.delete.success`; dòng biến mất; phụ đề 2 → 1
- **Automated:** `tests/e2e/documents/delete.e2e.ts`

### TC-DOCUMENTS-077 — huỷ xác nhận thì không gửi request xoá và dòng còn nguyên

- **Requirement:** REQ-DOCUMENTS-31
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 JD
- **Bước:** menu → Delete → Cancel
- **Mong đợi:** Popconfirm đóng; không request DELETE; dòng còn; `GET :id` 200
- **Automated:** `tests/e2e/documents/delete.e2e.ts`

### TC-DOCUMENTS-078 — tài liệu đang dùng trong lịch sử match thì báo không xoá được và dòng còn nguyên

- **Requirement:** REQ-DOCUMENTS-31
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** CV + JD được MatchResult tham chiếu
- **Bước:** menu CV → Delete → xác nhận
- **Mong đợi:** DELETE 409; toast `library.delete.inUse`; dòng còn; count giữ 1
- **Automated:** `tests/e2e/documents/delete.e2e.ts`

### TC-DOCUMENTS-079 — lỗi khác khi xoá thì báo xoá thất bại và mục xoá bị khoá trong lúc đang xoá

- **Requirement:** REQ-DOCUMENTS-31
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 CV; DELETE trả 500 sau 3 s (stub)
- **Bước:** xác nhận xoá → mở lại menu khi đang chờ
- **Mong đợi:** mục Delete bị khoá trong lúc chờ; rồi toast `library.delete.failed`, dòng còn
- **Automated:** `tests/e2e/documents/delete.e2e.ts`

## UI — tải xuống

### TC-DOCUMENTS-080 — tải từ menu hành động nhận đúng file PDF gốc

- **Requirement:** REQ-DOCUMENTS-30
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có CV PDF title ASCII
- **Bước:** menu → Download
- **Mong đợi:** trình duyệt nhận file `<title>.pdf`, byte = file gốc
- **Automated:** `tests/e2e/documents/download.e2e.ts`

### TC-DOCUMENTS-081 — tải từ footer xem trước nhận đúng file DOCX gốc

- **Requirement:** REQ-DOCUMENTS-30, REQ-DOCUMENTS-28
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có JD DOCX title ASCII
- **Bước:** xem trước → footer Download
- **Mong đợi:** trình duyệt nhận file `<title>.docx`, byte = file gốc
- **Automated:** `tests/e2e/documents/download.e2e.ts`
