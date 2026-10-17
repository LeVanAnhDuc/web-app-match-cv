# CVJDMATCHINGWIZARD — Wizard so khớp CV ↔ JD (nạp tài liệu, review, chấm hybrid, báo cáo, chấm tiếng Việt)

Phạm vi: FR-01 (nạp + parse trong wizard), FR-03 (wizard 4 bước), FR-04 (chấm hybrid), FR-05 (báo cáo), FR-11 (chấm
tiếng Việt), luồng US-01. Nguồn và quyết định: `docs/decisions/cv-jd-matching-wizard.md`.
Mã REQ-CVJDMATCHINGWIZARD-38 bỏ trống có chủ đích (rate limit riêng cho `POST /match` là nợ, không phải requirement — Q5/D4).

## Wizard — điều hướng & trạng thái

- **REQ-CVJDMATCHINGWIZARD-01** `/wizard` mở ở bước 1 (JD); stepper hiện 4 bước theo thứ tự JD → CV → Review → Result với nhãn `step.jd` / `step.cv` / `step.review` / `step.result`; bước hiện tại có `aria-current="step"`.
- **REQ-CVJDMATCHINGWIZARD-02** Không nhảy tới bước sau khi bước trước chưa có dữ liệu: bước bị chặn có `aria-disabled="true"` kèm mô tả `step.blocked.2` / `step.blocked.3` / `step.blocked.4`; chỉ bước đã xong mới bấm được (nút `step.jumpTo` "Go to {label}") và chỉ nhảy lùi.
- **REQ-CVJDMATCHINGWIZARD-03** Bước 1 nút Back bị vô hiệu; Next bị vô hiệu cho tới khi có file hợp lệ, có text dán (sau trim ≥ 1 ký tự) hoặc đã chọn một tài liệu đã lưu. Text chỉ gồm khoảng trắng không mở khoá Next.
- **REQ-CVJDMATCHINGWIZARD-04** Next ở bước 1/2 tạo tài liệu tạm (`save=false`) rồi sang bước kế; trong lúc gửi nút Next ở trạng thái loading, bấm lặp không tạo thêm tài liệu và không nhảy 2 bước.
- **REQ-CVJDMATCHINGWIZARD-05** Back (bước 2 → 1, bước 3 → 2) giữ dữ liệu đã nạp: quay lại bước trước rồi đi tiếp không phải nạp lại tài liệu (Next dùng lại tài liệu đã chọn).
- **REQ-CVJDMATCHINGWIZARD-06** Đổi JD hoặc CV sang tài liệu khác sau khi đã chạy match thì kết quả cũ bị bỏ (bước 4 bị chặn lại cho tới khi chạy match mới); chọn lại đúng tài liệu cũ thì kết quả không mất.
- **REQ-CVJDMATCHINGWIZARD-07** Ở bước 4, `action.startOver` "Start over" đưa wizard về bước 1 trống (xoá JD, CV, run).
- **REQ-CVJDMATCHINGWIZARD-08** Vào bước 3 khi thiếu JD/CV thì hiện `review.missingDocs` kèm nút Back (không quay vô hạn); vào bước 4 khi không có run thì hiện `result.missingRun` kèm Start over.
- **REQ-CVJDMATCHINGWIZARD-09** Tải lại trang giữa wizard đưa về bước 1 trống (state chỉ nằm trong bộ nhớ); `/wizard?runId=<run của mình>` mở thẳng bước 4 với run đó rồi xoá `runId` khỏi URL; `runId` không tồn tại hoặc của người khác → về bước 1 kèm thông báo `result.missingRun`.

## Nạp tài liệu (FR-01 trong wizard)

- **REQ-CVJDMATCHINGWIZARD-10** Bước 1 và 2 có hai chế độ `input.tab.upload` "Upload file" / `input.tab.paste` "Paste text"; đổi chế độ xoá lỗi đang hiện và lựa chọn tài liệu đã lưu. Tiêu đề thẻ: `wizard.stepJd.title` (bước 1), `wizard.stepCv.title` (bước 2).
- **REQ-CVJDMATCHINGWIZARD-11** Upload nhận PDF và DOCX (kiểm đuôi `.pdf` / `.docx`, không phân biệt hoa thường); vùng thả hiện `dropzone.hint` "Supports PDF, DOCX (Max 10MB)"; chọn file xong vùng thả hiện tên file.
- **REQ-CVJDMATCHINGWIZARD-12** File sai loại (vd `.png`, `.exe`) bị chặn ngay ở client với `err.fileType`, không gửi request nào lên server.
- **REQ-CVJDMATCHINGWIZARD-13** Giới hạn kích thước ở client là 10 MB = 10 485 760 byte: nhỏ hơn và bằng giới hạn được nhận, lớn hơn bị chặn với `err.fileSize`. Vừa sai loại vừa quá cỡ → báo lỗi loại.
- **REQ-CVJDMATCHINGWIZARD-14** Server kiểm lại loại và cỡ, không tin client: multipart với MIME ngoài PDF/DOCX → 400 `documents.errors.unsupportedFileType`; file lớn hơn 10 485 760 byte → 400 `documents.errors.fileTooLarge`; sai loại + quá cỡ → message loại. Biên server khớp biên client: file đúng 10 485 760 byte được nhận.
- **REQ-CVJDMATCHINGWIZARD-15** File hỏng hoặc không có chữ đọc được (nội dung không phải PDF/DOCX thật, DOCX rỗng) → 400 `documents.errors.parseFailed`; ở wizard lỗi hiện inline (`role="alert"`) và người dùng vẫn ở bước đang nạp.
- **REQ-CVJDMATCHINGWIZARD-16** Parse có trần tài nguyên: quá 15 s hoặc văn bản trích ra dài hơn 2 000 000 ký tự → 400 `documents.errors.parseFailed`, không treo, không 5xx.
- **REQ-CVJDMATCHINGWIZARD-17** Dán text: server trim; rỗng/toàn khoảng trắng và không kèm file → 400 `documents.errors.emptyText`; `sourceText` tối đa 100 000 ký tự (100 000 nhận, 100 001 → 400).
- **REQ-CVJDMATCHINGWIZARD-18** `POST /documents` trả 201 `DocumentDto` {id, kind, title, sourceFormat `pdf|docx|text`, rawText, isSaved, parentId, createdAt}; không lưu thì `title` suy từ dòng không rỗng đầu tiên, cắt 80 ký tự + "…"; file gốc được giữ để xem trước; `kind` ngoài `CV|JD` → 400.

## Lưu để dùng lại / chọn tài liệu đã lưu

- **REQ-CVJDMATCHINGWIZARD-19** Người đã đăng nhập, khi đã có input mới, thấy nút `save.button` "Save for reuse"; modal `save.modal.title` có mô tả `save.modal.description` và ô tên có nhãn `save.modal.nameLabel`; tên rỗng → `save.nameRequired` (không gửi request); lưu xong hiện `save.saved` "Saved for reuse: {title}" và Next dùng luôn tài liệu vừa lưu (không tạo bản thứ hai).
- **REQ-CVJDMATCHINGWIZARD-20** Server: `save=true` mà `title` rỗng sau trim → 400 `documents.errors.titleRequiredWhenSaving`; `title` dài hơn 200 ký tự → 400 (200 ký tự được nhận) với message bản địa hoá theo ngôn ngữ của request.
- **REQ-CVJDMATCHINGWIZARD-21** Dưới vùng nạp có danh sách `reuse.jd.title` / `reuse.cv.title`: chỉ tài liệu đã lưu, đúng loại, của chính user, mới nhất trước; mỗi dòng có tiêu đề, ngày, nhãn định dạng `format.pdf` / `format.docx` / `format.text` (không phải enum thô). Chọn một dòng (radio) → Next dùng tài liệu đó, không gọi `POST /documents`.
- **REQ-CVJDMATCHINGWIZARD-22** Chưa lưu gì → empty state `reuse.empty.jd` / `reuse.empty.cv` kèm `reuse.empty.hint`. Không tải được danh sách (request lỗi) thì báo lỗi, không hiện empty state như thể chưa lưu gì.
- **REQ-CVJDMATCHINGWIZARD-23** Khách (chưa đăng nhập) dùng được bước 1–2 (lần `POST /documents` đầu tiên cấp phiên khách), thấy `input.guestNote` kèm link đăng nhập trả về `/wizard`; không thấy nút lưu và danh sách tài liệu đã lưu. `GET /documents` với phiên khách → 401 `SIGN_IN_REQUIRED`.

## Bước 3 — Review

- **REQ-CVJDMATCHINGWIZARD-24** Bước 3 hiện `wizard.stepReview.title` + `wizard.stepReview.description`, hai khung CV và JD chỉ đọc (không có ô sửa được): text → hiện nguyên văn; PDF/DOCX → xem trước bản gốc.
- **REQ-CVJDMATCHINGWIZARD-25** Trong lúc tải tài liệu hiện `review.loading`; tải lỗi (vd 404 vì tài liệu không còn) phải ra trạng thái lỗi có lối thoát (alert + Back), không quay `review.loading` vô hạn. Xem trước PDF lỗi → `preview.error`.
- **REQ-CVJDMATCHINGWIZARD-26** Trước khi bấm chạy, bước 3 nêu đích danh nhà cung cấp sắp nhận nội dung CV/JD (NFR-DATA-05): khách (luôn chạy bằng key hệ thống) thấy `credentials.runWith.privacySystem` "Your CV and JD text will be sent to OpenRouter using the system key."; người đã đăng nhập thấy `credentials.runWith.privacyList`, trong đó key hệ thống được nêu là `credentials.runWith.privacySystemEntry` "OpenRouter (system key)" (quyết định Q10, user 2026-10-17).
- **REQ-CVJDMATCHINGWIZARD-27** User chưa thêm khoá AI nào: mặc định chạy bằng `credentials.systemKey` "System key", một kết quả; nút `action.runMatch` "Run match".
- **REQ-CVJDMATCHINGWIZARD-28** "Run match" mở run (`POST /match/runs`) rồi sang bước 4 ngay; nút loading trong lúc mở run; mở run lỗi → lỗi inline `role="alert"` ở bước 3. Bấm đúp chỉ sinh đúng 1 `POST /match/runs` và 1 `POST /match` mỗi provider.

## Chấm điểm — API (FR-04)

- **REQ-CVJDMATCHINGWIZARD-29** `POST /match` {cvDocumentId, jdDocumentId, runId?, credentialId?} trả 201 `MatchResultDto` gồm overallScore, semanticScore, keywordScore (số nguyên 0–100), report {strengths[], gaps[], suggestions[]}, provider, chatModel, embedModel, credentialId (null = key hệ thống), runId, status `succeeded|failed`, errorCode, createdAt.
- **REQ-CVJDMATCHINGWIZARD-30** `overallScore = round(0.6 × semanticScore + 0.4 × keywordScore)`; LLM không tham gia công thức; `keywordScore = round(|JD ∩ CV| / |JD| × 100)` trên token đã chuẩn hoá; `semanticScore` = cosine của hai embedding × 100, kẹp [0, 100].
- **REQ-CVJDMATCHINGWIZARD-31** Chỉ 20 000 ký tự đầu của mỗi tài liệu được dùng để chấm và gửi cho AI; tài liệu dài hơn vẫn chấm được.
- **REQ-CVJDMATCHINGWIZARD-32** Validate & sở hữu của `POST /match`: id không phải UUID / thiếu field → 400; CV hoặc JD không tồn tại hoặc của user khác → 400 `matching.errors.documentNotOwned` (không phân biệt hai trường hợp); đảo kind → 400 `matching.errors.invalidDocumentKind`; `runId` của người khác/không tồn tại → 404 `matching.errors.runNotFound`; `runId` thuộc cặp tài liệu khác → 400 `matching.errors.runDocumentMismatch`. Mọi nhánh này trả lời trước khi gọi AI.
- **REQ-CVJDMATCHINGWIZARD-33** `POST /match/runs` có cùng kiểm sở hữu/kind như `POST /match` và trả 201 {id, cvDocumentId, jdDocumentId, createdAt} mà không gọi AI; `GET /match/runs/:id` trả run kèm các kết quả đã có (có thể rỗng); run của user khác hoặc không tồn tại → 404.
- **REQ-CVJDMATCHINGWIZARD-34** `GET /match/:id` trả kết quả của chính user; id của người khác hoặc không tồn tại → 404 `matching.errors.matchNotFound`; id không phải UUID → 400.
- **REQ-CVJDMATCHINGWIZARD-35** Provider lỗi (sai khoá, hết hạn mức, model không có, timeout 20 s, không kết nối được) là dữ liệu: 201 với `status=failed`, `errorCode` ∈ {invalid_key, no_quota, model_unavailable, timeout, unreachable}, điểm 0, report rỗng — không 5xx, không lộ message của provider. Chỉ thiếu cấu hình key hệ thống mới trả 503 `ai.errors.notConfigured`.
- **REQ-CVJDMATCHINGWIZARD-36** Kết quả chụp lại provider / chatModel / embedModel trên chính row (không suy từ credential hiện tại); response không chứa khoá/token AI.
- **REQ-CVJDMATCHINGWIZARD-37** Khách chỉ chạy bằng key hệ thống: gửi `credentialId` → 403 `GUEST_FORBIDDEN_CREDENTIAL` (`matching.errors.guestCredential`); chưa có phiên (ẩn danh) gọi `POST /match` → 401 `SIGN_IN_REQUIRED`.
- **REQ-CVJDMATCHINGWIZARD-39** Lỗi trả về client không chứa stack trace, tên bảng hay câu SQL.

## Bước 4 — Báo cáo (FR-05)

- **REQ-CVJDMATCHINGWIZARD-40** Trong lúc chấm, thẻ kết quả hiện skeleton (`aria-busy="true"`) với tiêu đề provider ("System key" khi dùng key hệ thống); vùng kết quả có `aria-live="polite"`.
- **REQ-CVJDMATCHINGWIZARD-41** Thành công: thẻ có tiêu đề `<provider> · <chatModel>`, ba chỉ số `result.overall` / `result.semantic` / `result.keyword` hiện số nguyên kèm `%` (không phải số thập phân); ba danh sách `result.strengths` / `result.gaps` / `result.suggestions` hiện thành mục đọc được (không JSON thô). Một provider thì báo cáo mở sẵn.
- **REQ-CVJDMATCHINGWIZARD-42** Thất bại: thẻ hiện `role="alert"` với đúng lý do `result.error.<errorCode>` và nút `action.tryAgain` chạy lại; lỗi mạng / 503 cũng ra alert có Try again (không màn trắng, không spinner vô hạn).
- **REQ-CVJDMATCHINGWIZARD-43** User đã đăng nhập thấy trên thẻ `action.improveCv`, `coverLetter.open`, và `action.compareVersions` chỉ khi CV có phiên bản trước; khách không thấy các nút này.
- **REQ-CVJDMATCHINGWIZARD-44** Kết quả được lưu: mở lại `GET /match/:id` hoặc `/wizard?runId=` cho cùng điểm và báo cáo, không gọi AI lần nữa.

## Chấm tiếng Việt (FR-11)

- **REQ-CVJDMATCHINGWIZARD-45** Tài liệu tiếng Việt có dấu không bị băm vụn và so khớp sau khi bỏ dấu (`nghiệm` ≡ `nghiem`, `đ` ≡ `d`): cặp CV có dấu ↔ JD không dấu cho cùng keywordScore với cặp CV có dấu ↔ JD có dấu.
- **REQ-CVJDMATCHINGWIZARD-46** Cùng văn bản ở dạng Unicode NFC và NFD cho cùng keywordScore.
- **REQ-CVJDMATCHINGWIZARD-47** Alias kỹ thuật được gộp (`ReactJS` / `React.js` → `react`, `postgres` → `postgresql`, `k8s` → `kubernetes`…); `C++`, `C#`, `Node.js` giữ ký tự đặc biệt; `ai`, `ma`, `nam` không bị coi là stopword; token 1 ký tự bị bỏ (hạn chế đã chấp nhận).
- **REQ-CVJDMATCHINGWIZARD-48** Cặp CV ↔ JD tiếng Anh thuần không bị giảm điểm so với tokenizer cũ.

## i18n · a11y · responsive

- **REQ-CVJDMATCHINGWIZARD-49** Mọi chuỗi của wizard (stepper, tiêu đề bước, nút, lỗi client, empty state, nhãn báo cáo, lỗi provider) có bản EN và VI, đổi ngôn ngữ không lộ key thô; lỗi từ server trả theo ngôn ngữ của request (`?lang=` hoặc `Accept-Language`) và có bản VI cho mọi lỗi `documents.errors.*`, `matching.errors.*`, `ai.errors.*`.
- **REQ-CVJDMATCHINGWIZARD-50** Ngày trong danh sách tài liệu đã lưu định dạng theo ngôn ngữ giao diện.
- **REQ-CVJDMATCHINGWIZARD-51** Mọi hành động của wizard thao tác được bằng bàn phím (chọn radio tài liệu đã lưu, Next/Back, Run match, Start over, modal lưu); Next/Back/Run match là `button` có tên; danh sách tài liệu đã lưu là `radiogroup` với từng radio có nhãn; ô tên trong modal có nhãn; lỗi có `role="alert"`.
- **REQ-CVJDMATCHINGWIZARD-52** Ở mọi viewport (1280×720, 820×1180, 390×844) bước 1–4 không có scroll ngang; stepper xuất hiện đúng 1 lần trong DOM, nhãn bước dưới 768 px vẫn trong accessibility tree; nút CTA của bước (Next / Run match) nằm trong viewport ngay khi vào bước; sang bước mới thì header bước nằm trong viewport; nút footer cao ≥ 44 px dưới 768 px.
- **REQ-CVJDMATCHINGWIZARD-53** Luồng chính bước 1 → 4 không có lỗi console và không có response 5xx.
