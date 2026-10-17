# COVERLETTERGENERATOR — Bug log

## Đang mở

_(không còn)_

## Đã sửa

Lượt sửa 2026-10-15 (branch `fix/open-bugs`): cả sáu bug đã sửa, `test.fail()` đã gỡ khỏi spec.

### BUG-COVERLETTERGENERATOR-01

- **TC:** TC-COVERLETTERGENERATOR-038 · **Requirement:** REQ-COVERLETTERGENERATOR-07
- **Bước tái hiện:** mở "Write cover letter" trên một match chạy bằng key hệ thống (hoặc chọn "System key" trong "Run with")
- **Mong đợi:** "Your CV and JD text will be sent to OpenRouter using the system key." (`credentials.runWith.privacySystem`,
  như trang CV rewrite) — NFR-DATA-05 đòi nêu đích danh bên nhận
- **Thực tế:** "Your CV and JD text will be sent to: System key." — `CoverLetterModal` dùng `privacyList` với
  `providers = t("credentials.systemKey")`
- **Đã sửa:** root cause — `CoverLetterModal` đưa `credentials.systemKey` vào `privacyList` thay vì nêu bên nhận. Fix — System key dùng `credentials.runWith.privacySystem` (như trang CV rewrite), credential riêng giữ `privacyList` với tên provider (commit: ffff943).

### BUG-COVERLETTERGENERATOR-02

- **TC:** TC-COVERLETTERGENERATOR-047 · **Requirement:** REQ-COVERLETTERGENERATOR-17
- **Bước tái hiện:** có hai bản nháp cùng Formal · Standard · English của một match → mở dialog
- **Mong đợi:** mỗi dòng có thời điểm tạo theo locale (design §6 vùng 3, §8 row 8; NFR-I18N-02/03)
- **Thực tế:** cả hai dòng chỉ ghi "Formal · Standard · English" (`describe()` không dùng `createdAt`)
- **Đã sửa:** root cause — dòng bản nháp chỉ render `describe()` (tone · length · language), không dùng `createdAt`. Fix — mỗi dòng thêm `<time>` format `createdAt` bằng `Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" })`; tên nút xoá giữ nguyên `Delete draft: <mô tả>` (commit: ffff943).

### BUG-COVERLETTERGENERATOR-03

- **TC:** TC-COVERLETTERGENERATOR-017 · **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Bước tái hiện:** `PATCH /api/v1/cover-letters/<id>` `{ "content": "   " }` với phiên của chủ thư
- **Mong đợi:** 400, nội dung cũ giữ nguyên
- **Thực tế:** 200, thư bị ghi đè bằng khoảng trắng (`UpdateCoverLetterDto` `@Length(1, 20000)` không trim; chỉ UI chặn).
  Cùng dạng lỗi đã sửa ở cv-rewrite (security-report cv-rewrite #7)
- **Đã sửa:** root cause — `UpdateCoverLetterDto.content` chỉ có `@Length(1, 20000)` trên chuỗi thô. Fix — thêm `@Matches(/\S/)` (không trim: thư lưu đúng như gõ), unit test `update-cover-letter.dto.spec.ts` (commit: 7b6be68).

### BUG-COVERLETTERGENERATOR-04

- **TC:** TC-COVERLETTERGENERATOR-043 · **Requirement:** REQ-COVERLETTERGENERATOR-19
- **Bước tái hiện:** có một bản failed Friendly · Short · Vietnamese → mở dialog (Segmented về mặc định) → "Try again"
- **Mong đợi:** request sinh lại mang `tone: friendly`, `length: short`, `language: vi` (tuỳ chọn của bản failed)
- **Thực tế:** request mang tuỳ chọn đang chọn trên Segmented (`formal` / `standard` / `en`): nút gọi `runGenerate()` với
  state hiện tại, mở một dòng cũ không đồng bộ lại Segmented
- **Đã sửa:** root cause — nút "Try again" gọi `runGenerate()` với state Segmented, mà mở một bản cũ không đồng bộ state đó. Fix — `runGenerate` nhận tuỳ chọn; "Try again" truyền tone / length / language của bản failed đang mở (commit: ffff943).

### BUG-COVERLETTERGENERATOR-05

- **TC:** TC-COVERLETTERGENERATOR-041 · **Requirement:** REQ-COVERLETTERGENERATOR-14
- **Bước tái hiện:** mở "Write cover letter" → bấm đúp "Generate" (provider trả chậm vài giây)
- **Mong đợi:** đúng **1** `POST /api/v1/cover-letters`, 1 bản nháp
- **Thực tế:** 2 `POST` cùng body (tái hiện 2/2 lượt chạy): `runGenerate()` gọi `mutateAsync` không chặn khi đang chạy;
  `loading={generateMutation.isPending}` chỉ đổi sau lần render kế tiếp nên cú bấm thứ hai vẫn lọt — tốn 2 lần gọi AI
- **Đã sửa:** root cause — `isPending` chỉ đổi ở lần render kế tiếp nên cú bấm thứ hai lọt qua. Fix — `runGenerate` giữ cờ in-flight đồng bộ bằng `useRef`, nhả khi request xong (commit: ffff943).

### BUG-COVERLETTERGENERATOR-06

- **TC:** TC-COVERLETTERGENERATOR-063 · **Requirement:** REQ-COVERLETTERGENERATOR-29
- **Bước tái hiện:** bấm "Write cover letter" → dialog mở → nhấn `Esc`
- **Mong đợi:** dialog đóng, focus trở về nút "Write cover letter"
- **Thực tế:** dialog đóng, focus rơi về `body` (tái hiện 2/2 lượt chạy): `MatchResultCard` render
  `{letterOpen && <CoverLetterModal open … />}` nên `onClose` gỡ Modal ngay, antd không kịp trả focus (việc này chạy
  ở `afterClose`)
- **Đã sửa:** root cause — `MatchResultCard` gỡ `CoverLetterModal` ngay khi `onClose`, nên `afterClose` của antd (nơi trả focus) không chạy. Fix — giữ dialog mounted tới `afterClose` (cờ `letterMounted` riêng, prop `afterClose` mới), `open` điều khiển prop `open` của Modal (commit: 6dd18da).

Bug ghi ở `docs/specs/cover-letter-generator/e2e.md` cũ: không có (bản cũ 28/28 PASS, chỉ ghi "bẫy" của selector — đã
chuyển vào page object `pages/cover-letter-generator/cover-letter.page.ts`).
