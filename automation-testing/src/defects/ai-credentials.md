# AICREDENTIALS — Bug log

## Đang mở

_(không có)_

## Đã sửa

### BUG-AICREDENTIALS-01

- **TC:** TC-AICREDENTIALS-070 · **Requirement:** REQ-AICREDENTIALS-17
- **Bước tái hiện:** `POST /api/v1/ai-credentials` `{ provider: "openrouter", label: "   ", apiKey: <20+ ký tự> }`; rồi label = 1 space + 60 ký tự + 1 space.
- **Mong đợi:** label được trim trước khi kiểm `1–60`: `"   "` → 400; label đệm → 201 với label 60 ký tự đã trim.
- **Thực tế:** `"   "` → 201, credential lưu với label `""` (một user chỉ có được một cái như vậy, cái thứ hai 409); label đệm → 400. `CreateAiCredentialDto` có `@Length(1, 60)` trên giá trị thô, `AiCredentialsService.create` trim sau đó. `UpdateAiCredentialDto` cùng lỗi.
- **Đã sửa:** root cause — `@Length(1, 60)` của `CreateAiCredentialDto`/`UpdateAiCredentialDto` chạy trên label thô, service mới trim. Fix — `@Transform(trimIfString)` trên `label` để rule thấy đúng giá trị sẽ lưu (commit: fe67497).

### BUG-AICREDENTIALS-02

- **TC:** TC-AICREDENTIALS-071 · **Requirement:** REQ-AICREDENTIALS-16
- **Bước tái hiện:** `/ai-credentials` → Add credential → Name `"   "`, API key hợp lệ → Save.
- **Mong đợi:** lỗi "This field is required" dưới Name, không request nào được gửi.
- **Thực tế:** rule `required` của antd coi `"   "` là có giá trị; form gửi `POST /ai-credentials` và (do BUG-AICREDENTIALS-01) tạo credential tên rỗng. `CredentialFormModal` thiếu `whitespace: true` cho Name.
- **Đã sửa:** root cause — rule `required` của Name thiếu `whitespace: true`. Fix — thêm `whitespace: true` (commit: 0a0ee35).

### BUG-AICREDENTIALS-03

- **TC:** TC-AICREDENTIALS-077 · **Requirement:** REQ-AICREDENTIALS-16
- **Bước tái hiện:** Add credential → Chat model 121 ký tự → Save.
- **Mong đợi:** bị chặn với thông báo nêu giới hạn 120 ký tự.
- **Thực tế:** bị chặn (đúng) nhưng thông báo là `credentials.form.labelTooLong` "Use at most 60 characters" — rule `max: MODEL_MAX` của hai ô model dùng chung message của Name. Cần key copy mới (vd "Use at most 120 characters").
- **Đã sửa:** root cause — rule `max: MODEL_MAX` của hai ô model dùng message `labelTooLong`. Fix — key mới `credentials.form.modelTooLong` ("Use at most 120 characters" / "Tối đa 120 ký tự") (commit: 0a0ee35).

### BUG-AICREDENTIALS-04

- **TC:** TC-AICREDENTIALS-059 · **Requirement:** REQ-AICREDENTIALS-41
- **Bước tái hiện:** `/ai-credentials` → bấm Add credential.
- **Mong đợi:** focus vào trường đầu tiên của form (Provider) — `design.md` §7 row 12.
- **Thực tế:** focus nằm ở phần tử bọc modal (`div tabindex=0`); người dùng bàn phím phải Tab thêm mới vào form. `Esc` đóng và trả focus về nút (đúng, TC-AICREDENTIALS-060).
- **Đã sửa:** root cause — rc-dialog focus vào wrapper khi mở. Fix — `afterOpenChange` đưa focus vào Provider (tạo) hoặc Name (sửa, Provider bị khoá) (commit: 0a0ee35).

### BUG-AICREDENTIALS-05

- **TC:** TC-AICREDENTIALS-062 · **Requirement:** REQ-AICREDENTIALS-41
- **Bước tái hiện:** wizard → dán JD, CV → step 3 → đọc cây accessibility của khối "Run with".
- **Mong đợi:** một `role="group"` tên "Run with" chứa các checkbox.
- **Thực tế:** `Checkbox.Group` nhận `aria-label` nhưng render `div` không có role, nên tên không được công nghệ hỗ trợ đọc (ARIA cấm đặt tên cho `generic`); các checkbox hiện như danh sách rời. `getByLabel("Run with")` vẫn tìm thấy div, nên test cũ báo đạt.
- **Đã sửa:** root cause — `Checkbox.Group` render `div` không role nên `aria-label` nằm trên phần tử `generic`. Fix — bọc nhóm trong `div role="group"` mang cùng nhãn (commit: 0bebfce).

### BUG-AICREDENTIALS-06

- **TC:** TC-AICREDENTIALS-087 · **Requirement:** REQ-AICREDENTIALS-42
- **Bước tái hiện:** viewport 390×844 cảm ứng → `/ai-credentials` có một credential → đo nút.
- **Mong đợi:** Add credential, Test, Edit, Delete đều ≥ 44×44 px (NFR-A11Y-03).
- **Thực tế:** Add credential ≈ 152×32; action dòng là `Button size="small"` (≈ 24 px cao). Đã ghi là nợ #7 trong `docs/04-state/backlog.md`.
- **Đã sửa:** root cause — Add credential là `Button` mặc định 32px, action dòng `size="small"` 24px. Fix — `!h-11` dưới `md`, giữ chiều cao gọn từ `md` (commit: f2ca322).

### BUG-AICREDENTIALS-09

- **TC:** TC-AICREDENTIALS-034 · **Requirement:** REQ-AICREDENTIALS-26
- **Bước tái hiện:** credential có kết quả kiểm tra `ok` (model để mặc định) → `/ai-credentials` → Edit → chỉ đổi Name → Save.
- **Mong đợi:** modal đóng, không kiểm tra lại, dòng tên mới vẫn "Tested OK" (chỉ đổi label giữ nguyên kết quả).
- **Thực tế:** modal đóng và không gọi `/test` (đúng), nhưng dòng hiện "Not tested". `CredentialFormModal` luôn gửi
  `chatModel: ""` / `embedModel: ""` trong `PATCH`; `AiCredentialsService.update` coi mọi field model có mặt (kể cả rỗng →
  `null`, không đổi gì) là "đổi model" và xoá `lastTestStatus`/`lastTestedAt`. API chỉ gửi `label` thì giữ đúng
  (TC-AICREDENTIALS-032), nên lỗi chỉ lộ qua UI.
- **Đã sửa:** root cause — `AiCredentialsService.update` coi mọi field model có mặt là "đổi model". Fix — so giá trị đã chuẩn hoá với giá trị đang lưu, chỉ field thật sự khác mới ghi và mới xoá kết quả kiểm tra (commit: 2ab532b).

### BUG-AICREDENTIALS-10

- **TC:** TC-AICREDENTIALS-085 · **Requirement:** REQ-AICREDENTIALS-22
- **Bước tái hiện:** `/ai-credentials` → Add credential → điền hợp lệ → double-click Save.
- **Mong đợi:** đúng một `POST /ai-credentials` (nút Save khoá ngay khi đang gửi).
- **Thực tế:** hai `POST` cùng body. `handleSubmit` chờ `form.validateFields()` (async) trước khi mutation bắt đầu, nên
  `pending` chưa bật khi click thứ hai tới. Chỉ một credential được lưu vì cái thứ hai đụng `@@unique([userId,label])` → 409,
  và nhánh 409 có thể gắn "You already have a credential with this name" vào ô Name của modal vừa lưu thành công.
- **Đã sửa:** root cause — `pending` chỉ bật sau khi `validateFields` xong và React render lại, click thứ hai lọt vào khoảng đó. Fix — ref khoá đồng bộ ngay click đầu, giữ tới khi lưu xong (commit: 0a0ee35).

### BUG-AICREDENTIALS-07

- **TC:** TC-AICREDENTIALS-028 · **Requirement:** REQ-AICREDENTIALS-25
- **Bước tái hiện:** sửa một credential từ modal để trống ô model (form gửi `chatModel: ""`).
- **Mong đợi:** 200, override bị xoá về `null`.
- **Thực tế (lúc phát hiện, 2026-08-08):** `chatModel`/`embedModel` validate `Length(1,120)` + không khoảng trắng → mọi lần Save từ modal sửa trả 400 và override đã lưu không xoá được. Đã sửa thành `Length(0,120)`, chuỗi rỗng = dùng mặc định. Gom từ `docs/specs/ai-credentials/e2e.md` ("Ba điều suite này phát hiện" #1).

### BUG-AICREDENTIALS-08

- **TC:** TC-AICREDENTIALS-005 · **Requirement:** REQ-AICREDENTIALS-06
- **Bước tái hiện:** mở `/ai-credentials`.
- **Mong đợi:** một heading "AI credentials" duy nhất.
- **Thực tế (lúc phát hiện, 2026-08-08):** h1 của trang và h2 của `SectionCard` cùng chữ "AI credentials". Đã bỏ title của card và chuyển ghi chú fallback xuống dưới danh sách. Gom từ `docs/specs/ai-credentials/e2e.md` (#2).

<!-- Mục #3 của "Ba điều suite này phát hiện" (câu INSERT thô thiếu cột trong home-dashboard-library/library.e2e.ts)
     là lỗi của code test, không phải của app: không ghi thành BUG. -->
