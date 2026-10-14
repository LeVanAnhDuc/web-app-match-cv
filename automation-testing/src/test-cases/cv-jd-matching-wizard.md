# CVJDMATCHINGWIZARD — Wizard so khớp CV ↔ JD

Requirement: `docs/requirements/cv-jd-matching-wizard.md` · quyết định: `docs/decisions/cv-jd-matching-wizard.md`.
Mọi case UI chạy bằng một user đăng nhập mới cho riêng test (fixture `wizardUser`), hoặc ẩn danh (`guestWizardPage`);
chỉ `POST /match` bị stub (D1). Case API dùng user tạo bằng `utils/sessions.ts`, xoá (cascade) sau khi chạy.
Áp 6 lăng kính theo thứ tự: truy vết REQ → phân vùng tương đương → giá trị biên → chuyển trạng thái → đoán lỗi → bảo mật.

## Stepper & trạng thái

### TC-CVJDMATCHINGWIZARD-001 — wizard mở ở bước 1 với stepper 4 bước đúng thứ tự

- **Requirement:** REQ-CVJDMATCHINGWIZARD-01
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user đăng nhập mới
- **Bước:** mở `/wizard`
- **Mong đợi:** heading `wizard.stepJd.title`; chấm bước 1 có `aria-current="step"`, bước 2–4 không; 4 nhãn `step.jd` / `step.cv` / `step.review` / `step.result` mỗi nhãn đúng 1 lần, xếp trái → phải theo thứ tự
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-002 — bước chưa có dữ liệu bị chặn, bước đã xong chỉ cho nhảy lùi

- **Requirement:** REQ-CVJDMATCHINGWIZARD-02
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/wizard` → kiểm bước 2–4 → dán JD, Next → kiểm stepper → bấm "Go to Job Description"
- **Mong đợi:** lúc đầu bước 2/3/4 có `aria-disabled="true"` và mô tả `step.blocked.2/3/4`; ở bước 2 chỉ bước 1 thành nút "Go to …", bước 3 vẫn bị chặn, bước 3/4 không có nút; bấm nút về bước 1; không có nút nhảy tới bước trước mặt
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-003 — Back ở bước 2 và bước 3 giữ tài liệu đã nạp

- **Requirement:** REQ-CVJDMATCHINGWIZARD-05
- **Layer:** e2e · **Priority:** P1
- **Bước:** dán JD → Next → dán CV → Next (bước 3) → Back → Next → Back → Back
- **Mong đợi:** sau Back về bước 2, Next bật sẵn (không phải nạp lại) và đưa lại bước 3 với đúng CV/JD cũ; Back về bước 1, Next cũng bật sẵn
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-01](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-01)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-004 — đổi JD sau khi đã chạy match thì chặn lại bước 4

- **Requirement:** REQ-CVJDMATCHINGWIZARD-06
- **Layer:** e2e · **Priority:** P1
- **Bước:** chạy hết tới bước 4 (stub) → "Go to Job Description" → dán JD khác → Next
- **Mong đợi:** ở bước 2, chấm bước 4 có `aria-disabled="true"` kèm `step.blocked.4` (kết quả cũ bị bỏ)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-005 — chọn lại đúng JD đã lưu sau khi chạy match thì không mất kết quả

- **Requirement:** REQ-CVJDMATCHINGWIZARD-06
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 JD đã lưu (seed qua API)
- **Bước:** chọn JD đã lưu → Next → dán CV → Next → Run match (stub) → về bước 1 → chọn lại đúng JD đó → Next
- **Mong đợi:** ở bước 2, bước 4 không bị `aria-disabled`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-006 — Start over ở bước 4 đưa wizard về bước 1 trống

- **Requirement:** REQ-CVJDMATCHINGWIZARD-07
- **Layer:** e2e · **Priority:** P1
- **Bước:** chạy tới bước 4 (stub) → `action.startOver`
- **Mong đợi:** heading bước 1, bước 1 `aria-current`, Back và Next tắt, bước 2–4 lại bị chặn
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-007 — vào bước 3/4 khi thiếu dữ liệu hiện thông báo có lối thoát

- **Requirement:** REQ-CVJDMATCHINGWIZARD-08
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** bước 3 thiếu JD/CV → `review.missingDocs` + Back; bước 4 thiếu run → `result.missingRun` + Start over
- **Automated:** manual — không có đường nào trên UI để vào bước 3/4 mà thiếu dữ liệu (store chỉ trong bộ nhớ, stepper chặn nhảy tới, reload về bước 1); guard đã có unit test ở `client/src/views/Wizard/mains/StepReview/__tests__` và `StepResult/__tests__`

### TC-CVJDMATCHINGWIZARD-008 — tải lại trang giữa wizard đưa về bước 1 trống

- **Requirement:** REQ-CVJDMATCHINGWIZARD-09
- **Layer:** e2e · **Priority:** P2
- **Bước:** dán JD → Next (bước 2) → tải lại trang
- **Mong đợi:** bước 1 đang chọn, bước 2 bị chặn, Next tắt
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-009 — mở /wizard?runId= của mình vào thẳng bước 4 với kết quả đã lưu, không gọi AI

- **Requirement:** REQ-CVJDMATCHINGWIZARD-09, REQ-CVJDMATCHINGWIZARD-44
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** CV + JD + run tạo qua API; một MatchResult của run đó seed thẳng vào DB (điểm 77/81/71)
- **Bước:** mở `/wizard?runId=<id>`
- **Mong đợi:** bước 4 đang chọn, meter overall/semantic/keyword = 77/81/71, báo cáo hiện, URL không còn `runId`
- **Kiểm chứng thêm:** không có `POST /match` nào được gửi
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

### TC-CVJDMATCHINGWIZARD-010 — runId không tồn tại đưa về bước 1 kèm thông báo

- **Requirement:** REQ-CVJDMATCHINGWIZARD-09
- **Layer:** e2e · **Priority:** P2
- **Bước:** mở `/wizard?runId=<uuid ngẫu nhiên>`
- **Mong đợi:** toast `result.missingRun`, bước 1 đang chọn, URL không còn `runId`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/stepper.e2e.ts`

## Nạp tài liệu (UI)

### TC-CVJDMATCHINGWIZARD-011 — Next chỉ mở khi có nội dung: rỗng và khoảng trắng giữ Next tắt, 1 ký tự mở Next

- **Requirement:** REQ-CVJDMATCHINGWIZARD-03
- **Layer:** e2e · **Priority:** P1
- **Bước:** bước 1: kiểm Back/Next → chọn Paste text → dán `"   \n\t "` → dán `"x"` → xoá hết
- **Mong đợi:** Back tắt; Next tắt khi rỗng/khoảng trắng, bật với 1 ký tự, tắt lại khi xoá
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-012 — bấm đúp Next chỉ tạo một tài liệu và chỉ sang bước 2

- **Requirement:** REQ-CVJDMATCHINGWIZARD-04
- **Layer:** e2e · **Priority:** P1
- **Bước:** dán JD → double-click Next
- **Mong đợi:** đang ở bước 2 (không nhảy 2 bước)
- **Kiểm chứng thêm:** đúng 1 `POST /documents` với `{kind: "JD", save: false}`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-013 — đổi chế độ Upload/Paste xoá lỗi đang hiện và bỏ chọn tài liệu đã lưu

- **Requirement:** REQ-CVJDMATCHINGWIZARD-10
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 JD đã lưu
- **Bước:** chọn `.exe` (lỗi) → sang Paste text → chọn JD đã lưu → sang Upload file → dán text → Next
- **Mong đợi:** có hai tab `input.tab.upload` / `input.tab.paste`; đổi tab xoá alert; đổi tab bỏ chọn radio và tắt Next; Next sau đó tới bước 2 (`wizard.stepCv.title`)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-014 — chọn file PDF/DOCX hợp lệ hiện tên file và mở Next, đuôi viết HOA cũng nhận

- **Requirement:** REQ-CVJDMATCHINGWIZARD-11
- **Layer:** e2e · **Priority:** P1
- **Bước:** kiểm `dropzone.hint` → chọn `sample.pdf` → `sample.docx` → `RESUME.PDF`
- **Mong đợi:** mỗi lần vùng thả hiện tên file, không alert, Next bật
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-015 — file sai loại bị chặn ở client, không gửi request

- **Requirement:** REQ-CVJDMATCHINGWIZARD-12
- **Layer:** e2e · **Priority:** P1
- **Bước:** chọn `malware.exe`, rồi (test thứ hai) `photo.png`
- **Mong đợi:** alert `err.fileType`, Next tắt
- **Kiểm chứng thêm:** không có `POST /documents`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-016 — biên 10 MB ở client: đúng giới hạn được nhận, vượt 1 byte bị chặn

- **Requirement:** REQ-CVJDMATCHINGWIZARD-13
- **Layer:** e2e · **Priority:** P1
- **Bước:** chọn file `.pdf` 10 485 759 byte → `.docx` 10 485 760 byte → `.pdf` 10 485 761 byte
- **Mong đợi:** hai file đầu được nhận (không alert, tên file hiện); file cuối → `err.fileSize` (max `10MB`), tên file không hiện
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-017 — vừa sai loại vừa quá cỡ thì báo lỗi loại

- **Requirement:** REQ-CVJDMATCHINGWIZARD-13
- **Layer:** e2e · **Priority:** P2
- **Bước:** chọn `huge.exe` 10 485 761 byte
- **Mong đợi:** alert `err.fileType` (không phải `err.fileSize`), Next tắt
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

### TC-CVJDMATCHINGWIZARD-018 — file hỏng báo lỗi đọc file inline và vẫn ở bước đang nạp

- **Requirement:** REQ-CVJDMATCHINGWIZARD-15
- **Layer:** e2e · **Priority:** P1
- **Bước:** chọn `broken.pdf` (nội dung không phải PDF) → Next
- **Mong đợi:** `POST /documents` 400; alert `documents.errors.parseFailed`; vẫn ở bước 1
- **Automated:** `tests/e2e/cv-jd-matching-wizard/document-input.e2e.ts`

## Nạp tài liệu (API)

### TC-CVJDMATCHINGWIZARD-019 — MIME ngoài PDF/DOCX bị từ chối với unsupportedFileType

- **Requirement:** REQ-CVJDMATCHINGWIZARD-14
- **Layer:** api · **Priority:** P1
- **Bước:** upload multipart `image/png`, `text/plain`
- **Mong đợi:** 400 `documents.errors.unsupportedFileType`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-020 — file vượt 10 MB bị từ chối với fileTooLarge

- **Requirement:** REQ-CVJDMATCHINGWIZARD-14
- **Layer:** api · **Priority:** P1
- **Bước:** upload `application/pdf` 10 485 761 byte
- **Mong đợi:** 400 `documents.errors.fileTooLarge`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-021 — file đúng 10 485 760 byte được nhận

- **Requirement:** REQ-CVJDMATCHINGWIZARD-14
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** DOCX thật (sample.docx + phần đệm lưu không nén) đúng 10 485 760 byte
- **Bước:** upload
- **Mong đợi:** 201, `sourceFormat: "docx"` (khớp biên client ở TC-016)
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-02](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-02)
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-022 — vừa sai loại vừa quá cỡ thì server báo lỗi loại

- **Requirement:** REQ-CVJDMATCHINGWIZARD-14
- **Layer:** api · **Priority:** P2
- **Bước:** upload `image/png` 10 485 761 byte
- **Mong đợi:** 400 `documents.errors.unsupportedFileType`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-023 — file hỏng và DOCX rỗng trả parseFailed

- **Requirement:** REQ-CVJDMATCHINGWIZARD-15
- **Layer:** api · **Priority:** P1
- **Bước:** upload PDF giả (bytes chữ thường) và DOCX không có đoạn văn nào
- **Mong đợi:** 400 `documents.errors.parseFailed` cho cả hai
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-024 — DOCX trích ra hơn 2 000 000 ký tự trả parseFailed, không 5xx

- **Requirement:** REQ-CVJDMATCHINGWIZARD-16
- **Layer:** api · **Priority:** P2
- **Bước:** upload DOCX vài KB chứa > 2 000 000 ký tự văn bản
- **Mong đợi:** 400 `documents.errors.parseFailed`
- **Kiểm chứng thêm:** nhánh "parse quá 15 s" không dựng được file chắc chắn chậm qua HTTP — chỉ phủ nhánh trần ký tự
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-025 — text rỗng hoặc toàn khoảng trắng trả emptyText

- **Requirement:** REQ-CVJDMATCHINGWIZARD-17
- **Layer:** api · **Priority:** P1
- **Bước:** `POST /documents` JSON với `sourceText` `""`, `"  \n\t  "`, không có `sourceText`
- **Mong đợi:** 400 `documents.errors.emptyText`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-026 — sourceText 100 000 ký tự được nhận, 100 001 bị từ chối

- **Requirement:** REQ-CVJDMATCHINGWIZARD-17
- **Layer:** api · **Priority:** P2
- **Mong đợi:** 100 000 → 201 (rawText đủ 100 000); 100 001 → 400
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-027 — tạo tài liệu trả DocumentDto, tự đặt tiêu đề từ dòng đầu và cắt 80 ký tự

- **Requirement:** REQ-CVJDMATCHINGWIZARD-18
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** dán text bắt đầu bằng dòng trống; dán text dòng đầu 120 ký tự; dán text đúng 80 ký tự
- **Mong đợi:** 201, đúng 8 khoá DTO; `title` = dòng không rỗng đầu (đã trim), `rawText` đã trim, `sourceFormat: "text"`, `isSaved: false`, `parentId: null`; dòng 120 ký tự → 80 ký tự + "…"; đúng 80 ký tự → giữ nguyên
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-028 — upload PDF/DOCX giữ file gốc để xem trước

- **Requirement:** REQ-CVJDMATCHINGWIZARD-18
- **Layer:** api · **Priority:** P1
- **Bước:** upload `sample.pdf`, `sample.docx` → `GET /documents/:id/file`
- **Mong đợi:** 201 với `sourceFormat` `pdf` / `docx` và `rawText` không rỗng; file gốc 200 đúng content-type
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-029 — kind ngoài CV/JD bị từ chối

- **Requirement:** REQ-CVJDMATCHINGWIZARD-18
- **Layer:** api · **Priority:** P2
- **Bước:** `kind` = `XX`, `cv` (viết thường), `""`
- **Mong đợi:** 400
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-030 — lưu mà tiêu đề rỗng trả titleRequiredWhenSaving

- **Requirement:** REQ-CVJDMATCHINGWIZARD-20
- **Layer:** api · **Priority:** P1
- **Bước:** `save: true` không có `title`; `save: true`, `title: "   "`
- **Mong đợi:** 400 `documents.errors.titleRequiredWhenSaving`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-031 — tiêu đề 200 ký tự được nhận, 201 bị từ chối

- **Requirement:** REQ-CVJDMATCHINGWIZARD-20
- **Layer:** api · **Priority:** P2
- **Mong đợi:** 200 ký tự → 201 (`isSaved: true`, title giữ nguyên); 201 ký tự → 400
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-032 — lỗi validate tiêu đề quá dài trả message tiếng Việt khi request tiếng Việt

- **Requirement:** REQ-CVJDMATCHINGWIZARD-20, REQ-CVJDMATCHINGWIZARD-49
- **Layer:** api · **Priority:** P2
- **Bước:** `Accept-Language: vi`, `save: true`, title 201 ký tự
- **Mong đợi:** 400 với message tiếng Việt (không phải câu tiếng Anh thô của class-validator)
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-03](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-03)
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-033 — phiên khách không xem được danh sách tài liệu

- **Requirement:** REQ-CVJDMATCHINGWIZARD-23
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** phiên khách (`createGuestUser`)
- **Bước:** khách tạo tài liệu → `GET /documents?kind=JD&saved=true`
- **Mong đợi:** tạo 201; danh sách 401 `SIGN_IN_REQUIRED`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

### TC-CVJDMATCHINGWIZARD-034 — lỗi documents trả theo ngôn ngữ của request

- **Requirement:** REQ-CVJDMATCHINGWIZARD-49
- **Layer:** api · **Priority:** P2
- **Bước:** `emptyText` với `Accept-Language: vi`; `titleRequiredWhenSaving` với `?lang=vi`; `emptyText` với `en`
- **Mong đợi:** message đúng bản `vi` / `en` trong `server/src/i18n/<lng>/documents.json`
- **Automated:** `tests/api/cv-jd-matching-wizard/document-input.api.ts`

## Lưu để dùng lại & danh sách đã lưu

### TC-CVJDMATCHINGWIZARD-035 — modal lưu bắt nhập tên, lưu xong Next dùng luôn tài liệu vừa lưu

- **Requirement:** REQ-CVJDMATCHINGWIZARD-19
- **Layer:** e2e · **Priority:** P1
- **Bước:** chưa có input (không thấy nút lưu) → dán JD → `save.button` → Save khi tên rỗng → nhập tên → Save → Next
- **Mong đợi:** modal có mô tả và ô tên có nhãn; tên rỗng → `save.nameRequired`, modal vẫn mở, không request; lưu xong modal đóng và hiện `save.saved`; Next tới bước 2
- **Kiểm chứng thêm:** tổng cộng đúng 1 `POST /documents` (`save: true`, `title` = tên), Next không tạo bản thứ hai
- **Automated:** `tests/e2e/cv-jd-matching-wizard/saved-documents.e2e.ts`

### TC-CVJDMATCHINGWIZARD-036 — danh sách chọn lại chỉ có tài liệu đã lưu đúng loại của mình, mới nhất trước

- **Requirement:** REQ-CVJDMATCHINGWIZARD-21
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có JD đã lưu (cũ, mới, DOCX mới nhất), 1 JD tạm, 1 CV đã lưu; user khác có 1 JD đã lưu
- **Bước:** mở bước 1 → kiểm danh sách → sang bước 2
- **Mong đợi:** bước 1 đúng 3 radio theo thứ tự DOCX → mới → cũ, không có JD tạm / CV / JD của user khác; badge `format.text` / `format.docx` (không phải enum thô); bước 2 chỉ có CV đã lưu
- **Automated:** `tests/e2e/cv-jd-matching-wizard/saved-documents.e2e.ts`

### TC-CVJDMATCHINGWIZARD-037 — chọn tài liệu đã lưu rồi Next không tạo tài liệu mới

- **Requirement:** REQ-CVJDMATCHINGWIZARD-21
- **Layer:** e2e · **Priority:** P1
- **Bước:** chọn radio JD đã lưu → Next → dán CV → Next
- **Mong đợi:** bước 3 hiện đúng nội dung JD đã lưu
- **Kiểm chứng thêm:** bước 1 không gửi `POST /documents`; cả luồng chỉ 1 (của CV)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/saved-documents.e2e.ts`

### TC-CVJDMATCHINGWIZARD-038 — chưa lưu gì thì hiện empty state ở bước 1 và bước 2

- **Requirement:** REQ-CVJDMATCHINGWIZARD-22
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** bước 1 `reuse.empty.jd` + `reuse.empty.hint`, không có radiogroup; bước 2 `reuse.empty.cv` + hint
- **Automated:** `tests/e2e/cv-jd-matching-wizard/saved-documents.e2e.ts`

### TC-CVJDMATCHINGWIZARD-039 — không tải được danh sách thì báo lỗi thay vì empty state

- **Requirement:** REQ-CVJDMATCHINGWIZARD-22
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `GET /documents` bị chèn lỗi 500 (fault injection, decisions Q7)
- **Mong đợi:** có alert lỗi trong vùng nạp, không hiện `reuse.empty.jd`
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-04](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-04)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/saved-documents.e2e.ts`

### TC-CVJDMATCHINGWIZARD-040 — ngày của tài liệu đã lưu theo ngôn ngữ giao diện

- **Requirement:** REQ-CVJDMATCHINGWIZARD-50
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** dòng tài liệu chứa `createdAt.toLocaleDateString("en")`; sau khi chuyển `vi` chứa `toLocaleDateString("vi")`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/saved-documents.e2e.ts`

## Khách

### TC-CVJDMATCHINGWIZARD-041 — khách dùng được bước 1–2, thấy ghi chú khách, không thấy lưu và danh sách đã lưu

- **Requirement:** REQ-CVJDMATCHINGWIZARD-23
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** mở `/wizard` → dán JD → Next → dán CV → Next
- **Mong đợi:** `input.guestNote` có link đăng nhập `…/auth/login?returnTo=%2Fwizard`; không có `reuse.*`, radiogroup, empty state, nút lưu; tới được bước 3
- **Automated:** `tests/e2e/cv-jd-matching-wizard/guest.e2e.ts`

### TC-CVJDMATCHINGWIZARD-042 — khách thấy bên nhận nội dung CV/JD trước khi chạy

- **Requirement:** REQ-CVJDMATCHINGWIZARD-26
- **Layer:** e2e · **Priority:** P1
- **Bước:** khách đi tới bước 3
- **Mong đợi:** `credentials.runWith.privacyList` với "System key" hiện trước nút Run match
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-05](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-05)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/guest.e2e.ts`

### TC-CVJDMATCHINGWIZARD-043 — khách không thấy các hành động trên thẻ kết quả

- **Requirement:** REQ-CVJDMATCHINGWIZARD-43
- **Layer:** e2e · **Priority:** P2
- **Bước:** khách chạy tới bước 4 (stub)
- **Mong đợi:** có điểm; không có `action.improveCv`, `coverLetter.open`, `action.compareVersions`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/guest.e2e.ts`

## Bước 3 — Review

### TC-CVJDMATCHINGWIZARD-044 — bước 3 hiện hai tài liệu dán ở dạng chỉ đọc

- **Requirement:** REQ-CVJDMATCHINGWIZARD-24
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `wizard.stepReview.title` + mô tả; JD và CV hiện nguyên văn; không có textbox nào trong `<main>`; bước 1–2 `done`, bước 3 `aria-current`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

### TC-CVJDMATCHINGWIZARD-045 — bước 3 xem trước được bản gốc PDF

- **Requirement:** REQ-CVJDMATCHINGWIZARD-24
- **Layer:** e2e · **Priority:** P1
- **Bước:** upload `sample.pdf` ở bước 1 và 2
- **Mong đợi:** 2 canvas trong `pdf-preview`, không có `preview.error`, không có textbox
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

### TC-CVJDMATCHINGWIZARD-046 — tài liệu không còn thì bước 3 báo lỗi có lối thoát thay vì tải mãi

- **Requirement:** REQ-CVJDMATCHINGWIZARD-25
- **Layer:** e2e · **Priority:** P2
- **Bước:** dán JD → Next → xoá JD trong DB → dán CV → Next
- **Mong đợi:** alert lỗi + nút Back, không còn `review.loading`
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-06](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-06)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

### TC-CVJDMATCHINGWIZARD-047 — người đã đăng nhập thấy bên nhận nội dung CV/JD trước khi chạy

- **Requirement:** REQ-CVJDMATCHINGWIZARD-26
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** ở bước 3 hiện `credentials.runWith.privacyList` với "System key"
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

### TC-CVJDMATCHINGWIZARD-048 — user chưa có khoá AI mặc định chạy bằng key hệ thống

- **Requirement:** REQ-CVJDMATCHINGWIZARD-27
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user mới, không có AI credential
- **Mong đợi:** checkbox "System key" được chọn sẵn; nút `action.runMatch` bật
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

### TC-CVJDMATCHINGWIZARD-049 — Run match mở run rồi sang bước 4, bấm đúp chỉ mở một run và một lượt chấm

- **Requirement:** REQ-CVJDMATCHINGWIZARD-28
- **Layer:** e2e · **Priority:** P1
- **Bước:** bước 3 → double-click Run match
- **Mong đợi:** bước 4 đang chọn, có điểm
- **Kiểm chứng thêm:** đúng 1 `POST /match/runs` (đúng cặp CV/JD) và 1 `POST /match` (có `runId`, không có `credentialId`)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

### TC-CVJDMATCHINGWIZARD-050 — mở run lỗi thì báo lỗi inline và vẫn ở bước 3

- **Requirement:** REQ-CVJDMATCHINGWIZARD-28
- **Layer:** e2e · **Priority:** P2
- **Bước:** tới bước 3 → xoá CV trong DB → Run match
- **Mong đợi:** alert `matching.errors.documentNotOwned`, vẫn ở bước 3
- **Kiểm chứng thêm:** không có `POST /match`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/review.e2e.ts`

## Bước 4 — Báo cáo

### TC-CVJDMATCHINGWIZARD-051 — trong lúc chấm thẻ hiện skeleton có tiêu đề System key

- **Requirement:** REQ-CVJDMATCHINGWIZARD-40
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** stub `POST /match` trễ 3 s
- **Mong đợi:** thẻ `aria-busy="true"` chứa `credentials.systemKey`; vùng `aria-live="polite"` có mặt; xong thì hết skeleton, có điểm
- **Kiểm chứng thêm:** đang lệch — [BUG-CVJDMATCHINGWIZARD-07](../defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-07)
- **Automated:** `tests/e2e/cv-jd-matching-wizard/result.e2e.ts`

### TC-CVJDMATCHINGWIZARD-052 — kết quả thành công hiện tiêu đề provider, ba điểm phần trăm và báo cáo mở sẵn

- **Requirement:** REQ-CVJDMATCHINGWIZARD-41
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** tiêu đề `<label provider> · <chatModel>`; 3 nhãn điểm, meter `aria-valuenow` 82/90/70, chữ `82%` `90%` `70%`; 3 heading báo cáo và từng mục; không có `result.card.showReport`; không có JSON thô / số thập phân
- **Automated:** `tests/e2e/cv-jd-matching-wizard/result.e2e.ts`

### TC-CVJDMATCHINGWIZARD-053 — provider lỗi hiện đúng lý do và Try again chạy lại

- **Requirement:** REQ-CVJDMATCHINGWIZARD-42
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** lần chấm đầu trả `status: failed, errorCode: no_quota`, lần sau thành công
- **Mong đợi:** alert `result.error.no_quota`, chưa có điểm; Try again → có điểm, hết alert
- **Automated:** `tests/e2e/cv-jd-matching-wizard/result.e2e.ts`

### TC-CVJDMATCHINGWIZARD-054 — lỗi 503 hoặc mất mạng khi chấm hiện alert có Try again

- **Requirement:** REQ-CVJDMATCHINGWIZARD-42
- **Layer:** e2e · **Priority:** P2
- **Bước:** `POST /match` trả 503 (test 1) / bị abort (test 2)
- **Mong đợi:** alert + `action.tryAgain`, không còn skeleton
- **Automated:** `tests/e2e/cv-jd-matching-wizard/result.e2e.ts`

### TC-CVJDMATCHINGWIZARD-055 — user đăng nhập thấy Improve my CV và cover letter, không thấy so sánh khi CV không có bản trước

- **Requirement:** REQ-CVJDMATCHINGWIZARD-43
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** có `action.improveCv`, `coverLetter.open`; không có `action.compareVersions`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/result.e2e.ts`

### TC-CVJDMATCHINGWIZARD-056 — CV có phiên bản trước thì hiện Compare versions

- **Requirement:** REQ-CVJDMATCHINGWIZARD-43
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** CV v2 đã lưu, `parentId` = CV v1 (qua API)
- **Bước:** dán JD → chọn CV v2 → Run match (stub)
- **Mong đợi:** có `action.compareVersions`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/result.e2e.ts`

## Chấm điểm — API (trước provider)

### TC-CVJDMATCHINGWIZARD-057 — thiếu field hoặc id không phải UUID trả 400

- **Requirement:** REQ-CVJDMATCHINGWIZARD-32
- **Layer:** api · **Priority:** P1
- **Bước:** body `{}`, thiếu cv/jd, cv không phải UUID, `runId: "abc"`, `credentialId: "abc"`
- **Mong đợi:** 400
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-058 — tài liệu của user khác hoặc không tồn tại trả cùng documentNotOwned

- **Requirement:** REQ-CVJDMATCHINGWIZARD-32
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** CV của user khác; CV uuid không tồn tại; JD của user khác
- **Mong đợi:** 400 `matching.errors.documentNotOwned`; body của "của người khác" và "không tồn tại" giống hệt
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-059 — đảo kind CV/JD trả invalidDocumentKind

- **Requirement:** REQ-CVJDMATCHINGWIZARD-32
- **Layer:** api · **Priority:** P1
- **Mong đợi:** 400 `matching.errors.invalidDocumentKind`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-060 — runId lạ trả runNotFound, runId của cặp khác trả runDocumentMismatch

- **Requirement:** REQ-CVJDMATCHINGWIZARD-32
- **Layer:** api · **Priority:** P1
- **Mong đợi:** run uuid ngẫu nhiên / run của user khác → 404 `matching.errors.runNotFound`; run của mình nhưng cặp tài liệu khác → 400 `matching.errors.runDocumentMismatch`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-061 — mở run trả 201 không gọi AI và đọc lại được run rỗng

- **Requirement:** REQ-CVJDMATCHINGWIZARD-33
- **Layer:** api · **Priority:** P1
- **Mong đợi:** 201 `{id, cvDocumentId, jdDocumentId, createdAt}`; không có MatchResult nào cho run; `GET /match/runs/:id` 200 với `results: []`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-062 — mở run kiểm sở hữu và kind như POST /match

- **Requirement:** REQ-CVJDMATCHINGWIZARD-33
- **Layer:** api · **Priority:** P1
- **Mong đợi:** CV của người khác → 400 `documentNotOwned`; đảo kind → 400 `invalidDocumentKind`; thiếu field / id sai → 400
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-063 — run của user khác hoặc không tồn tại trả 404

- **Requirement:** REQ-CVJDMATCHINGWIZARD-33
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** 404 `matching.errors.runNotFound`; id không phải UUID → 400
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-064 — GET /match/:id trả kết quả của mình

- **Requirement:** REQ-CVJDMATCHINGWIZARD-34
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** MatchResult seed thẳng vào DB (70/75/63 + report)
- **Mong đợi:** 200 đúng id, cặp tài liệu, điểm, report, `credentialId: null`, `status: succeeded`, `errorCode: null`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-065 — kết quả của user khác hoặc không tồn tại trả matchNotFound, id sai định dạng trả 400

- **Requirement:** REQ-CVJDMATCHINGWIZARD-34
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** 404 `matching.errors.matchNotFound` cho cả hai; `not-a-uuid` → 400
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-066 — kết quả giữ provider/model của chính row và không lộ khoá AI

- **Requirement:** REQ-CVJDMATCHINGWIZARD-36
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** row seed với `provider: gemini`, model riêng
- **Mong đợi:** response trả đúng provider/chatModel/embedModel của row; không có `apiKey`, `encryptedKey`, `keyIv`, `keyTag`, chuỗi dạng khoá
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-067 — khách gửi credentialId bị 403, ẩn danh bị 401

- **Requirement:** REQ-CVJDMATCHINGWIZARD-37
- **Layer:** api · **Priority:** P1
- **Mong đợi:** khách + `credentialId` → 403 `GUEST_FORBIDDEN_CREDENTIAL` / `matching.errors.guestCredential` (không tốn quota); ẩn danh `POST /match` và `POST /match/runs` → 401 `SIGN_IN_REQUIRED`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-068 — lỗi trả về không lộ stack trace hay SQL

- **Requirement:** REQ-CVJDMATCHINGWIZARD-39
- **Layer:** api · **Priority:** P2
- **Bước:** id kiểu SQL injection, tài liệu người khác, match/run không tồn tại, id sai, ẩn danh
- **Mong đợi:** 4xx; body không có `stack`, khung stack, `prisma`, `SELECT`/`INSERT`, tên bảng trong ngoặc kép, `node_modules`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

### TC-CVJDMATCHINGWIZARD-069 — lỗi matching trả tiếng Việt khi request tiếng Việt

- **Requirement:** REQ-CVJDMATCHINGWIZARD-49
- **Layer:** api · **Priority:** P2
- **Mong đợi:** `documentNotOwned`, `invalidDocumentKind` (Accept-Language) và `matchNotFound` (`?lang=vi`) trả đúng bản `vi`
- **Automated:** `tests/api/cv-jd-matching-wizard/match-validation.api.ts`

## Chấm điểm — provider thật (@live-ai)

### TC-CVJDMATCHINGWIZARD-070 — chấm thật trả đúng hợp đồng, công thức điểm và đọc lại không đổi

- **Requirement:** REQ-CVJDMATCHINGWIZARD-29, REQ-CVJDMATCHINGWIZARD-30, REQ-CVJDMATCHINGWIZARD-44
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Bước:** tạo CV/JD tiếng Anh → mở run → `POST /match` (key hệ thống) → `GET /match/:id` → `GET /match/runs/:id`
- **Mong đợi:** 201 `status: succeeded`, đủ trường DTO, `credentialId: null`, `runId` đúng; 3 điểm nguyên 0–100; `overall = round(0.6 × semantic + 0.4 × keyword)`; keyword > 0; report là mảng chuỗi; đọc lại cùng điểm + report; run chứa đúng kết quả đó
- **Automated:** `tests/api/cv-jd-matching-wizard/live-scoring.api.ts`

### TC-CVJDMATCHINGWIZARD-071 — JD không dấu cho cùng keywordScore với JD có dấu

- **Requirement:** REQ-CVJDMATCHINGWIZARD-45
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Mong đợi:** cùng CV có dấu: keywordScore(JD có dấu) > 0 và bằng keywordScore(JD bỏ dấu, `đ` → `d`)
- **Automated:** `tests/api/cv-jd-matching-wizard/live-scoring.api.ts`

### TC-CVJDMATCHINGWIZARD-072 — cùng văn bản NFC và NFD cho cùng keywordScore

- **Requirement:** REQ-CVJDMATCHINGWIZARD-46
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Mong đợi:** keywordScore(JD NFC) > 0 và bằng keywordScore(JD NFD)
- **Automated:** `tests/api/cv-jd-matching-wizard/live-scoring.api.ts`

### TC-CVJDMATCHINGWIZARD-073 — chỉ 20 000 ký tự đầu được dùng để chấm

- **Requirement:** REQ-CVJDMATCHINGWIZARD-31
- **Layer:** api · **Priority:** P2
- **Mong đợi:** tài liệu > 20 000 ký tự vẫn chấm được; nội dung sau ký tự thứ 20 000 không ảnh hưởng điểm
- **Automated:** manual — chỉ quan sát được qua điểm của provider thật (D1 giới hạn @live-ai ở 3 test); `capForMatch` hiện chưa có unit test server — ghi ở Tech debt của decisions

### TC-CVJDMATCHINGWIZARD-074 — provider lỗi được lưu thành kết quả failed, thiếu key hệ thống trả 503

- **Requirement:** REQ-CVJDMATCHINGWIZARD-35
- **Layer:** api · **Priority:** P1
- **Mong đợi:** sai khoá / hết quota / model không có / timeout / không kết nối → 201 `status: failed` đúng `errorCode`, điểm 0, report rỗng, không lộ message provider; thiếu key hệ thống → 503 `ai.errors.notConfigured`
- **Automated:** manual — cần provider lỗi thật hoặc một server không có key hệ thống (D1 cấm chạm provider ngoài @live-ai; D5 chỉ dựng server riêng cho auth). Cách UI hiện từng lỗi đã phủ ở TC-053/054; engine giả lập lỗi có ở unit test server `matching.service.spec.ts`

### TC-CVJDMATCHINGWIZARD-075 — alias kỹ thuật được gộp, ký tự đặc biệt và từ ngắn tiếng Việt được giữ

- **Requirement:** REQ-CVJDMATCHINGWIZARD-47
- **Layer:** api · **Priority:** P2
- **Mong đợi:** `ReactJS` ≡ `React.js` ≡ `react`, `postgres` ≡ `postgresql`, `k8s` ≡ `kubernetes`; `C++`, `C#`, `Node.js` giữ nguyên; `ai`, `ma`, `nam` không là stopword
- **Automated:** manual — chỉ quan sát được qua keywordScore của `POST /match` (gọi embedding thật; D1 giới hạn @live-ai ở 3 test); phủ bởi `server/src/modules/matching/tokenizer.spec.ts`

### TC-CVJDMATCHINGWIZARD-076 — cặp tiếng Anh thuần không bị giảm điểm so với tokenizer cũ

- **Requirement:** REQ-CVJDMATCHINGWIZARD-48
- **Layer:** api · **Priority:** P2
- **Automated:** manual — tokenizer cũ không còn chạy được qua HTTP để so; tiêu chí đã kiểm lúc ship FR-11 (`docs/specs/vietnamese-document-support/design.md` §8) và bằng `tokenizer.spec.ts`

## i18n

### TC-CVJDMATCHINGWIZARD-077 — bước 1 hiển thị tiếng Việt và đổi lại tiếng Anh không kẹt

- **Requirement:** REQ-CVJDMATCHINGWIZARD-49
- **Layer:** e2e · **Priority:** P2
- **Bước:** mở bước 1 (en) → `setLanguage("vi")` → `setLanguage("en")`
- **Mong đợi:** heading, 4 nhãn stepper, empty state, Next, tab, dropzone hint đều bản `vi`; không lộ key thô; về `en` đúng bản `en`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/i18n.e2e.ts`

### TC-CVJDMATCHINGWIZARD-078 — nhãn báo cáo và lỗi provider ở bước 4 hiển thị tiếng Việt

- **Requirement:** REQ-CVJDMATCHINGWIZARD-49
- **Layer:** e2e · **Priority:** P2
- **Bước:** lần chấm đầu `failed/timeout` → chuyển `vi` → Try again (thành công)
- **Mong đợi:** `result.error.timeout` bản `vi`; nhãn điểm, heading báo cáo, `action.startOver` bản `vi`; không lộ `result.*`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/i18n.e2e.ts`

### TC-CVJDMATCHINGWIZARD-079 — lỗi file ở client hiển thị tiếng Việt

- **Requirement:** REQ-CVJDMATCHINGWIZARD-49
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** ở `vi`, `.exe` → `err.fileType` bản `vi`; PDF > 10 MB → `err.fileSize` bản `vi`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/i18n.e2e.ts`

## Accessibility

### TC-CVJDMATCHINGWIZARD-080 — Next, Back, Run match là button có tên và bước hiện tại có aria-current

- **Requirement:** REQ-CVJDMATCHINGWIZARD-51
- **Layer:** e2e · **Priority:** P2
- **Automated:** `tests/e2e/cv-jd-matching-wizard/accessibility.e2e.ts`

### TC-CVJDMATCHINGWIZARD-081 — danh sách đã lưu là radiogroup chọn được bằng bàn phím

- **Requirement:** REQ-CVJDMATCHINGWIZARD-51
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** 2 JD đã lưu
- **Bước:** focus radio đầu → Space → ArrowDown → focus Next → Enter
- **Mong đợi:** radiogroup với radio có nhãn là tiêu đề; Space chọn, ArrowDown chuyển lựa chọn; Enter trên Next tới bước 2
- **Automated:** `tests/e2e/cv-jd-matching-wizard/accessibility.e2e.ts`

### TC-CVJDMATCHINGWIZARD-082 — modal lưu có ô tên được gán nhãn và lưu được bằng Enter

- **Requirement:** REQ-CVJDMATCHINGWIZARD-51
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** Enter trên nút lưu mở modal, focus chuyển vào modal và Tab tới được ô `save.modal.nameLabel` (REQ-51 chỉ đòi thao tác được bằng bàn phím; antd đặt focus lên khung dialog, không lên ô); Enter khi rỗng → alert `save.nameRequired`; gõ tên + Enter → lưu, hiện `save.saved`
- **Automated:** `tests/e2e/cv-jd-matching-wizard/accessibility.e2e.ts`

### TC-CVJDMATCHINGWIZARD-083 — đi hết wizard bằng bàn phím: Next, Run match, Start over

- **Requirement:** REQ-CVJDMATCHINGWIZARD-51
- **Layer:** e2e · **Priority:** P2
- **Automated:** `tests/e2e/cv-jd-matching-wizard/accessibility.e2e.ts`

## Responsive

### TC-CVJDMATCHINGWIZARD-084 — bước 1 không scroll ngang và Next nằm trong viewport

- **Requirement:** REQ-CVJDMATCHINGWIZARD-52
- **Layer:** e2e · **Priority:** P1
- **Automated:** `tests/e2e/cv-jd-matching-wizard/responsive.e2e.ts`

### TC-CVJDMATCHINGWIZARD-085 — stepper chỉ render một lần, nhãn bước vẫn trong accessibility tree

- **Requirement:** REQ-CVJDMATCHINGWIZARD-52
- **Layer:** e2e · **Priority:** P2
- **Automated:** `tests/e2e/cv-jd-matching-wizard/responsive.e2e.ts`

### TC-CVJDMATCHINGWIZARD-086 — sang bước mới thì header bước nằm trong viewport

- **Requirement:** REQ-CVJDMATCHINGWIZARD-52
- **Layer:** e2e · **Priority:** P2
- **Bước:** dán JD → cuộn xuống đáy → Next
- **Mong đợi:** heading bước 2 và Next nằm trong viewport
- **Automated:** `tests/e2e/cv-jd-matching-wizard/responsive.e2e.ts`

### TC-CVJDMATCHINGWIZARD-087 — bước 3 không scroll ngang và Run match nằm trong viewport

- **Requirement:** REQ-CVJDMATCHINGWIZARD-52
- **Layer:** e2e · **Priority:** P1
- **Automated:** `tests/e2e/cv-jd-matching-wizard/responsive.e2e.ts`

### TC-CVJDMATCHINGWIZARD-088 — bước 4 vừa chiều ngang và Start over cuộn tới được

- **Requirement:** REQ-CVJDMATCHINGWIZARD-52
- **Layer:** e2e · **Priority:** P2
- **Automated:** `tests/e2e/cv-jd-matching-wizard/responsive.e2e.ts`

### TC-CVJDMATCHINGWIZARD-089 — nút footer cao ít nhất 44 px dưới 768 px

- **Requirement:** REQ-CVJDMATCHINGWIZARD-52
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** chỉ project `app-mobile` (390 px); project rộng hơn skip có lý do
- **Mong đợi:** Back và Next cao ≥ 44 px
- **Automated:** `tests/e2e/cv-jd-matching-wizard/responsive.e2e.ts`

## Luồng chính

### TC-CVJDMATCHINGWIZARD-090 — luồng chính dán JD, dán CV, review, chạy match tới kết quả không lỗi console hay 5xx

- **Requirement:** REQ-CVJDMATCHINGWIZARD-53
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** tới bước 4 với điểm và báo cáo; không có `console.error` / `pageerror`; không response ≥ 500
- **Automated:** `tests/e2e/cv-jd-matching-wizard/happy-path.e2e.ts`
