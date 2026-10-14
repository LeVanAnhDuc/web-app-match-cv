# CVJDMATCHINGWIZARD — Bug log

Bug cũ: `docs/specs/cv-jd-matching-wizard/e2e.md` ghi rõ không có `e2e-bugs.md` và không có bug hành vi nào qua các
vòng gate A/B (mọi lần đỏ là lỗi test-infra đã sửa) — không có gì để chuyển. Các bug dưới đây phát hiện lúc viết
requirement (đối chiếu docs ↔ code, 2026-10-14) và được đánh dấu `test.fail()` ở spec; lượt chạy xác nhận chúng.

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-CVJDMATCHINGWIZARD-01](#bug-cvjdmatchingwizard-01) | Trung bình | TC-CVJDMATCHINGWIZARD-003 | Back về bước trước làm mất tài liệu đã nạp, phải nạp lại mới đi tiếp được |
| [BUG-CVJDMATCHINGWIZARD-02](#bug-cvjdmatchingwizard-02) | Thấp | TC-CVJDMATCHINGWIZARD-021 | Server từ chối file đúng 10 485 760 byte mà client cho qua |
| [BUG-CVJDMATCHINGWIZARD-03](#bug-cvjdmatchingwizard-03) | Thấp | TC-CVJDMATCHINGWIZARD-032 | Lỗi validate DTO (title > 200, sourceText > 100 000, kind sai) trả câu tiếng Anh thô, không bản địa hoá |
| [BUG-CVJDMATCHINGWIZARD-04](#bug-cvjdmatchingwizard-04) | Thấp | TC-CVJDMATCHINGWIZARD-039 | Danh sách tài liệu đã lưu lỗi khi tải lại hiện empty state "chưa lưu gì" |
| [BUG-CVJDMATCHINGWIZARD-05](#bug-cvjdmatchingwizard-05) | Cao | TC-CVJDMATCHINGWIZARD-042 | Khách không được báo CV/JD sẽ gửi cho ai trước khi chạy match |
| [BUG-CVJDMATCHINGWIZARD-06](#bug-cvjdmatchingwizard-06) | Trung bình | TC-CVJDMATCHINGWIZARD-046 | Bước 3 quay "Loading document…" vô hạn khi tải tài liệu lỗi |
| [BUG-CVJDMATCHINGWIZARD-07](#bug-cvjdmatchingwizard-07) | Thấp | TC-CVJDMATCHINGWIZARD-051 | Thẻ kết quả đang chấm (skeleton) không có `aria-busy="true"` |

### BUG-CVJDMATCHINGWIZARD-01

- **TC:** TC-CVJDMATCHINGWIZARD-003 · **Requirement:** REQ-CVJDMATCHINGWIZARD-05
- **Bước tái hiện:** dán JD → Next → dán CV → Next (bước 3) → Back
- **Mong đợi:** bước 2 vẫn giữ CV đã nạp, Next bật, đi tiếp không phải nạp lại (`docs/specs/cv-jd-matching-wizard/design.md` §7 hàng 11 "back button giữ data", `docs/specs/wizard-responsive/design.md` §7 hàng 11)
- **Thực tế:** bước 2 hiện ô nạp trống, Next tắt; phải dán/tải lại (tạo thêm một tài liệu tạm). Store vẫn giữ `cvDocId`, nhưng `DocumentInputStep` mount lại với state cục bộ rỗng (`canSubmit = selectedSavedId !== null || hasNewInput`). Tương tự Back từ bước 2 về bước 1.

### BUG-CVJDMATCHINGWIZARD-02

- **TC:** TC-CVJDMATCHINGWIZARD-021 · **Requirement:** REQ-CVJDMATCHINGWIZARD-14
- **Bước tái hiện:** `POST /documents` multipart với DOCX hợp lệ đúng 10 485 760 byte
- **Mong đợi:** 201 — biên server khớp biên client (`client/src/constants/fileConstraints.ts` nhận `size ≤ 10 MB`; design.md §7 hàng 6 "=max accept")
- **Thực tế:** 400 `documents.errors.fileTooLarge`: `MaxFileSizeValidator` của Nest so `size < maxSize`. Người dùng chọn file đúng 10 MB thấy client chấp nhận rồi server báo "quá lớn".

### BUG-CVJDMATCHINGWIZARD-03

- **TC:** TC-CVJDMATCHINGWIZARD-032 · **Requirement:** REQ-CVJDMATCHINGWIZARD-20, REQ-CVJDMATCHINGWIZARD-49
- **Bước tái hiện:** `POST /documents` với `Accept-Language: vi`, `save: true`, `title` 201 ký tự (tương tự `sourceText` 100 001 ký tự, `kind` sai)
- **Mong đợi:** 400 với message tiếng Việt (NFR-I18N-01: lỗi server trả theo ngôn ngữ của request)
- **Thực tế:** 400 với câu tiếng Anh thô của class-validator ("title must be shorter than or equal to 200 characters"), không qua i18n; wizard hiện nguyên văn câu này trong alert.

### BUG-CVJDMATCHINGWIZARD-04

- **TC:** TC-CVJDMATCHINGWIZARD-039 · **Requirement:** REQ-CVJDMATCHINGWIZARD-22
- **Bước tái hiện:** mở `/wizard` khi `GET /documents?kind=JD&saved=true` lỗi (5xx / mất mạng)
- **Mong đợi:** báo lỗi tải danh sách (NFR-REL-03), không giả là chưa lưu gì
- **Thực tế:** `SavedDocRadioList` coi `!data` là rỗng → hiện "No saved job descriptions yet" + "Items you save will appear here." — người dùng tưởng mất tài liệu đã lưu.

### BUG-CVJDMATCHINGWIZARD-05

- **TC:** TC-CVJDMATCHINGWIZARD-042 · **Requirement:** REQ-CVJDMATCHINGWIZARD-26
- **Bước tái hiện:** không đăng nhập, dán JD → Next → dán CV → Next (bước 3)
- **Mong đợi:** trước nút Run match có câu nêu đích danh bên nhận nội dung (`credentials.runWith.privacyList` "Your CV and JD text will be sent to: System key."), như người đã đăng nhập (NFR-DATA-05, security-report Plan 2 must-fix #3, ux-copy §8)
- **Thực tế:** khách không thấy câu nào: `RunWithSelector` (nơi duy nhất render câu này) chỉ hiện khi `isUser`; `result.disclaimer` có trong locale nhưng không còn được dùng ở đâu. Nội dung CV của khách vẫn được gửi tới provider qua key hệ thống.

### BUG-CVJDMATCHINGWIZARD-06

- **TC:** TC-CVJDMATCHINGWIZARD-046 · **Requirement:** REQ-CVJDMATCHINGWIZARD-25
- **Bước tái hiện:** dán JD → Next; tài liệu JD biến mất (vd tài liệu khách hết hạn, test xoá row) → dán CV → Next
- **Mong đợi:** bước 3 ra trạng thái lỗi có lối thoát (alert + Back) (NFR-REL-03)
- **Thực tế:** `GET /documents/:id` 404, nhưng `StepReview` tính `isLoadingDocs = … || !jdQuery.data` nên hiện "Loading document…" mãi, không alert, không nút Back.

### BUG-CVJDMATCHINGWIZARD-07

- **TC:** TC-CVJDMATCHINGWIZARD-051 · **Requirement:** REQ-CVJDMATCHINGWIZARD-40
- **Bước tái hiện:** dán JD → Next → dán CV → Next → Run match, trong lúc `POST /match` chưa trả (stub trễ 3 s)
- **Mong đợi:** thẻ skeleton có `aria-busy="true"` (NFR-A11Y; `docs/specs/cv-jd-matching-wizard/design.md`), tiêu đề "System key"
- **Thực tế:** không phần tử nào trong `main` có `aria-busy="true"`. `MatchResultCard` render `<SectionCard title={title} aria-busy="true">`, nhưng `SectionCard` chỉ nhận các prop khai báo (title, eyebrow, …) và không chuyển thuộc tính thừa xuống `<div>`, nên `aria-busy` bị bỏ (TypeScript không bắt vì thuộc tính có gạch nối). Trình đọc màn hình không biết thẻ đang tải. Phát hiện ở lượt chạy 2026-10-14.

## Đã sửa

_(chưa có)_
