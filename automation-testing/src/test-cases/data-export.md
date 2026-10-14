# DATAEXPORT — test case

Requirement: `docs/requirements/data-export.md` · quyết định: `docs/decisions/data-export.md`.
Thứ tự theo 6 lăng kính: truy vết → phân vùng → biên → trạng thái → negative → bảo mật. API trước (tổ hợp, biên, bảo mật),
UI sau (luồng người dùng, message, trạng thái nút).

## API — quyền truy cập

### TC-DATAEXPORT-001 — anonymous gọi export nhận 401 SIGN_IN_REQUIRED theo ngôn ngữ request

- **Requirement:** REQ-DATAEXPORT-01
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** `GET /me/export` với `Accept-Language` en, rồi vi
- **Mong đợi:** `401`, `code: "SIGN_IN_REQUIRED"`, message = `auth.errors.signInRequired` đúng ngôn ngữ; body không phải zip
- **Automated:** `tests/api/data-export/access.api.ts`

### TC-DATAEXPORT-002 — khách (guest session) gọi export nhận 401 SIGN_IN_REQUIRED

- **Requirement:** REQ-DATAEXPORT-01
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** khách có session hợp lệ và một tài liệu
- **Bước:** `GET /me/export` bằng cookie của khách
- **Mong đợi:** `401`, `code: "SIGN_IN_REQUIRED"`
- **Automated:** `tests/api/data-export/access.api.ts`

### TC-DATAEXPORT-003 — cookie phiên không hợp lệ hoặc của user đã xóa nhận 401

- **Requirement:** REQ-DATAEXPORT-01
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** một token ngẫu nhiên; một user đăng nhập rồi bị xóa
- **Bước:** `GET /me/export` với từng cookie
- **Mong đợi:** cả hai `401`, `code: "SIGN_IN_REQUIRED"` (không 404, không 500)
- **Automated:** `tests/api/data-export/access.api.ts`

## API — hợp đồng archive

### TC-DATAEXPORT-004 — export trả zip kèm header attachment, tên theo ngày UTC và no-store

- **Requirement:** REQ-DATAEXPORT-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** `GET /me/export`
- **Mong đợi:** `200`; `Content-Type` `application/zip`; `Content-Disposition` = `attachment; filename="export-<ngày UTC hôm nay>.zip"`, tên chỉ `[a-z0-9-.]`; `Cache-Control` có `no-store`; body mở được bằng zip
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-005 — zip có data.json và đúng một entry cho mỗi tài liệu có file

- **Requirement:** REQ-DATAEXPORT-06, REQ-DATAEXPORT-08
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** user upload một PDF, một DOCX (qua `POST /documents/upload`) và paste một JD text
- **Bước:** `GET /me/export`, giải nén
- **Mong đợi:** entry = `data.json` + đúng 2 entry dưới `documents/`; tài liệu paste có `file: null`; mỗi `file` khác null trỏ đúng một entry có thật
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-006 — data.json có đủ khoá gốc và user là chính người gọi

- **Requirement:** REQ-DATAEXPORT-07
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** export, đọc `data.json`
- **Mong đợi:** có `schemaVersion` (nguyên dương), `exportedAt` (ISO UTC, trong khoảng gọi request), `user.id` = id người gọi, `user.role` = `candidate`, `user.createdAt` ISO, `documents` / `matchResults` / `aiCredentials` là mảng
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-007 — mỗi tài liệu trong data.json có đủ field và giá trị đúng

- **Requirement:** REQ-DATAEXPORT-08
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** seed một CV có file PDF (đã lưu) và một JD paste-text (chưa lưu)
- **Mong đợi:** mỗi phần tử có `id, kind, title, sourceFormat, isSaved, createdAt, rawText, file` với giá trị khớp dữ liệu seed
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-008 — kết quả match trong data.json có đủ field, credentialId chỉ là id tham chiếu

- **Requirement:** REQ-DATAEXPORT-09
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** seed CV + JD, một credential, một match chạy bằng credential đó và một match không credential
- **Mong đợi:** mỗi phần tử có `id, cvDocumentId, jdDocumentId, overallScore, semanticScore, keywordScore, report, createdAt, credentialId, provider, chatModel, embedModel`; `credentialId` là chuỗi id (hoặc `null`), không phải object
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-009 — credential trong data.json chỉ có đúng tập field cho phép

- **Requirement:** REQ-DATAEXPORT-10
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** seed một credential
- **Mong đợi:** khoá của phần tử = đúng `id, provider, label, keyLast4, chatModel, embedModel, lastTestStatus, lastTestedAt, lastUsedAt, createdAt` (không thừa, không thiếu); `keyLast4` khớp
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-010 — file trong zip giống hệt từng byte bản đã upload

- **Requirement:** REQ-DATAEXPORT-11
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** upload `sample.pdf` và `sample.docx` qua `POST /documents/upload`
- **Mong đợi:** sha256 của entry = sha256 file gốc, cho cả hai
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

### TC-DATAEXPORT-011 — các mảng trong data.json sắp theo createdAt tăng dần

- **Requirement:** REQ-DATAEXPORT-12
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed 3 tài liệu, 2 match, 2 credential với `createdAt` chèn theo thứ tự KHÁC thứ tự thời gian
- **Mong đợi:** id trong mỗi mảng theo thứ tự `createdAt` tăng dần
- **Automated:** `tests/api/data-export/archive-contract.api.ts`

## API — rò rỉ và cô lập

### TC-DATAEXPORT-012 — không byte nào trong zip lộ ciphertext, IV, tag của nhiều credential

- **Requirement:** REQ-DATAEXPORT-13
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** seed 2 credential với `encryptedKey` / `keyIv` / `keyTag` mang marker riêng
- **Mong đợi:** cả bytes thô lẫn nội dung giải nén của mọi entry không chứa marker nào, không chứa tên field `encryptedKey` / `keyIv` / `keyTag`; mỗi credential chỉ lộ `keyLast4`
- **Automated:** `tests/api/data-export/leak-isolation.api.ts`

### TC-DATAEXPORT-013 — zip không chứa dữ liệu của user khác hay của khách

- **Requirement:** REQ-DATAEXPORT-14
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** user B (đăng nhập) và một khách mỗi người có tài liệu có file, match, credential mang marker; user A có một tài liệu
- **Mong đợi:** export của A chỉ có tài liệu của A; không marker, không id nào của B / khách xuất hiện trong bytes giải nén
- **Automated:** `tests/api/data-export/leak-isolation.api.ts`

## API — tên entry

### TC-DATAEXPORT-014 — tên entry là slug tiêu đề cộng 6 hex id, đuôi suy từ mime

- **Requirement:** REQ-DATAEXPORT-15
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** seed `CV Nguyễn Văn A` (pdf), `Đơn ứng tuyển` (docx), `payload.exe` (mime lạ)
- **Mong đợi:** `documents/cv-nguyen-van-a-<id6>.pdf`, `documents/don-ung-tuyen-<id6>.docx`, `documents/payload-exe-<id6>.bin`
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

### TC-DATAEXPORT-015 — tiêu đề kiểu zip-slip không đưa entry ra ngoài documents/

- **Requirement:** REQ-DATAEXPORT-16
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke @creates-data
- **Tiền điều kiện:** seed tài liệu có file với tiêu đề `../../etc/passwd`, `/abs/path`, `..\\..\\win.ini`, `a\tb\nc`
- **Mong đợi:** mọi entry khác `data.json` có dạng `documents/<tên>` với tên không chứa `/`, `\`, `..`, ký tự điều khiển
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

### TC-DATAEXPORT-016 — tiêu đề rỗng, toàn dấu câu hoặc emoji thành tên document kèm hậu tố id

- **Requirement:** REQ-DATAEXPORT-17
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed 3 tài liệu: tiêu đề `""`, `!!!...???`, `🎉🎉`
- **Mong đợi:** entry `documents/document-<id6>.pdf` cho từng cái, ba tên khác nhau
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

### TC-DATAEXPORT-017 — hai tiêu đề cùng slug cho hai entry riêng, không ghi đè

- **Requirement:** REQ-DATAEXPORT-17
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** seed `Resume` và `resume!!` (cùng slug `resume`) với nội dung file khác nhau
- **Mong đợi:** hai entry khác tên, mỗi entry đúng bytes của tài liệu của nó
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

### TC-DATAEXPORT-018 — tên dành riêng Windows không thành tên entry trần

- **Requirement:** REQ-DATAEXPORT-17
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed tiêu đề `CON`, `NUL`, `COM1`
- **Mong đợi:** phần tên (bỏ đuôi) của từng entry không phải tên dành riêng của Windows (`con-<id6>`…)
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

### TC-DATAEXPORT-019 — tiêu đề 500 ký tự cho tên entry không quá 255 ký tự

- **Requirement:** REQ-DATAEXPORT-18
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed tiêu đề 500 ký tự (chữ có dấu + khoảng trắng)
- **Mong đợi:** mỗi thành phần đường dẫn entry ≤ 255 ký tự; phần slug ≤ 60 ký tự
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

### TC-DATAEXPORT-020 — tên entry thuần ASCII hoặc có cờ UTF-8

- **Requirement:** REQ-DATAEXPORT-19
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed tiêu đề tiếng Việt có dấu
- **Mong đợi:** với mọi entry: tên thuần ASCII hoặc bit 11 (UTF-8) của general-purpose flag bật
- **Automated:** `tests/api/data-export/entry-naming.api.ts`

## API — rỗng, dữ liệu lệch, biên

### TC-DATAEXPORT-021 — user chưa có dữ liệu nhận zip hợp lệ chỉ gồm data.json

- **Requirement:** REQ-DATAEXPORT-20
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** export với user mới tinh
- **Mong đợi:** `200`; entry duy nhất `data.json`; `documents`, `matchResults`, `aiCredentials` là `[]`
- **Automated:** `tests/api/data-export/edge-data.api.ts`

### TC-DATAEXPORT-022 — tài liệu có mime nhưng không có file và rawText rỗng vẫn export được

- **Requirement:** REQ-DATAEXPORT-21
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed tài liệu `fileData = null`, `fileMime = application/pdf`; tài liệu `fileData` 0 byte; tài liệu `rawText = ""`
- **Mong đợi:** `200`; hai tài liệu đầu có `file: null` và không có entry; tài liệu thứ ba có `rawText: ""`
- **Automated:** `tests/api/data-export/edge-data.api.ts`

### TC-DATAEXPORT-023 — ký tự NUL trong rawText bị loại khỏi data.json

- **Requirement:** REQ-DATAEXPORT-21
- **Layer:** api · **Priority:** P2
- **Mong đợi:** `data.json` parse được, `rawText` không còn `\u0000`
- **Automated:** manual — cột `text` của PostgreSQL không lưu được `\u0000` nên không seed được qua DB/HTTP; thuộc unit test của `export-manifest.ts` (Q3)

### TC-DATAEXPORT-024 — một và 200 tài liệu có file cho đúng số entry

- **Requirement:** REQ-DATAEXPORT-22
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** user 1 có 1 tài liệu có file; user 2 có 200 tài liệu có file (seed hàng loạt)
- **Mong đợi:** lần lượt 1 và 200 entry dưới `documents/`, tên đôi một khác nhau; `documents.length` khớp
- **Automated:** `tests/api/data-export/edge-data.api.ts`

### TC-DATAEXPORT-025 — file 10 MB và file 1 byte được stream đủ

- **Requirement:** REQ-DATAEXPORT-22
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** seed file 10 MB (10 485 760 byte ngẫu nhiên) và file 1 byte
- **Mong đợi:** entry có đúng kích thước và sha256 của bản seed
- **Automated:** `tests/api/data-export/edge-data.api.ts`

## API — header, method, lỗi, throttle

### TC-DATAEXPORT-026 — header Range không bao giờ cho zip cụt

- **Requirement:** REQ-DATAEXPORT-23
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** `GET /me/export` với `Range: bytes=0-100`
- **Mong đợi:** `200` với zip đầy đủ mở được (có `data.json`), hoặc `416`; không bao giờ `206`
- **Automated:** `tests/api/data-export/http-edge.api.ts`

### TC-DATAEXPORT-027 — Accept application/json vẫn nhận zip hoặc 406, không 5xx

- **Requirement:** REQ-DATAEXPORT-23
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Mong đợi:** `200` + `application/zip`, hoặc `406`
- **Automated:** `tests/api/data-export/http-edge.api.ts`

### TC-DATAEXPORT-028 — sai method trên /me/export nhận 404 hoặc 405

- **Requirement:** REQ-DATAEXPORT-23
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Bước:** `POST`, `PATCH`, `DELETE /me/export` bằng user đăng nhập
- **Mong đợi:** mỗi cái `404` hoặc `405`, không zip
- **Automated:** `tests/api/data-export/http-edge.api.ts`

### TC-DATAEXPORT-029 — throttle toàn cục 100 request mỗi phút áp cho export

- **Requirement:** REQ-DATAEXPORT-25
- **Layer:** api · **Priority:** P2 · **Tags:** @creates-data
- **Bước:** gọi export hai lần liên tiếp
- **Mong đợi:** `X-RateLimit-Limit: 100`; `X-RateLimit-Remaining` lần sau nhỏ hơn lần trước
- **Automated:** `tests/api/data-export/http-edge.api.ts`

### TC-DATAEXPORT-030 — vượt 100 export trong một phút nhận 429

- **Requirement:** REQ-DATAEXPORT-25
- **Layer:** api · **Priority:** P2
- **Mong đợi:** request thứ 101 trong 60 giây nhận `429` kèm `Retry-After`
- **Automated:** manual — client HTTP của suite tự chờ `Retry-After` và đốt quota của route làm chậm test khác (Q5)

### TC-DATAEXPORT-031 — lỗi khi dựng zip trả 500 i18n hoặc cắt kết nối, không zip cụt

- **Requirement:** REQ-DATAEXPORT-24
- **Layer:** api · **Priority:** P1
- **Mong đợi:** lỗi trước header → `500` `{ message: me.errors.exportFailed }`, không stack trace; lỗi giữa stream → kết nối bị huỷ, không `200` + zip cụt
- **Automated:** manual — cần fault-injection phía server (lỗi DB giữa stream), black-box HTTP không gây ra được; thuộc unit test server (Q3)

## API — độ đầy đủ (FR-15)

### TC-DATAEXPORT-032 — export chứa cover letter và match run của user

- **Requirement:** REQ-DATAEXPORT-34
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** seed CV + JD, một match run, một match result, một cover letter
- **Mong đợi:** `data.json` có `coverLetters[]` chứa cover letter (id, content) và `matchRuns[]` chứa run (id)
- **Automated:** `tests/api/data-export/completeness.api.ts`

### TC-DATAEXPORT-033 — export chứa hồ sơ user, lineage tài liệu và schemaVersion 2

- **Requirement:** REQ-DATAEXPORT-34
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** user có email; CV gốc và CV con có `parentId` trỏ CV gốc
- **Mong đợi:** `user.email`, `user.fullName`, `user.avatar` có mặt (email khớp); phần tử CV con có `parentId` = id CV gốc; `schemaVersion` = 2
- **Automated:** `tests/api/data-export/completeness.api.ts`

## UI — truy cập

### TC-DATAEXPORT-034 — anonymous mở /my-data thấy màn mời đăng nhập, không gọi export

- **Requirement:** REQ-DATAEXPORT-02
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** trình duyệt không cookie
- **Bước:** mở `/my-data`
- **Mong đợi:** tiêu đề `gate.myData`, mô tả `gate.description`; nút `auth.signInWithDucker` có href `…/auth/login?returnTo=/my-data`; link `gate.backMatching` về `/wizard`; không có nút `myData.download`; không request `/me/export`
- **Automated:** `tests/e2e/data-export/access.e2e.ts`

### TC-DATAEXPORT-035 — khách mở /my-data thấy màn mời đăng nhập và quay về matching được

- **Requirement:** REQ-DATAEXPORT-02
- **Layer:** e2e · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** cookie session của khách
- **Bước:** mở `/my-data` → bấm `gate.backMatching`
- **Mong đợi:** màn gate như TC-034, không request `/me/export`; bấm link về `/wizard`
- **Automated:** `tests/e2e/data-export/access.e2e.ts`

### TC-DATAEXPORT-036 — khi /auth/me chưa trả lời trang hiện skeleton, không nháy màn đăng nhập

- **Requirement:** REQ-DATAEXPORT-03
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user e2e; `GET /auth/me` bị giữ lại
- **Bước:** mở `/my-data` → thả `/auth/me`
- **Mong đợi:** lúc giữ: có vùng `aria-busy="true"`, không thấy tiêu đề gate hay nút tải; thả ra: hiện tiêu đề `myData.title`
- **Automated:** `tests/e2e/data-export/access.e2e.ts`

### TC-DATAEXPORT-037 — user đăng nhập thấy mục My data trên sidebar và vào được trang

- **Requirement:** REQ-DATAEXPORT-04
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/` → điều hướng `nav.myData` (sidebar, hoặc drawer dưới lg)
- **Mong đợi:** tới `/my-data`, tiêu đề `myData.title`
- **Automated:** `tests/e2e/data-export/access.e2e.ts`

### TC-DATAEXPORT-038 — anonymous và khách không thấy mục My data trên sidebar

- **Requirement:** REQ-DATAEXPORT-04
- **Layer:** e2e · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** anonymous rồi khách mở `/` (mở drawer nếu dưới lg), đọc các link nav
- **Mong đợi:** không link nào có nhãn `nav.myData`
- **Automated:** `tests/e2e/data-export/access.e2e.ts`

## UI — tải dữ liệu

### TC-DATAEXPORT-039 — trang My data hiện tiêu đề, ba mục nội dung, nút tải và ghi chú riêng tư

- **Requirement:** REQ-DATAEXPORT-26
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `myData.title` (h1), `myData.description`, `myData.contents.heading`, đúng 3 mục `documents` / `matches` / `credentials`, nút `myData.download` bật, `myData.privacyNote`
- **Automated:** `tests/e2e/data-export/download.e2e.ts`

### TC-DATAEXPORT-040 — bấm tải nhận file export theo ngày chứa dữ liệu của chính mình

- **Requirement:** REQ-DATAEXPORT-27
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** bấm `myData.download`
- **Mong đợi:** một download tên `export-<ngày UTC>.zip`; giải nén có `data.json` với `user.id` = user e2e
- **Automated:** `tests/e2e/data-export/download.e2e.ts`

### TC-DATAEXPORT-041 — đang tải nút bận, đổi nhãn và bấm lần hai không gửi request thứ hai

- **Requirement:** REQ-DATAEXPORT-28
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** response thật của `/me/export` bị làm chậm
- **Bước:** bấm tải → bấm lại khi còn đang chờ
- **Mong đợi:** nút nhãn `myData.downloading`, disabled, `aria-busy="true"`; sau khi xong chỉ có đúng 1 request `/me/export` và 1 download
- **Automated:** `tests/e2e/data-export/download.e2e.ts`

### TC-DATAEXPORT-042 — tải xong hiện thông báo thành công trong vùng aria-live

- **Requirement:** REQ-DATAEXPORT-29
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `myData.done` nằm trong vùng `aria-live="polite"`; nút về nhãn `myData.download`, bật
- **Automated:** `tests/e2e/data-export/download.e2e.ts`

### TC-DATAEXPORT-043 — export lỗi 500 hiện alert của client, nút bấm lại và tải được

- **Requirement:** REQ-DATAEXPORT-30
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** lần gọi `/me/export` đầu tiên trả `500` với message server riêng
- **Bước:** bấm tải → thấy lỗi → bấm lại
- **Mong đợi:** `role="alert"` với `myData.error`, không chứa message server; nút bật lại; lần hai tải được file
- **Automated:** `tests/e2e/data-export/download.e2e.ts`

### TC-DATAEXPORT-044 — rời trang khi đang tải không gây lỗi trang hay console

- **Requirement:** REQ-DATAEXPORT-31
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** response `/me/export` bị làm chậm
- **Bước:** bấm tải → điều hướng sang `nav.match` khi còn đang chờ → đợi request xong
- **Mong đợi:** tới `/wizard`; không `pageerror`, không console error
- **Automated:** `tests/e2e/data-export/download.e2e.ts`

## UI — a11y, i18n

### TC-DATAEXPORT-045 — nút tải tới được bằng Tab, có focus indicator, kích hoạt bằng Enter và Space

- **Requirement:** REQ-DATAEXPORT-32
- **Layer:** e2e · **Priority:** P1
- **Bước:** Tab tới nút → Enter → (xong) Space
- **Mong đợi:** nút có accessible name `myData.download`; nhận focus bằng Tab với outline / box-shadow khác none; Enter và Space đều cho một download
- **Automated:** `tests/e2e/data-export/a11y-i18n.e2e.ts`

### TC-DATAEXPORT-046 — trang My data hiển thị tiếng Việt và tên file không đổi theo ngôn ngữ

- **Requirement:** REQ-DATAEXPORT-33
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/my-data` → đổi `vi` (dev hook) → bấm tải
- **Mong đợi:** tiêu đề, mô tả, heading + 3 mục nội dung, nút, ghi chú bằng `vi`; thông báo xong `myData.done` (vi); file vẫn `export-<ngày UTC>.zip`
- **Automated:** `tests/e2e/data-export/a11y-i18n.e2e.ts`
