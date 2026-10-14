# MULTIPROVIDERCOMPARE — Bug log

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-MULTIPROVIDERCOMPARE-03](#bug-multiprovidercompare-03) | Trung bình | TC-MULTIPROVIDERCOMPARE-030 | Khách không được báo tài liệu sẽ gửi tới OpenRouter trước khi chạy |
| [BUG-MULTIPROVIDERCOMPARE-04](#bug-multiprovidercompare-04) | Thấp | TC-MULTIPROVIDERCOMPARE-028 | Thông báo quyền riêng tư ghi "System key" thay vì nêu OpenRouter |

### BUG-MULTIPROVIDERCOMPARE-03

- **TC:** TC-MULTIPROVIDERCOMPARE-030 · **Requirement:** REQ-MULTIPROVIDERCOMPARE-05
- **Bước tái hiện:** không đăng nhập → wizard, dán JD và CV → bước 3.
- **Mong đợi:** trước khi bấm Run match, khách thấy "Your CV and JD text will be sent to OpenRouter using the system key."
  (NFR-DATA-05).
- **Thực tế:** bước 3 của khách không có thông báo quyền riêng tư nào: `StepReview` chỉ vẽ `RunWithSelector` (nơi có
  thông báo) khi `isUser`, và câu `credentials.runWith.privacySystem` có sẵn trong locale nhưng không được dùng (Q6).
- **Chờ quyết định:** từ 851bf90 (BUG-CVJDMATCHINGWIZARD-05) khách đã thấy một câu, nhưng là `privacyList` "Your CV and JD text will be sent to: System key.", không phải câu `privacySystem` REQ này đòi. Mâu thuẫn với module cv-jd-matching-wizard: TC-CVJDMATCHINGWIZARD-042 (khách) và TC-CVJDMATCHINGWIZARD-047 (user, key hệ thống) đòi đúng câu `credentials.runWith.privacyList` với "System key" ("Your CV and JD text will be sent to: System key."), REQ-CVJDMATCHINGWIZARD-26 đòi khách thấy `privacyList`; sửa theo REQ này làm hai TC đó đỏ. Cần chốt một cách nói cho key hệ thống rồi cập nhật REQ/TC của module còn lại.

### BUG-MULTIPROVIDERCOMPARE-04

- **TC:** TC-MULTIPROVIDERCOMPARE-028 · **Requirement:** REQ-MULTIPROVIDERCOMPARE-04
- **Bước tái hiện:** đăng nhập, chưa có credential nào → wizard → bước 3 (key hệ thống được chọn sẵn).
- **Mong đợi:** thông báo quyền riêng tư nêu đích danh nhà cung cấp nhận tài liệu: OpenRouter.
- **Thực tế:** "Your CV and JD text will be sent to: System key." — "System key" không phải tên nhà cung cấp
  (`RunWithSelector` đẩy `t("credentials.systemKey")` vào danh sách, Q6).
- **Chờ quyết định:** mâu thuẫn với module cv-jd-matching-wizard: TC-CVJDMATCHINGWIZARD-042 (khách) và TC-CVJDMATCHINGWIZARD-047 (user, key hệ thống) đòi đúng câu `credentials.runWith.privacyList` với "System key" ("Your CV and JD text will be sent to: System key."), REQ-CVJDMATCHINGWIZARD-26 đòi khách thấy `privacyList`; sửa theo REQ này làm hai TC đó đỏ. Cần chốt một cách nói cho key hệ thống rồi cập nhật REQ/TC của module còn lại.

## Đã sửa

Ba lỗi suite cũ bắt được trước khi gom về đây (`docs/specs/multi-provider-compare/e2e.md`, 2026-08-08), đã sửa trong app
trước lượt này; các case tương ứng đang xanh nên không cần mục BUG riêng:

- Card kẹt vĩnh viễn ở skeleton (`mutate` không gọi callback) — sửa bằng `mutateAsync`; nay phủ bởi TC-MULTIPROVIDERCOMPARE-031, TC-MULTIPROVIDERCOMPARE-037.
- Không bỏ chọn hết được (effect tự chọn lại mặc định) — sửa bằng seed một lần; nay phủ bởi TC-MULTIPROVIDERCOMPARE-025.
- `db-cleanup` vỡ vì `MatchRun → Document` RESTRICT — lỗi của bộ test cũ, không phải của app; bộ test mới xoá dữ liệu
  theo user (cascade) nên không còn áp dụng.

### BUG-MULTIPROVIDERCOMPARE-01

- **TC:** TC-MULTIPROVIDERCOMPARE-038 · **Requirement:** REQ-MULTIPROVIDERCOMPARE-11, REQ-MULTIPROVIDERCOMPARE-32
- **Bước tái hiện:** đăng nhập → wizard, dán JD và CV → Run match với provider phản hồi chậm → xem phần tử gốc của card khi
  còn skeleton.
- **Mong đợi:** card đang chạy có `aria-busy="true"`.
- **Thực tế:** không có thuộc tính `aria-busy`. `MatchResultCard` truyền `aria-busy="true"` cho `SectionCard`, nhưng
  `SectionCard` chỉ lấy các prop đã khai báo và không chuyển phần còn lại xuống `div`, nên thuộc tính bị bỏ
  (`client/src/components/SectionCard/index.tsx`).
- **Đã sửa:** root cause — `SectionCard` không khai báo `aria-busy` nên bỏ thuộc tính này. Fix — `SectionCard` nhận `aria-busy` và đặt lên `div` gốc của card; sửa chung với BUG-CVJDMATCHINGWIZARD-07 (commit: 1585c8d).

### BUG-MULTIPROVIDERCOMPARE-02

- **TC:** TC-MULTIPROVIDERCOMPARE-046 · **Requirement:** REQ-MULTIPROVIDERCOMPARE-20
- **Bước tái hiện:** chọn một credential và key hệ thống → Run match; `POST /match` của credential trả 404
  `{ message: "Credential not found." }` (vd credential vừa bị xoá ở tab khác).
- **Mong đợi:** card đó hiện "Credential not found." kèm Try again; "Could not reach the provider." chỉ dành cho lỗi mạng.
- **Thực tế:** mọi lỗi HTTP (400 / 404 / 429 / 503 / 500) rơi vào `catch` của `fire()` và hiện
  `result.error.unreachable` "Could not reach the provider." (`MatchResultCard`, Q3).
- **Đã sửa:** root cause — `catch` của `fire()` trong `MatchResultCard` không phân biệt `ApiError` với lỗi mạng nên mọi lỗi thành `result.error.unreachable`. Fix — lỗi HTTP (`ApiError`) hiện message của server, "Could not reach the provider." chỉ khi request không có phản hồi (commit: 35bc2d7).

### BUG-MULTIPROVIDERCOMPARE-05

- **TC:** TC-MULTIPROVIDERCOMPARE-024 · **Requirement:** REQ-MULTIPROVIDERCOMPARE-01
- **Bước tái hiện:** đăng nhập → wizard → bước 3 → kiểm cây accessibility của danh sách "Run with".
- **Mong đợi:** danh sách checkbox là `role="group"` có tên "Run with" / "Chạy bằng".
- **Thực tế:** antd `Checkbox.Group` render một `div` không có `role`; `aria-label="Run with"` đặt trên `div` không role
  không được công bố, nên trình đọc màn hình không đọc tên nhóm (Q8).
- **Đã sửa:** root cause — `Checkbox.Group` render `div` không role nên `aria-label` không được công bố. Fix — bọc nhóm trong `div role="group"` mang nhãn "Run with"; sửa chung với BUG-AICREDENTIALS-05 (commit: 0bebfce).

### BUG-MULTIPROVIDERCOMPARE-06

- **TC:** TC-MULTIPROVIDERCOMPARE-035 · **Requirement:** REQ-MULTIPROVIDERCOMPARE-09
- **Bước tái hiện:** đăng nhập, có một credential Gemini → wizard, dán JD và CV → bước 3: bỏ chọn hết, tick System key
  trước rồi tick credential → Run match.
- **Mong đợi:** card theo thứ tự dòng trong danh sách: card 1 là credential Gemini, card 2 là key hệ thống.
- **Thực tế:** card theo thứ tự bấm: key hệ thống đứng trước. antd `Checkbox.Group` chỉ sắp `onChange` theo prop
  `options`; `RunWithSelector` truyền `Checkbox` con nên `options` rỗng, giá trị giữ thứ tự bấm, và `StepReview` /
  store không sắp lại (`client/src/views/Wizard/components/RunWithSelector/index.tsx`). Tiền đề của Q10 ("antd sắp theo
  thứ tự option") không đúng với cách dùng hiện tại.
- **Đã sửa:** root cause — `Checkbox.Group` chỉ sắp `onChange` theo prop `options` (rỗng vì dùng `Checkbox` con) nên giá trị giữ thứ tự bấm. Fix — effect đối soát của `RunWithSelector` ghi lại lựa chọn theo thứ tự dòng (credential rồi key hệ thống) (commit: 62128ab).
