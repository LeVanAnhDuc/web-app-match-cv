# DATAEXPORT — Tải dữ liệu của tôi (`GET /me/export`, trang `/my-data`)

## Quyền truy cập

- **REQ-DATAEXPORT-01** `GET /api/v1/me/export` chỉ dành cho user đã đăng nhập: anonymous, khách (guest session) và cookie phiên không hợp lệ đều nhận `401` với body `code: "SIGN_IN_REQUIRED"` và message i18n `auth.errors.signInRequired` theo ngôn ngữ request (en / vi).
- **REQ-DATAEXPORT-02** Route `/my-data` với khách / anonymous hiện màn mời đăng nhập: tiêu đề `gate.myData`, mô tả `gate.description`, nút "Sign in with Ducker ID" trỏ `…/auth/login?returnTo=/my-data`, link `gate.backMatching` về `/wizard`; trang không gọi `/me/export` và không hiện nút tải.
- **REQ-DATAEXPORT-03** Khi `/auth/me` còn đang tải, `/my-data` hiện skeleton `aria-busy="true"`, không nháy màn mời đăng nhập; trả lời xong thì hiện nội dung đúng với trạng thái đăng nhập.
- **REQ-DATAEXPORT-04** Mục sidebar `nav.myData` (icon Download) chỉ hiện cho user đã đăng nhập và dẫn tới `/my-data`; khách / anonymous không thấy mục này.

## Hợp đồng API

- **REQ-DATAEXPORT-05** `GET /me/export` trả `200`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="export-YYYY-MM-DD.zip"` (ngày UTC lúc export, do server sinh, chỉ `[a-z0-9-.]`), `Cache-Control: no-store`. Endpoint không nhận tham số.
- **REQ-DATAEXPORT-06** Zip chứa `data.json` ở gốc và thư mục `documents/` gồm đúng một entry cho mỗi tài liệu có file gốc (`fileData` > 0 byte); tài liệu paste-text không có entry, và không có entry nào khác.
- **REQ-DATAEXPORT-07** `data.json` có các khoá gốc `schemaVersion` (số nguyên dương), `exportedAt` (ISO 8601 UTC, thời điểm export), `user {id, role, createdAt}` của chính người gọi, `documents[]`, `matchResults[]`, `aiCredentials[]`.
- **REQ-DATAEXPORT-08** Mỗi phần tử `documents[]` có các field `id, kind, title, sourceFormat, isSaved, createdAt, rawText, file`; `file` là `documents/<entry>` trỏ tới entry có thật trong zip, hoặc `null` với paste-text.
- **REQ-DATAEXPORT-09** Mỗi phần tử `matchResults[]` có `id, cvDocumentId, jdDocumentId, overallScore, semanticScore, keywordScore, report, createdAt, credentialId, provider, chatModel, embedModel`; `credentialId` chỉ là id tham chiếu (có thể `null`), không nhúng credential.
- **REQ-DATAEXPORT-10** Mỗi phần tử `aiCredentials[]` có đúng các field `id, provider, label, keyLast4, chatModel, embedModel, lastTestStatus, lastTestedAt, lastUsedAt, createdAt`, không field nào khác.
- **REQ-DATAEXPORT-11** File trong `documents/` giống hệt từng byte với bản đã upload.
- **REQ-DATAEXPORT-12** Các mảng `documents`, `matchResults`, `aiCredentials` sắp theo `createdAt` tăng dần.

## Bảo mật / rò rỉ

- **REQ-DATAEXPORT-13** Không byte nào trong zip (bytes thô lẫn nội dung đã giải nén của mọi entry) chứa `encryptedKey` / `keyIv` / `keyTag` (tên field hay giá trị); credential chỉ lộ `keyLast4`. Đúng với nhiều credential.
- **REQ-DATAEXPORT-14** Cô lập theo user: zip của user A không chứa tài liệu, kết quả, credential hay file nào của user khác (kể cả của khách).
- **REQ-DATAEXPORT-15** Tên entry = slug(`title`) (lowercase, bỏ dấu, `đ→d`, chỉ giữ `[a-z0-9-]`, cắt 60 ký tự) + `-` + 6 hex đầu của `id` + đuôi suy từ `fileMime` (`pdf` / `docx`, khác thì `bin`), không bao giờ lấy đuôi từ tiêu đề. Ví dụ `CV Nguyễn Văn A` → `cv-nguyen-van-a-<id6>.pdf`.
- **REQ-DATAEXPORT-16** Zip-slip: tiêu đề chứa `../`, `/`, `\`, ký tự điều khiển vẫn cho entry nằm ngay dưới `documents/`, không thoát thư mục.
- **REQ-DATAEXPORT-17** Tiêu đề rỗng / toàn dấu câu / emoji → gốc tên là `document`, vẫn có hậu tố id; hai tiêu đề có slug trùng nhau → hai entry khác nhau, không ghi đè; tên dành riêng của Windows (`CON`, `NUL`, `COM1`) không thành tên entry trần.
- **REQ-DATAEXPORT-18** Tiêu đề 500+ ký tự → mỗi thành phần đường dẫn entry ≤ 255 ký tự.
- **REQ-DATAEXPORT-19** Tên entry không bị mojibake: hoặc thuần ASCII, hoặc có cờ UTF-8 (bit 11) trong header zip.

## Rỗng / dữ liệu lệch / biên

- **REQ-DATAEXPORT-20** User chưa có dữ liệu → `200` + zip hợp lệ chỉ gồm `data.json`, `documents`, `matchResults`, `aiCredentials` là `[]`; không có thư mục `documents/`; không bao giờ 404.
- **REQ-DATAEXPORT-21** `fileData` null nhưng `fileMime` có giá trị → `file: null`, không 500; `rawText` rỗng vẫn xuất hiện (chuỗi rỗng); ký tự NUL trong `rawText` bị loại để JSON hợp lệ.
- **REQ-DATAEXPORT-22** Biên số lượng / kích thước: 0 / 1 / 200 tài liệu có file cho đúng số entry; file 10 MB (cap upload) và file 1 byte được stream đủ, không cắt cụt.
- **REQ-DATAEXPORT-23** `Range: bytes=0-100` → `200` zip đầy đủ hoặc `416`, không bao giờ zip cụt; `Accept: application/json` → vẫn zip hoặc `406`, không 5xx; sai method (`POST` / `DELETE /me/export`) → `404` / `405`.

## Lỗi và giới hạn

- **REQ-DATAEXPORT-24** Lỗi trước khi gửi header → `500` với message i18n `me.errors.exportFailed`, không stack trace; lỗi sau khi header đã gửi → huỷ kết nối, không trả zip cụt kèm `200`.
- **REQ-DATAEXPORT-25** Throttle toàn cục 100 request / 60 giây áp cho `/me/export` (vượt → `429`).

## Trang `/my-data`

- **REQ-DATAEXPORT-26** Trang hiện tiêu đề `myData.title`, mô tả `myData.description`, thẻ `myData.contents.heading` liệt kê đúng 3 mục `myData.contents.documents` / `matches` / `credentials`, nút `myData.download`, ghi chú `myData.privacyNote`.
- **REQ-DATAEXPORT-27** Bấm nút → trình duyệt nhận một download tên `export-YYYY-MM-DD.zip` (client đặt theo ngày UTC), là zip dữ liệu của chính user đó.
- **REQ-DATAEXPORT-28** Đang dựng zip: nút loading + disabled + `aria-busy="true"`, nhãn đổi thành `myData.downloading`; bấm lần hai khi request đầu còn bay không tạo request thứ hai.
- **REQ-DATAEXPORT-29** Thành công → thông báo `myData.done` trong vùng `aria-live="polite"`, nút trở lại nhãn `myData.download` và bấm được.
- **REQ-DATAEXPORT-30** Lỗi (vd `500`) → Alert `role="alert"` với copy `myData.error` (luôn lấy từ i18n client, không hiện message của server), nút bấm lại được (không kẹt loading) và lần bấm lại tải được.
- **REQ-DATAEXPORT-31** Rời trang khi đang tải → không crash, không lỗi trang (pageerror) hay lỗi console.
- **REQ-DATAEXPORT-32** a11y: nút có accessible name, tới được bằng Tab, kích hoạt bằng Enter và Space, có focus indicator nhìn thấy được.
- **REQ-DATAEXPORT-33** i18n: mọi chuỗi trên trang render đúng ở `en` và `vi`; tên file zip không đổi theo ngôn ngữ.

## Độ đầy đủ của bản export

- **REQ-DATAEXPORT-34** Bản export chứa toàn bộ dữ liệu app giữ về user: thêm `coverLetters[]` và `matchRuns[]`, `documents[].parentId` (lineage), hồ sơ `user.email` / `user.fullName` / `user.avatar`; `schemaVersion` tăng lên `2` khi shape đổi.
