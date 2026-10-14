# COVERLETTERGENERATOR — Bug log

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-COVERLETTERGENERATOR-01](#bug-coverlettergenerator-01) | Trung bình | TC-COVERLETTERGENERATOR-038 | Thông báo quyền riêng tư với System key ghi "System key" thay vì OpenRouter |
| [BUG-COVERLETTERGENERATOR-02](#bug-coverlettergenerator-02) | Thấp | TC-COVERLETTERGENERATOR-047 | Dòng bản nháp không có thời điểm tạo; hai bản cùng tuỳ chọn không phân biệt được |
| [BUG-COVERLETTERGENERATOR-03](#bug-coverlettergenerator-03) | Thấp | TC-COVERLETTERGENERATOR-017 | `PATCH` nhận nội dung chỉ toàn khoảng trắng (200, lưu thư trắng) |
| [BUG-COVERLETTERGENERATOR-04](#bug-coverlettergenerator-04) | Thấp | TC-COVERLETTERGENERATOR-043 | "Try again" trên bản failed sinh với tuỳ chọn đang chọn, không phải của bản failed |
| [BUG-COVERLETTERGENERATOR-05](#bug-coverlettergenerator-05) | Trung bình | TC-COVERLETTERGENERATOR-041 | Bấm đúp Generate gửi 2 `POST /cover-letters` (2 lần gọi AI, 2 bản nháp) |
| [BUG-COVERLETTERGENERATOR-06](#bug-coverlettergenerator-06) | Thấp | TC-COVERLETTERGENERATOR-063 | `Esc` đóng dialog nhưng focus không trở về nút "Write cover letter" |

### BUG-COVERLETTERGENERATOR-01

- **TC:** TC-COVERLETTERGENERATOR-038 · **Requirement:** REQ-COVERLETTERGENERATOR-07
- **Bước tái hiện:** mở "Write cover letter" trên một match chạy bằng key hệ thống (hoặc chọn "System key" trong "Run with")
- **Mong đợi:** "Your CV and JD text will be sent to OpenRouter using the system key." (`credentials.runWith.privacySystem`,
  như trang CV rewrite) — NFR-DATA-05 đòi nêu đích danh bên nhận
- **Thực tế:** "Your CV and JD text will be sent to: System key." — `CoverLetterModal` dùng `privacyList` với
  `providers = t("credentials.systemKey")`

### BUG-COVERLETTERGENERATOR-02

- **TC:** TC-COVERLETTERGENERATOR-047 · **Requirement:** REQ-COVERLETTERGENERATOR-17
- **Bước tái hiện:** có hai bản nháp cùng Formal · Standard · English của một match → mở dialog
- **Mong đợi:** mỗi dòng có thời điểm tạo theo locale (design §6 vùng 3, §8 row 8; NFR-I18N-02/03)
- **Thực tế:** cả hai dòng chỉ ghi "Formal · Standard · English" (`describe()` không dùng `createdAt`)

### BUG-COVERLETTERGENERATOR-03

- **TC:** TC-COVERLETTERGENERATOR-017 · **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Bước tái hiện:** `PATCH /api/v1/cover-letters/<id>` `{ "content": "   " }` với phiên của chủ thư
- **Mong đợi:** 400, nội dung cũ giữ nguyên
- **Thực tế:** 200, thư bị ghi đè bằng khoảng trắng (`UpdateCoverLetterDto` `@Length(1, 20000)` không trim; chỉ UI chặn).
  Cùng dạng lỗi đã sửa ở cv-rewrite (security-report cv-rewrite #7)

### BUG-COVERLETTERGENERATOR-04

- **TC:** TC-COVERLETTERGENERATOR-043 · **Requirement:** REQ-COVERLETTERGENERATOR-19
- **Bước tái hiện:** có một bản failed Friendly · Short · Vietnamese → mở dialog (Segmented về mặc định) → "Try again"
- **Mong đợi:** request sinh lại mang `tone: friendly`, `length: short`, `language: vi` (tuỳ chọn của bản failed)
- **Thực tế:** request mang tuỳ chọn đang chọn trên Segmented (`formal` / `standard` / `en`): nút gọi `runGenerate()` với
  state hiện tại, mở một dòng cũ không đồng bộ lại Segmented

### BUG-COVERLETTERGENERATOR-05

- **TC:** TC-COVERLETTERGENERATOR-041 · **Requirement:** REQ-COVERLETTERGENERATOR-14
- **Bước tái hiện:** mở "Write cover letter" → bấm đúp "Generate" (provider trả chậm vài giây)
- **Mong đợi:** đúng **1** `POST /api/v1/cover-letters`, 1 bản nháp
- **Thực tế:** 2 `POST` cùng body (tái hiện 2/2 lượt chạy): `runGenerate()` gọi `mutateAsync` không chặn khi đang chạy;
  `loading={generateMutation.isPending}` chỉ đổi sau lần render kế tiếp nên cú bấm thứ hai vẫn lọt — tốn 2 lần gọi AI

### BUG-COVERLETTERGENERATOR-06

- **TC:** TC-COVERLETTERGENERATOR-063 · **Requirement:** REQ-COVERLETTERGENERATOR-29
- **Bước tái hiện:** bấm "Write cover letter" → dialog mở → nhấn `Esc`
- **Mong đợi:** dialog đóng, focus trở về nút "Write cover letter"
- **Thực tế:** dialog đóng, focus rơi về `body` (tái hiện 2/2 lượt chạy): `MatchResultCard` render
  `{letterOpen && <CoverLetterModal open … />}` nên `onClose` gỡ Modal ngay, antd không kịp trả focus (việc này chạy
  ở `afterClose`)

## Đã sửa

_(chưa có)_

Bug ghi ở `docs/specs/cover-letter-generator/e2e.md` cũ: không có (bản cũ 28/28 PASS, chỉ ghi "bẫy" của selector — đã
chuyển vào page object `pages/cover-letter-generator/cover-letter.page.ts`).
