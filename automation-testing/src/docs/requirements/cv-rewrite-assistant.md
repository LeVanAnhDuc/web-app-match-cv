# CVREWRITEASSISTANT — Trợ lý viết lại CV từ kết quả so khớp (FR-12 · US-04)

Nguồn và lý do của từng dòng: `src/docs/decisions/cv-rewrite-assistant.md`.

## Điểm vào & quyền truy cập

- **REQ-CVREWRITEASSISTANT-01** Card kết quả ở wizard step 4 có nút "Improve my CV" / "Cải thiện CV" (`action.improveCv`) chỉ khi kết quả `status=succeeded` **và** người xem là user đã đăng nhập; card `failed` và card của khách không có nút. Bấm → điều hướng `/cv-rewrite/<matchResultId>`.
- **REQ-CVREWRITEASSISTANT-02** Mở lại một kết quả cũ từ bảng "Recent matches" ở Home đưa về step 4 với **một** card của đúng kết quả đó (không phải "No run to show"), và card đó có cùng nút "Improve my CV".
- **REQ-CVREWRITEASSISTANT-03** Khách / người chưa đăng nhập mở thẳng `/cv-rewrite/<id>` thấy SignInGate với tiêu đề `gate.cvRewrite` ("Sign in to rewrite this CV" / "Đăng nhập để viết lại CV này") + `gate.description`, trang không gọi API của mình (match, document, credential, cv-rewrite), không trang trắng.
- **REQ-CVREWRITEASSISTANT-04** `POST /cv-rewrite` và `POST /cv-rewrite/accept` chỉ dành cho user đã đăng nhập: không session → **401** `{ code: "SIGN_IN_REQUIRED" }` với message `auth.errors.signInRequired`; session khách → **401** như vậy.
- **REQ-CVREWRITEASSISTANT-05** Cô lập theo user: `matchResultId` không tồn tại hoặc của user khác → **404** `cvRewrite.errors.matchNotFound` ở cả generate lẫn accept, không tạo `Document` nào; `credentialId` không tồn tại hoặc của user khác → **404** `aiCredentials.errors.notFound` trước khi gọi AI.

## Trang & luồng sinh đề xuất

- **REQ-CVREWRITEASSISTANT-06** Trang hiện tiêu đề `rewrite.title` ("Improve this CV" / "Cải thiện CV này"), phụ đề `rewrite.subtitle`, thẻ setup `rewrite.setup.title` ("Rewrite "<tên CV>""; khi tiêu đề CV chưa tải xong dùng `rewrite.setup.thisCv`, **không bao giờ** lộ placeholder `{{title}}`) và danh sách gaps của match dưới `rewrite.gapsTitle`.
- **REQ-CVREWRITEASSISTANT-07** Vào trang **không tự sinh** đề xuất: không có `POST /cv-rewrite` nào cho tới khi user bấm "Generate suggestions" / "Sinh gợi ý".
- **REQ-CVREWRITEASSISTANT-08** Chọn key "Run with": mặc định là credential đã chạy ra match đó; credential null/đã xoá → "System key". Option hiển thị `<Provider> · <nhãn> · ••••<4 ký tự cuối>`, không bao giờ hiện key đầy đủ. Credential đang chọn chưa test `ok` → tag `credentials.runWith.untestedWarning`; đã test `ok` → không có tag.
- **REQ-CVREWRITEASSISTANT-09** Trước khi bấm sinh, thông báo quyền riêng tư nêu đích danh bên nhận: key hệ thống → `credentials.runWith.privacySystem`; credential riêng → `credentials.runWith.privacy` với tên provider. Đổi lựa chọn thì thông báo đổi theo.
- **REQ-CVREWRITEASSISTANT-10** Body sinh `{ matchResultId, credentialId? }`: chọn key hệ thống thì **không có** field `credentialId` (không gửi `null`); chọn credential thì gửi id của nó. Body sai kiểu (`matchResultId` thiếu / không phải UUID, `credentialId` không phải UUID) → **400**.
- **REQ-CVREWRITEASSISTANT-11** Đang sinh → nút Generate ở trạng thái loading và bấm thêm không gửi request thứ hai; skeleton đang chờ mang `aria-busy="true"` và nằm trong vùng `aria-live="polite"`.
- **REQ-CVREWRITEASSISTANT-12** Hợp đồng `201 CvRewriteProposalDto` = `{ matchResultId, cvDocumentId, cvTitle, provider, chatModel, changes[{ id, sectionHint|null, original, replacement, rationale, addressesGap|null }], unaddressedGaps[] }`; không field nào chứa API key / ciphertext.
- **REQ-CVREWRITEASSISTANT-13** Match không `succeeded` → **400** `cvRewrite.errors.matchFailed` ở cả generate lẫn accept.
- **REQ-CVREWRITEASSISTANT-14** Provider lỗi khi sinh → **503**, không tạo row nào; UI hiện `rewrite.err.generateFailed` và **giữ nguyên** đề xuất cũ đang có trên màn.
- **REQ-CVREWRITEASSISTANT-15** `POST /cv-rewrite` throttle **10 request / 60 s** (request thứ 11 trong cửa sổ → **429**); `POST /cv-rewrite/accept` throttle **20 request / 60 s** (request thứ 21 → **429**).

## Grounding (bất biến #13)

- **REQ-CVREWRITEASSISTANT-16** Một thay đổi chỉ hợp lệ khi `original` (sau khi gộp whitespace) xuất hiện trong CV **đúng một lần**, dài **≥ 12** ký tự, không chồng lấn thay đổi khác đã nhận, và `replacement` ≤ **1500** ký tự và ≤ **4×** độ dài đoạn neo trong CV. Lúc sinh, server **loại** mọi thay đổi không hợp lệ (bỏ qua phần tử không phải object, xét tối đa **25** thay đổi đầu vào) nên UI không bao giờ hiện thay đổi bịa; lúc accept, cùng luật đó chạy lại. Thay đổi có `replacement` rỗng (xoá đoạn) là hợp lệ.
- **REQ-CVREWRITEASSISTANT-17** So khớp neo bỏ qua khác biệt whitespace (xuống dòng / nhiều space) ở cả hai phía, nhưng `original` trả về và đoạn bị thay khi accept là **đúng đoạn nguyên văn** trong CV. Danh sách thay đổi của đề xuất sắp theo vị trí trong CV.
- **REQ-CVREWRITEASSISTANT-18** Chuỗi do model viết bị chặn độ dài trước khi tới UI: `unaddressedGaps` tối đa **25** mục × **300** ký tự, bỏ mục rỗng; `sectionHint` ≤ 60 ký tự (rỗng → null); `rationale` ≤ 300; `addressesGap` ≤ 300 (rỗng → null).

## Duyệt từng thay đổi

- **REQ-CVREWRITEASSISTANT-19** Mỗi thay đổi là một thẻ `role="group"`: eyebrow `sectionHint` (null → `rewrite.change.untitled`), `original` dưới nhãn `rewrite.change.original`, `replacement` dưới `rewrite.change.suggested`, `rationale`, `addressesGap` thành Tag (null → không có Tag rỗng). Thay đổi xoá → Tag `rewrite.change.removal` và **không** có khối "Suggested wording".
- **REQ-CVREWRITEASSISTANT-20** Mặc định **không tick** thay đổi nào; "Save as new CV" disabled khi 0 tick; "Select all" tick / bỏ tick toàn bộ; bộ đếm `rewrite.changes.selectedCount` đúng số nhiều (en `_one` / `_other`).
- **REQ-CVREWRITEASSISTANT-21** "Preview the result" hiện văn bản CV sau khi áp **đúng** các thay đổi đang tick; đoạn không tick giữ nguyên văn; `$&`, `` $` ``, `$'` trong replacement hiện nguyên văn (không bị hiểu là pattern).
- **REQ-CVREWRITEASSISTANT-22** Đề xuất 0 thay đổi → Alert `rewrite.changes.empty` + `rewrite.changes.emptyHint`, không danh sách rỗng câm, không có nút Save. `unaddressedGaps` khác rỗng → Alert cảnh báo `rewrite.unaddressed.title` + hint + từng gap; rỗng → không render. Match có `gaps=[]` → Alert `rewrite.noGaps`, nút Generate vẫn dùng được.
- **REQ-CVREWRITEASSISTANT-23** Bấm "Generate again" (`rewrite.regenerate`) khi đã có đề xuất: đề xuất mới thay thế cũ ngay (không hộp xác nhận) và **mọi tick cũ bị bỏ**.

## Lưu thành CV mới

- **REQ-CVREWRITEASSISTANT-24** "Save as new CV" mở modal `rewrite.save.title`, ô "Document name" điền sẵn `rewrite.save.defaultTitle` ("<tên CV gốc> (improved)" / "(cải thiện)"); tên rỗng **hoặc chỉ có khoảng trắng** → lỗi `save.nameRequired` ngay trong modal, không gửi request; ô tối đa **200** ký tự (không gõ được ký tự thứ 201).
- **REQ-CVREWRITEASSISTANT-25** Accept chỉ gửi `{ matchResultId, title, changes: [{ original, replacement }] }` của **đúng** các thay đổi đã tick; thành công → thông báo `rewrite.save.success`, điều hướng `/cv`, CV mới có trong thư viện.
- **REQ-CVREWRITEASSISTANT-26** Validate accept: `title` trim rồi `1..200` (toàn khoảng trắng → 400, lưu bản đã trim); `changes` **1..25** phần tử; `original` 1..5000; `replacement` 0..1500; `matchResultId` UUID. Sai → **400**.
- **REQ-CVREWRITEASSISTANT-27** Accept **không tin client**: chạy lại grounding trên văn bản CV đọc từ DB; neo không có / mơ hồ / quá ngắn → 400 `cvRewrite.errors.changeNotGrounded`; chồng lấn → 400 `changesOverlap`; phình → 400 `changeTooLong`; kết quả rỗng/trắng → 400 `emptyResult`; mọi trường hợp 400 **không tạo** `Document` (all-or-nothing).
- **REQ-CVREWRITEASSISTANT-28** Document mới: `kind=CV`, `sourceFormat=text`, `isSaved=true`, `parentId` = id CV gốc, `fileData`/`fileMime` = null, chủ sở hữu là chủ của CV gốc; CV gốc **không đổi một byte**. Response `201 DocumentDto` có `parentId`.
- **REQ-CVREWRITEASSISTANT-29** Accept lỗi: 400 → Alert `rewrite.err.notGrounded`; lỗi khác → `rewrite.err.saveFailed`; modal vẫn mở và **tick còn nguyên**. Bấm Save hai lần nhanh → đúng **1** document.
- **REQ-CVREWRITEASSISTANT-30** Xoá CV gốc không kéo theo bản viết lại (`parentId` thành null, bản mới thành gốc). CV gốc còn được `MatchResult` tham chiếu thì `DELETE /documents/:id` bị chặn **409** `documents.errors.inUseByMatch` và bản viết lại giữ nguyên.

## Lỗi tải trang

- **REQ-CVREWRITEASSISTANT-31** `GET /match/:id` → 404 → `rewrite.err.matchNotFound`; lỗi khác → `err.matchFailed`; đang tải → Skeleton; không trang trắng. `POST /cv-rewrite` → 404 (match bị xoá ở tab khác) → `rewrite.err.matchNotFound`.

## Dữ liệu, bảo mật, i18n, a11y

- **REQ-CVREWRITEASSISTANT-32** `original`, `replacement`, `rationale`, `sectionHint`, `unaddressedGaps`, preview hiển thị dạng text: CV chứa `<script>` / `<b>` hiện nguyên văn, không tạo node `script` / `b`. DOM và response không chứa API key hay ciphertext.
- **REQ-CVREWRITEASSISTANT-33** Mọi chuỗi của trang có cả `en` và `vi` (khoá `rewrite.*`, `action.improveCv`, `gate.cvRewrite`, `credentials.runWith.*`), không lộ key i18n thô; message lỗi BE theo `Accept-Language` / `?lang=` (`cvRewrite.errors.*` en + vi). Chuỗi nguồn là file locale hiện có.
- **REQ-CVREWRITEASSISTANT-34** Bàn phím: Run with → Generate → Select all → từng checkbox → Save đi được bằng Tab và kích hoạt được bằng phím; mỗi checkbox thay đổi có accessible name **phân biệt được** giữa các thay đổi; modal Save: focus vào ô tên khi mở, `Esc` đóng.
- **REQ-CVREWRITEASSISTANT-35** Màn này không ghi log nội dung CV / key; lỗi trả client không có stack trace / tên bảng; luồng chuẩn không có lỗi JS chưa bắt hay response 5xx.
