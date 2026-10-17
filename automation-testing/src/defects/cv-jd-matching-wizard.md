# CVJDMATCHINGWIZARD — Bug log

Bug cũ: `docs/specs/cv-jd-matching-wizard/e2e.md` ghi rõ không có `e2e-bugs.md` và không có bug hành vi nào qua các
vòng gate A/B (mọi lần đỏ là lỗi test-infra đã sửa) — không có gì để chuyển. Các bug dưới đây phát hiện lúc viết
requirement (đối chiếu docs ↔ code, 2026-10-14) và được đánh dấu `test.fail()` ở spec; lượt chạy xác nhận chúng.

## Đang mở

_(không có)_

## Đã sửa

### BUG-CVJDMATCHINGWIZARD-01

- **TC:** TC-CVJDMATCHINGWIZARD-003 · **Requirement:** REQ-CVJDMATCHINGWIZARD-05
- **Bước tái hiện:** dán JD → Next → dán CV → Next (bước 3) → Back
- **Mong đợi:** bước 2 vẫn giữ CV đã nạp, Next bật, đi tiếp không phải nạp lại (`docs/specs/cv-jd-matching-wizard/design.md` §7 hàng 11 "back button giữ data", `docs/specs/wizard-responsive/design.md` §7 hàng 11)
- **Thực tế:** bước 2 hiện ô nạp trống, Next tắt; phải dán/tải lại (tạo thêm một tài liệu tạm). Store vẫn giữ `cvDocId`, nhưng `DocumentInputStep` mount lại với state cục bộ rỗng (`canSubmit = selectedSavedId !== null || hasNewInput`). Tương tự Back từ bước 2 về bước 1.
- **Đã sửa:** root cause — `DocumentInputStep` mount lại với state cục bộ rỗng và chỉ bật Next khi có input mới/radio, bỏ qua id đã nằm trong store. Fix — `StepJD`/`StepCV` truyền `currentDocId` từ store: Next bật và dùng lại tài liệu đó không gọi request, tài liệu đã lưu hiện là radio đang chọn, input mới vẫn thay thế (commit: 9689c03).

### BUG-CVJDMATCHINGWIZARD-02

- **TC:** TC-CVJDMATCHINGWIZARD-021 · **Requirement:** REQ-CVJDMATCHINGWIZARD-14
- **Bước tái hiện:** `POST /documents` multipart với DOCX hợp lệ đúng 10 485 760 byte
- **Mong đợi:** 201 — biên server khớp biên client (`client/src/constants/fileConstraints.ts` nhận `size ≤ 10 MB`; design.md §7 hàng 6 "=max accept")
- **Thực tế:** 400 `documents.errors.fileTooLarge`: `MaxFileSizeValidator` của Nest so `size < maxSize`. Người dùng chọn file đúng 10 MB thấy client chấp nhận rồi server báo "quá lớn".
- **Đã sửa:** root cause — `MaxFileSizeValidator` của Nest so `size < maxSize` (biên loại trừ) còn client nhận `≤ 10 MB`. Fix — tách pipe upload ra `documents/upload-file-pipe.ts` (có unit test biên) và đặt `maxSize = MAX_FILE_SIZE_BYTES + 1` (commit: 64f3530).

### BUG-CVJDMATCHINGWIZARD-03

- **TC:** TC-CVJDMATCHINGWIZARD-032 · **Requirement:** REQ-CVJDMATCHINGWIZARD-20, REQ-CVJDMATCHINGWIZARD-49
- **Bước tái hiện:** `POST /documents` với `Accept-Language: vi`, `save: true`, `title` 201 ký tự (tương tự `sourceText` 100 001 ký tự, `kind` sai)
- **Mong đợi:** 400 với message tiếng Việt (NFR-I18N-01: lỗi server trả theo ngôn ngữ của request)
- **Thực tế:** 400 với câu tiếng Anh thô của class-validator ("title must be shorter than or equal to 200 characters"), không qua i18n; wizard hiện nguyên văn câu này trong alert.
- **Đã sửa:** root cause — `CreateDocumentDto` dùng message mặc định tiếng Anh của class-validator, không qua i18n. Fix — `@IsEnum`/`@MaxLength` của `kind`/`title`/`sourceText` nhận message thunk `tDoc(...)` (pipe chạy trong I18nContext của request) với key mới `documents.errors.invalidKind|titleTooLong|textTooLong` en+vi (commit: 3254bf7).

### BUG-CVJDMATCHINGWIZARD-04

- **TC:** TC-CVJDMATCHINGWIZARD-039 · **Requirement:** REQ-CVJDMATCHINGWIZARD-22
- **Bước tái hiện:** mở `/wizard` khi `GET /documents?kind=JD&saved=true` lỗi (5xx / mất mạng)
- **Mong đợi:** báo lỗi tải danh sách (NFR-REL-03), không giả là chưa lưu gì
- **Thực tế:** `SavedDocRadioList` coi `!data` là rỗng → hiện "No saved job descriptions yet" + "Items you save will appear here." — người dùng tưởng mất tài liệu đã lưu.
- **Đã sửa:** root cause — `SavedDocRadioList` coi `!data` là rỗng nên query lỗi rơi vào empty state. Fix — query lỗi hiện `Alert` `role="alert"` với `reuse.loadError` + nút Try again (refetch), giống trang thư viện (commit: b2b266e).

### BUG-CVJDMATCHINGWIZARD-05

- **TC:** TC-CVJDMATCHINGWIZARD-042 · **Requirement:** REQ-CVJDMATCHINGWIZARD-26
- **Bước tái hiện:** không đăng nhập, dán JD → Next → dán CV → Next (bước 3)
- **Mong đợi:** trước nút Run match có câu nêu đích danh bên nhận nội dung (`credentials.runWith.privacyList` "Your CV and JD text will be sent to: System key."), như người đã đăng nhập (NFR-DATA-05, security-report Plan 2 must-fix #3, ux-copy §8)
- **Thực tế:** khách không thấy câu nào: `RunWithSelector` (nơi duy nhất render câu này) chỉ hiện khi `isUser`; `result.disclaimer` có trong locale nhưng không còn được dùng ở đâu. Nội dung CV của khách vẫn được gửi tới provider qua key hệ thống.
- **Đã sửa:** root cause — câu `credentials.runWith.privacyList` chỉ nằm trong `RunWithSelector`, mà bước 3 chỉ mount nó cho user. Fix — tách `RunPrivacyNotice`; `StepReview` hiện nó cho khách với "System key" (commit: 851bf90).
- **Cập nhật 2026-10-17:** user chốt cách nói mới (quyết định Q10, NFR-DATA-05) — khách thấy `credentials.runWith.privacySystem` ("…sent to OpenRouter using the system key."), không còn "System key"; xem BUG-MULTIPROVIDERCOMPARE-03.

### BUG-CVJDMATCHINGWIZARD-06

- **TC:** TC-CVJDMATCHINGWIZARD-046 · **Requirement:** REQ-CVJDMATCHINGWIZARD-25
- **Bước tái hiện:** dán JD → Next; tài liệu JD biến mất (vd tài liệu khách hết hạn, test xoá row) → dán CV → Next
- **Mong đợi:** bước 3 ra trạng thái lỗi có lối thoát (alert + Back) (NFR-REL-03)
- **Thực tế:** `GET /documents/:id` 404, nhưng `StepReview` tính `isLoadingDocs = … || !jdQuery.data` nên hiện "Loading document…" mãi, không alert, không nút Back.
- **Đã sửa:** root cause — `StepReview` tính `isLoadingDocs` gồm `!jdQuery.data`, nên query lỗi bị coi là đang tải. Fix — nhánh guard thiếu tài liệu nay bắt cả query lỗi, hiện `review.loadFailed` trong `role="alert"` kèm Back (commit: 1018810).

### BUG-CVJDMATCHINGWIZARD-07

- **TC:** TC-CVJDMATCHINGWIZARD-051 · **Requirement:** REQ-CVJDMATCHINGWIZARD-40
- **Bước tái hiện:** dán JD → Next → dán CV → Next → Run match, trong lúc `POST /match` chưa trả (stub trễ 3 s)
- **Mong đợi:** thẻ skeleton có `aria-busy="true"` (NFR-A11Y; `docs/specs/cv-jd-matching-wizard/design.md`), tiêu đề "System key"
- **Thực tế:** không phần tử nào trong `main` có `aria-busy="true"`. `MatchResultCard` render `<SectionCard title={title} aria-busy="true">`, nhưng `SectionCard` chỉ nhận các prop khai báo (title, eyebrow, …) và không chuyển thuộc tính thừa xuống `<div>`, nên `aria-busy` bị bỏ (TypeScript không bắt vì thuộc tính có gạch nối). Trình đọc màn hình không biết thẻ đang tải. Phát hiện ở lượt chạy 2026-10-14.
- **Đã sửa:** root cause — `SectionCard` không khai báo/chuyển `aria-busy` xuống `<div>` gốc. Fix — `SectionCard` nhận `aria-busy` và đặt lên thẻ card (sửa luôn skeleton của `RewriteReview`) (commit: 1585c8d).
