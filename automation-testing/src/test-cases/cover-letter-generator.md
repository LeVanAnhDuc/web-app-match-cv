# COVERLETTERGENERATOR — Test case

Requirement: `docs/requirements/cover-letter-generator.md` · Quyết định: `docs/decisions/cover-letter-generator.md`.
Xếp theo 6 lăng kính (CLAUDE.md), mỗi case nằm ở lăng kính chính của nó. UI: `POST /cover-letters` (gọi AI) luôn stub
(D1); dữ liệu seed thẳng vào DB, mở bằng `/wizard?runId=`. API: chỉ nhánh trước provider, trừ 3 case `@live-ai`.

## 1. Truy vết requirement

### TC-COVERLETTERGENERATOR-030 — a succeeded result card opens the cover letter dialog

- **Requirement:** REQ-COVERLETTERGENERATOR-01
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user e2e có một run với match `succeeded`
- **Bước:** mở `/wizard?runId=<run>` → bấm "Write cover letter"
- **Mong đợi:** dialog "Cover letter" mở, nút Generate bật
- **Automated:** `tests/e2e/cover-letter-generator/entry.e2e.ts`

### TC-COVERLETTERGENERATOR-039 — generating puts the letter in the editor and saves it to the list

- **Requirement:** REQ-COVERLETTERGENERATOR-10, REQ-COVERLETTERGENERATOR-17
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** match `succeeded`, chưa có thư; stub `POST /cover-letters` trả thư `LETTER_BODY`
- **Bước:** mở dialog → Generate → mở lại trang và dialog
- **Mong đợi:** ô "Draft" chứa thư; danh sách có 1 dòng "Formal · Standard · English", empty state biến mất; sau khi
  mở lại trang thư vẫn còn (tự lưu, không cần Save)
- **Automated:** `tests/e2e/cover-letter-generator/generate.e2e.ts`

### TC-COVERLETTERGENERATOR-034 — the dialog opens with formal, standard and English selected in labelled groups

- **Requirement:** REQ-COVERLETTERGENERATOR-04
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở dialog
- **Mong đợi:** 3 group có tên Tone / Length / Letter language; chọn sẵn Formal, Standard, English
- **Automated:** `tests/e2e/cover-letter-generator/options.e2e.ts`

### TC-COVERLETTERGENERATOR-036 — run with defaults to the match's credential, and the system key sends no credentialId

- **Requirement:** REQ-COVERLETTERGENERATOR-06
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user e2e có credential `<label>` (4 ký tự cuối `1234`); match chạy bằng credential đó
- **Bước:** mở dialog → Generate → mở "Run with" → chọn System key → Generate
- **Mong đợi:** "Run with" hiện `OpenRouter · <label> · ••••1234`; dropdown có option đó và "System key"; request 1 có
  `credentialId` của credential, request 2 không có field `credentialId`; danh sách có 2 dòng
- **Automated:** `tests/e2e/cover-letter-generator/options.e2e.ts`

### TC-COVERLETTERGENERATOR-037 — the privacy note names the provider of the chosen credential

- **Requirement:** REQ-COVERLETTERGENERATOR-07
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** match chạy bằng credential OpenRouter của user
- **Bước:** mở dialog
- **Mong đợi:** câu `credentials.runWith.privacyList` với `providers = OpenRouter`
- **Automated:** `tests/e2e/cover-letter-generator/options.e2e.ts`

### TC-COVERLETTERGENERATOR-040 — a second draft does not replace the first, and each row reopens its own text

- **Requirement:** REQ-COVERLETTERGENERATOR-18
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** một thư Formal · Standard · English (`LETTER_BODY`); stub trả `SECOND_LETTER_BODY`
- **Bước:** chọn Friendly / Short / Vietnamese → Generate → bấm dòng cũ → bấm dòng mới
- **Mong đợi:** 2 dòng, mới nhất ở trên; ô soạn đổi đúng nội dung của từng dòng; bản 1 không bị ghi đè
- **Automated:** `tests/e2e/cover-letter-generator/generate.e2e.ts`

### TC-COVERLETTERGENERATOR-046 — rows read as human labels with edited and failed tags, and the newest is open

- **Requirement:** REQ-COVERLETTERGENERATOR-17
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 3 thư: cũ nhất edited, giữa failed (friendly/short/vi), mới nhất formal/short/en
- **Bước:** mở dialog → bấm dòng cũ nhất
- **Mong đợi:** 3 dòng theo `createdAt` giảm dần với nhãn người đọc (không có `friendly · short · vi` thô); tag "Failed"
  đúng dòng failed, "Edited" đúng dòng edited; bản mới nhất được nạp và có `aria-current="true"`; bấm dòng khác thì
  `aria-current` chuyển theo
- **Automated:** `tests/e2e/cover-letter-generator/drafts.e2e.ts`

### TC-COVERLETTERGENERATOR-047 — each row shows when the draft was generated, so drafts with the same options can be told apart

- **Requirement:** REQ-COVERLETTERGENERATOR-17
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** 2 thư cùng Formal · Standard · English, tạo cách nhau 26 giờ
- **Bước:** mở dialog
- **Mong đợi:** text hai dòng khác nhau và có thời điểm (chữ số) — đã sửa: [BUG-COVERLETTERGENERATOR-02](../defects/cover-letter-generator.md#bug-coverlettergenerator-02)
- **Automated:** `tests/e2e/cover-letter-generator/drafts.e2e.ts`

### TC-COVERLETTERGENERATOR-048 — the requirements a letter does not claim are listed, and the block is hidden when there are none

- **Requirement:** REQ-COVERLETTERGENERATOR-15
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** thư mới nhất có `omittedRequirements = [Kubernetes, Team leadership]`, thư cũ hơn rỗng
- **Bước:** mở dialog → bấm dòng thư cũ
- **Mong đợi:** khối "This letter does not claim" + gợi ý + đủ 2 mục; với thư rỗng khối ẩn hẳn
- **Automated:** `tests/e2e/cover-letter-generator/drafts.e2e.ts`

### TC-COVERLETTERGENERATOR-051 — an edited draft is saved, tagged edited and comes back after a reload

- **Requirement:** REQ-COVERLETTERGENERATOR-21, REQ-COVERLETTERGENERATOR-22
- **Layer:** e2e · **Priority:** P1
- **Bước:** sửa ô soạn → "Save changes" → mở lại trang và dialog
- **Mong đợi:** tag "Edited" hiện, Save tắt lại; row trong DB có nội dung mới; sau khi mở lại vẫn là nội dung đã sửa
- **Kiểm chứng thêm:** `PATCH` thật (không stub)
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-055 — copy puts the text on screen on the clipboard

- **Requirement:** REQ-COVERLETTERGENERATOR-24
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** quyền clipboard-read/write cho origin web
- **Bước:** sửa ô soạn (chưa lưu) → Copy
- **Mong đợi:** clipboard chứa đúng text đang hiển thị; không có alert lỗi
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-057 — download saves cover-letter-<id>.txt with the text on screen

- **Requirement:** REQ-COVERLETTERGENERATOR-24
- **Layer:** e2e · **Priority:** P1
- **Bước:** sửa ô soạn → "Download .txt"
- **Mong đợi:** file `cover-letter-<id>.txt` chứa đúng text đang soạn
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-058 — deleting another draft keeps the open one, without asking for confirmation

- **Requirement:** REQ-COVERLETTERGENERATOR-25
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 2 thư; bản mới nhất đang mở và có sửa chưa lưu
- **Bước:** xoá dòng còn lại
- **Mong đợi:** không có dialog xác nhận; dòng biến mất, row bị xoá trong DB; bản đang mở giữ nguyên text và `aria-current`
- **Automated:** `tests/e2e/cover-letter-generator/delete.e2e.ts`

### TC-COVERLETTERGENERATOR-013 — lists only the letters of the requested match, newest first

- **Requirement:** REQ-COVERLETTERGENERATOR-16
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** 3 thư của match A (cách nhau 10 s, 1 failed) + 1 thư của match B cùng user
- **Bước:** `GET /cover-letters?matchResultId=A`
- **Mong đợi:** 200, đúng 3 id theo `createdAt` giảm dần, không có thư của B
- **Automated:** `tests/api/cover-letter-generator/list.api.ts`

### TC-COVERLETTERGENERATOR-015 — an edit replaces the content and marks the letter edited

- **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Layer:** api · **Priority:** P1
- **Bước:** `PATCH /cover-letters/:id { content }` → `GET` danh sách
- **Mong đợi:** 200, `content` mới, `edited: true`; danh sách trả cùng giá trị
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-021 — deleting a letter answers 204 and removes only that letter

- **Requirement:** REQ-COVERLETTERGENERATOR-25
- **Layer:** api · **Priority:** P1
- **Bước:** seed 2 thư → `DELETE` một → `GET` → `DELETE` lại
- **Mong đợi:** 204; danh sách còn thư kia; lần xoá thứ hai 404
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-027 — a system-key generation answers 201 with the stored letter contract

- **Requirement:** REQ-COVERLETTERGENERATOR-10
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`, dev server có `OPENROUTER_API_KEY`
- **Bước:** `POST /cover-letters` (formal / short / en, không credential) → `GET` danh sách
- **Mong đợi:** 201 với đủ field của `CoverLetterDto`, `status: succeeded`, `errorCode: null`, `edited: false`,
  `credentialId: null`, `provider: openrouter`, `content` không rỗng ≤ 20 000, không field key; thư đứng đầu danh sách
- **Automated:** `tests/api/cover-letter-generator/live-generation.api.ts`

## 2. Phân vùng tương đương

### TC-COVERLETTERGENERATOR-031 — a failed result card offers no cover letter

- **Requirement:** REQ-COVERLETTERGENERATOR-01
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** run có match `failed` (`no_quota`)
- **Mong đợi:** card hiện lỗi đã dịch, không có nút "Write cover letter"
- **Automated:** `tests/e2e/cover-letter-generator/entry.e2e.ts`

### TC-COVERLETTERGENERATOR-033 — a guest's result card offers no cover letter

- **Requirement:** REQ-COVERLETTERGENERATOR-01
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** khách có run `succeeded`; trình duyệt mang cookie của khách
- **Mong đợi:** card hiện điểm, không có nút "Write cover letter"
- **Automated:** `tests/e2e/cover-letter-generator/entry.e2e.ts`

### TC-COVERLETTERGENERATOR-035 — the chosen options are sent, and switching the UI language leaves the letter language alone

- **Requirement:** REQ-COVERLETTERGENERATOR-04, REQ-COVERLETTERGENERATOR-05
- **Layer:** e2e · **Priority:** P1
- **Bước:** chọn Friendly / Short / Vietnamese → đổi UI sang vi → chọn letter language English → đổi UI về en → Generate
- **Mong đợi:** sau khi đổi UI các lựa chọn giữ nguyên (nhãn tiếng Việt); request có `tone: friendly`, `length: short`,
  `language: en`
- **Automated:** `tests/e2e/cover-letter-generator/options.e2e.ts`

### TC-COVERLETTERGENERATOR-042 — a provider failure shows a translated error with try again, not an empty letter

- **Requirement:** REQ-COVERLETTERGENERATOR-19, REQ-COVERLETTERGENERATOR-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** stub trả row failed `no_quota`
- **Bước:** Generate
- **Mong đợi:** alert `result.error.no_quota` + "Try again"; không ô soạn / Copy / Save; không hiện `no_quota` thô; dòng
  mới có tag "Failed"
- **Automated:** `tests/e2e/cover-letter-generator/generate.e2e.ts`

### TC-COVERLETTERGENERATOR-049 — every failure code reads as a translated message, never a raw code or null

- **Requirement:** REQ-COVERLETTERGENERATOR-19
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** 5 thư failed (đủ 5 mã) + 1 thư thành công (cũ nhất)
- **Bước:** bấm lần lượt từng dòng
- **Mong đợi:** mỗi mã hiện đúng câu `result.error.<code>`, không mã thô; thư thành công không có alert, không chữ "null"
- **Automated:** `tests/e2e/cover-letter-generator/drafts.e2e.ts`

### TC-COVERLETTERGENERATOR-053 — the letter is plain text: markup is shown as typed

- **Requirement:** REQ-COVERLETTERGENERATOR-21
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** thư `**not bold** and <b>not html</b>`
- **Mong đợi:** ô soạn giữ nguyên văn; dialog không có phần tử `<b>` / `<strong>`
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-044 — a rejected generate request says so and adds no draft

- **Requirement:** REQ-COVERLETTERGENERATOR-11
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** stub `POST /cover-letters` trả 503 (thiếu cấu hình hệ thống), không ghi row
- **Bước:** Generate
- **Mong đợi:** alert `coverLetter.err.generate`; vẫn empty state, 0 dòng
- **Automated:** `tests/e2e/cover-letter-generator/generate.e2e.ts`

### TC-COVERLETTERGENERATOR-007 — a missing tone, length or language is rejected with 400

- **Requirement:** REQ-COVERLETTERGENERATOR-08
- **Layer:** api · **Priority:** P1
- **Bước:** `POST` lên match `succeeded`, lần lượt thiếu `tone`, `length`, `language`
- **Mong đợi:** 400, message nhắc đúng field; không row nào được tạo (server không có mặc định ngầm)
- **Automated:** `tests/api/cover-letter-generator/generate-validation.api.ts`

### TC-COVERLETTERGENERATOR-008 — a tone, length or language outside its enum is rejected with 400

- **Requirement:** REQ-COVERLETTERGENERATOR-08
- **Layer:** api · **Priority:** P1
- **Bước:** `tone: sarcastic | Formal`, `length: long | ""`, `language: fr | EN`
- **Mong đợi:** 400 cho từng giá trị; không row
- **Automated:** `tests/api/cover-letter-generator/generate-validation.api.ts`

### TC-COVERLETTERGENERATOR-010 — a failed match is rejected with 400 matchNotSucceeded and writes nothing

- **Requirement:** REQ-COVERLETTERGENERATOR-09
- **Layer:** api · **Priority:** P1
- **Mong đợi:** 400 `coverLetters.errors.matchNotSucceeded`; không row
- **Automated:** `tests/api/cover-letter-generator/generate-validation.api.ts`

### TC-COVERLETTERGENERATOR-012 — an unknown credential on an owned succeeded match is 404 and writes nothing

- **Requirement:** REQ-COVERLETTERGENERATOR-03
- **Layer:** api · **Priority:** P2
- **Bước:** `credentialId` = UUID ngẫu nhiên
- **Mong đợi:** 404, không row, không gọi AI
- **Automated:** `tests/api/cover-letter-generator/generate-validation.api.ts`

### TC-COVERLETTERGENERATOR-019 — only content is editable: tone, length, language and status in the body are ignored

- **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Layer:** api · **Priority:** P2
- **Bước:** `PATCH { content, tone, length, language, status, edited: false }`
- **Mong đợi:** 200; trong DB chỉ `content` đổi, `edited: true`, tone/length/language/status giữ nguyên
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-028 — a Vietnamese letter is written in Vietnamese whatever the request language

- **Requirement:** REQ-COVERLETTERGENERATOR-05, REQ-COVERLETTERGENERATOR-10
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Bước:** `Accept-Language: en`, `POST { language: vi, tone: friendly, length: short }`
- **Mong đợi:** 201 `succeeded`, `language: vi`, nội dung có dấu tiếng Việt
- **Automated:** `tests/api/cover-letter-generator/live-generation.api.ts`

## 3. Giá trị biên

### TC-COVERLETTERGENERATOR-016 — content length boundaries: 0 and 20001 rejected, 1 and 20000 accepted

- **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Layer:** api · **Priority:** P1
- **Bước:** `PATCH` với 0, 1, 20 000, 20 001 ký tự
- **Mong đợi:** 400, 200, 200, 400; DB giữ bản 20 000
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-052 — save is enabled only for a changed, non-blank draft and the editor holds at most 20000 characters

- **Requirement:** REQ-COVERLETTERGENERATOR-21
- **Layer:** e2e · **Priority:** P1
- **Bước:** để nguyên → xoá hết → chỉ khoảng trắng → "x" → về nội dung gốc → dán 20 001 ký tự
- **Mong đợi:** Save tắt / tắt / tắt / bật / tắt / bật; ô soạn giữ đúng 20 000 ký tự; không PATCH nào được gửi
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-009 — a missing or non-UUID matchResultId and a non-UUID credentialId are rejected with 400

- **Requirement:** REQ-COVERLETTERGENERATOR-08
- **Layer:** api · **Priority:** P2
- **Bước:** thiếu `matchResultId`; `"not-a-uuid"`; `""`; `credentialId: "not-a-uuid"`
- **Mong đợi:** 400 mỗi lần; không row
- **Automated:** `tests/api/cover-letter-generator/generate-validation.api.ts`

### TC-COVERLETTERGENERATOR-014 — a missing or non-UUID matchResultId is rejected with 400

- **Requirement:** REQ-COVERLETTERGENERATOR-16
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /cover-letters` không query; `?matchResultId=not-a-uuid`; `?matchResultId=123`
- **Mong đợi:** 400
- **Automated:** `tests/api/cover-letter-generator/list.api.ts`

### TC-COVERLETTERGENERATOR-045 — with no drafts yet the dialog shows a meaningful empty state

- **Requirement:** REQ-COVERLETTERGENERATOR-17
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 0 thư (biên 0; 1 và 2 thư ở TC-039, TC-040)
- **Mong đợi:** tiêu đề "Drafts you have generated" + `coverLetter.empty`; 0 dòng; không ô soạn
- **Automated:** `tests/e2e/cover-letter-generator/drafts.e2e.ts`

## 4. Chuyển trạng thái

### TC-COVERLETTERGENERATOR-032 — a result card still running offers no cover letter until its result lands

- **Requirement:** REQ-COVERLETTERGENERATOR-01
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** run `succeeded` mở lại; `POST /match` stub trả kết quả sau 4 s
- **Bước:** "Go to Review" → "Run match"
- **Mong đợi:** card đang chạy (skeleton) không có nút; khi kết quả về nút xuất hiện
- **Automated:** `tests/e2e/cover-letter-generator/entry.e2e.ts`

### TC-COVERLETTERGENERATOR-059 — deleting the open draft releases the editor and never saves to the deleted id

- **Requirement:** REQ-COVERLETTERGENERATOR-25
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 1 thư, đang mở và có sửa chưa lưu
- **Bước:** xoá dòng đó
- **Mong đợi:** không còn ô soạn / Save; empty state; không request `PATCH` nào; row đã xoá trong DB
- **Automated:** `tests/e2e/cover-letter-generator/delete.e2e.ts`

### TC-COVERLETTERGENERATOR-018 — a failed letter cannot be edited

- **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Layer:** api · **Priority:** P1
- **Bước:** `PATCH` một thư `failed`
- **Mong đợi:** 400 `coverLetters.errors.notEditable`; row không đổi (`content ""`, `edited false`)
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-011 — a failed match with someone else's credential is 400, the match check comes first

- **Requirement:** REQ-COVERLETTERGENERATOR-09
- **Layer:** api · **Priority:** P1
- **Mong đợi:** 400 `matchNotSucceeded` (không phải 404 của credential); không row
- **Automated:** `tests/api/cover-letter-generator/generate-validation.api.ts`

### TC-COVERLETTERGENERATOR-022 — letters are deleted with the match result they were written from

- **Requirement:** REQ-COVERLETTERGENERATOR-26
- **Layer:** api · **Priority:** P2
- **Bước:** seed 2 thư → xoá row `MatchResult` (không có endpoint, xoá ở DB) → `GET`
- **Mong đợi:** cả 2 thư biến mất (cascade); `GET` trả `[]`
- **Automated:** `tests/api/cover-letter-generator/data-lifecycle.api.ts`

### TC-COVERLETTERGENERATOR-023 — deleting the credential keeps the letter and clears its credentialId

- **Requirement:** REQ-COVERLETTERGENERATOR-26
- **Layer:** api · **Priority:** P2
- **Bước:** tạo credential qua API → thư gắn credential → `DELETE /ai-credentials/:id` → `GET` thư
- **Mong đợi:** thư còn, `credentialId: null`, nội dung giữ nguyên
- **Automated:** `tests/api/cover-letter-generator/data-lifecycle.api.ts`

### TC-COVERLETTERGENERATOR-043 — try again regenerates with the failed draft's own options

- **Requirement:** REQ-COVERLETTERGENERATOR-19
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** 1 thư failed Friendly / Short / Vietnamese; Segmented đang ở mặc định
- **Bước:** "Try again"
- **Mong đợi:** request mang `tone: friendly`, `length: short`, `language: vi` — đã sửa: [BUG-COVERLETTERGENERATOR-04](../defects/cover-letter-generator.md#bug-coverlettergenerator-04)
- **Automated:** `tests/e2e/cover-letter-generator/generate.e2e.ts`

## 5. Đoán lỗi / negative

### TC-COVERLETTERGENERATOR-041 — while generating the draft area is busy, and a double click sends one request

- **Requirement:** REQ-COVERLETTERGENERATOR-14
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** stub trả sau 3 s
- **Bước:** bấm đúp Generate
- **Mong đợi:** vùng nháp `aria-busy="true"` rồi `false` khi xong; đúng 1 `POST`; 1 dòng
- **Automated:** `tests/e2e/cover-letter-generator/generate.e2e.ts`

### TC-COVERLETTERGENERATOR-017 — whitespace-only content is rejected with 400

- **Requirement:** REQ-COVERLETTERGENERATOR-22
- **Layer:** api · **Priority:** P2
- **Bước:** `PATCH` với `"   "`, `"\n\n"`, `"\t "`
- **Mong đợi:** 400, nội dung cũ giữ nguyên — đã sửa: [BUG-COVERLETTERGENERATOR-03](../defects/cover-letter-generator.md#bug-coverlettergenerator-03)
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-020 — a non-UUID id is 400 and an unknown id is 404 on PATCH and DELETE

- **Requirement:** REQ-COVERLETTERGENERATOR-22, REQ-COVERLETTERGENERATOR-25
- **Layer:** api · **Priority:** P2
- **Mong đợi:** `not-a-uuid` → 400 (PATCH, DELETE); UUID ngẫu nhiên → 404 `coverLetters.errors.notFound`
- **Automated:** `tests/api/cover-letter-generator/edit-delete.api.ts`

### TC-COVERLETTERGENERATOR-050 — a failed drafts request shows an error instead of an empty list

- **Requirement:** REQ-COVERLETTERGENERATOR-20
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `GET /cover-letters` trả 500 (stub)
- **Mong đợi:** alert `coverLetter.err.list`; không empty state, 0 dòng (skeleton khi tải: ngoài phạm vi, xem decisions)
- **Automated:** `tests/e2e/cover-letter-generator/drafts.e2e.ts`

### TC-COVERLETTERGENERATOR-054 — a failed save keeps the text the user typed

- **Requirement:** REQ-COVERLETTERGENERATOR-23
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** `PATCH` trả 500 (stub)
- **Bước:** sửa → Save
- **Mong đợi:** alert `coverLetter.err.save`; ô soạn giữ text vừa gõ, Save vẫn bật; DB không đổi
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-056 — without a clipboard, copy says to copy by hand

- **Requirement:** REQ-COVERLETTERGENERATOR-24
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `navigator.clipboard.writeText` bị từ chối (giả lập ngữ cảnh không an toàn)
- **Bước:** Copy
- **Mong đợi:** alert `coverLetter.err.copy`
- **Automated:** `tests/e2e/cover-letter-generator/edit.e2e.ts`

### TC-COVERLETTERGENERATOR-060 — a failed delete says so and keeps the draft

- **Requirement:** REQ-COVERLETTERGENERATOR-25
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `DELETE` trả 500 (stub)
- **Mong đợi:** alert `coverLetter.err.delete`; dòng và ô soạn còn nguyên; row còn trong DB
- **Automated:** `tests/e2e/cover-letter-generator/delete.e2e.ts`

## 6. Bảo mật & ngoài lề

### TC-COVERLETTERGENERATOR-001 — anonymous caller gets 401 SIGN_IN_REQUIRED on every cover-letter endpoint

- **Requirement:** REQ-COVERLETTERGENERATOR-02
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** POST / GET / PATCH / DELETE không cookie
- **Mong đợi:** 401 `SIGN_IN_REQUIRED`, message `auth.errors.signInRequired`
- **Automated:** `tests/api/cover-letter-generator/access.api.ts`

### TC-COVERLETTERGENERATOR-002 — guest session gets 401 SIGN_IN_REQUIRED on every cover-letter endpoint

- **Requirement:** REQ-COVERLETTERGENERATOR-02
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** khách có match + thư của chính mình
- **Mong đợi:** 401 `SIGN_IN_REQUIRED` cho cả 4; thư của khách không đổi
- **Automated:** `tests/api/cover-letter-generator/access.api.ts`

### TC-COVERLETTERGENERATOR-003 — generating from another user's or an unknown match is 404 and writes nothing

- **Requirement:** REQ-COVERLETTERGENERATOR-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** 404 `coverLetters.errors.matchNotFound` cho match của người khác và UUID ngẫu nhiên (không phân biệt
  được); không row ở cả hai user
- **Automated:** `tests/api/cover-letter-generator/access.api.ts`

### TC-COVERLETTERGENERATOR-004 — generating with another user's credential is 404 and writes nothing

- **Requirement:** REQ-COVERLETTERGENERATOR-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** 404; không row; không gọi AI (credential bị từ chối trước khi giải mã)
- **Automated:** `tests/api/cover-letter-generator/access.api.ts`

### TC-COVERLETTERGENERATOR-005 — listing another user's match returns an empty list, not 403

- **Requirement:** REQ-COVERLETTERGENERATOR-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** 200 `[]`
- **Automated:** `tests/api/cover-letter-generator/access.api.ts`

### TC-COVERLETTERGENERATOR-006 — editing or deleting another user's letter is 404 and leaves it untouched

- **Requirement:** REQ-COVERLETTERGENERATOR-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** 404 `coverLetters.errors.notFound` cho PATCH và DELETE; row giữ nội dung, `edited false`
- **Automated:** `tests/api/cover-letter-generator/access.api.ts`

### TC-COVERLETTERGENERATOR-024 — no response of the cover-letter endpoints carries the API key or its ciphertext

- **Requirement:** REQ-COVERLETTERGENERATOR-27
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** credential tạo qua API với key giả; 1 thư thành công + 1 thư failed `invalid_key` gắn credential
- **Bước:** GET danh sách, PATCH (200 và 400), DELETE (404)
- **Mong đợi:** không response nào chứa key hay field `apiKey` / `encryptedKey` / `keyIv` / `keyTag`; `errorCode` là mã đóng
- **Automated:** `tests/api/cover-letter-generator/data-lifecycle.api.ts`

### TC-COVERLETTERGENERATOR-062 — no API key material reaches the page

- **Requirement:** REQ-COVERLETTERGENERATOR-27
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** credential thật (key giả) của user e2e; match + thư chạy bằng nó
- **Bước:** mở dialog → mở "Run with"
- **Mong đợi:** HTML trang không chứa key (cả phần trước 4 ký tự cuối)
- **Automated:** `tests/e2e/cover-letter-generator/i18n-a11y.e2e.ts`

### TC-COVERLETTERGENERATOR-038 — the privacy note on the system key names OpenRouter

- **Requirement:** REQ-COVERLETTERGENERATOR-07
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở dialog → chọn System key
- **Mong đợi:** câu `credentials.runWith.privacySystem` — đã sửa: [BUG-COVERLETTERGENERATOR-01](../defects/cover-letter-generator.md#bug-coverlettergenerator-01)
- **Automated:** `tests/e2e/cover-letter-generator/options.e2e.ts`

### TC-COVERLETTERGENERATOR-025 — error messages follow the request language

- **Requirement:** REQ-COVERLETTERGENERATOR-28
- **Layer:** api · **Priority:** P2
- **Bước:** `Accept-Language: vi`: match không tồn tại, match failed, xoá thư không tồn tại, sửa thư failed, gọi ẩn danh
- **Mong đợi:** message `coverLetters.errors.{matchNotFound, matchNotSucceeded, notFound, notEditable}` và
  `auth.errors.signInRequired` bản vi
- **Automated:** `tests/api/cover-letter-generator/data-lifecycle.api.ts`

### TC-COVERLETTERGENERATOR-026 — POST /cover-letters allows 10 calls per minute, the next one is 429; other routes keep the global limit

- **Requirement:** REQ-COVERLETTERGENERATOR-13
- **Layer:** api · **Priority:** P1
- **Bước:** gọi `POST` ẩn danh (401, không ghi, không AI) đến khi `X-RateLimit-Remaining` về 0, gọi thêm 1 lần; `GET` ẩn danh
- **Mong đợi:** `X-RateLimit-Limit: 10`; lần ngay sau `remaining = 0` là 429 có `Retry-After`, không lần nào 429 sớm hơn;
  `GET` có `X-RateLimit-Limit: 100`
- **Automated:** `tests/api/cover-letter-generator/throttle.api.ts`

### TC-COVERLETTERGENERATOR-029 — a key the provider rejects is stored as a failed letter with a closed-set code

- **Requirement:** REQ-COVERLETTERGENERATOR-11, REQ-COVERLETTERGENERATOR-27
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`; credential OpenRouter với key giả
- **Bước:** `POST /cover-letters` với `credentialId`
- **Mong đợi:** 201, `status: failed`, `errorCode: invalid_key`, `content ""`, `omittedRequirements []`,
  `credentialId` giữ nguyên; response không chứa key
- **Automated:** `tests/api/cover-letter-generator/live-generation.api.ts`

### TC-COVERLETTERGENERATOR-061 — the dialog reads in Vietnamese, failure codes included

- **Requirement:** REQ-COVERLETTERGENERATOR-28
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** 1 thư có omitted + 1 thư failed `invalid_key`; UI đổi sang vi qua `window.__i18n`
- **Mong đợi:** mọi nhãn (dialog, 3 nhóm, Run with, Generate, ô soạn, Copy / Tải / Lưu, khối omitted, danh sách, thông báo
  quyền riêng tư) bản vi; lỗi `invalid_key` hiện câu vi, không mã thô
- **Automated:** `tests/e2e/cover-letter-generator/i18n-a11y.e2e.ts`

### TC-COVERLETTERGENERATOR-063 — focus moves into the dialog, Escape closes it and focus returns to the button

- **Requirement:** REQ-COVERLETTERGENERATOR-29
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** focus nằm trong dialog sau khi mở; `Esc` đóng; nút "Write cover letter" được focus lại
- **Automated:** `tests/e2e/cover-letter-generator/i18n-a11y.e2e.ts`

### TC-COVERLETTERGENERATOR-064 — tab order follows the dialog's layout and delete buttons name their draft

- **Requirement:** REQ-COVERLETTERGENERATOR-29
- **Layer:** e2e · **Priority:** P2
- **Bước:** focus radio Formal → Tab 25 lần
- **Mong đợi:** thứ tự Run with → Generate → ô soạn → Copy → nút xoá; nút xoá tên `Delete draft: <mô tả>` cho từng dòng
- **Automated:** `tests/e2e/cover-letter-generator/i18n-a11y.e2e.ts`

### TC-COVERLETTERGENERATOR-065 — an empty, broken or oversized model answer is stored safely

- **Requirement:** REQ-COVERLETTERGENERATOR-12
- **Layer:** api · **Priority:** P2
- **Mong đợi:** body rỗng / JSON hỏng → row failed `model_unavailable`; body > 20 000 ký tự → cắt còn 20 000
- **Automated:** manual — chỉ dựng được khi điều khiển câu trả lời của model; dev server trỏ provider thật (D1). Hai nhánh
  đầu có unit test `server/src/modules/ai/ai.service.spec.ts`; nhánh cắt 20 000 chưa có unit test → kiểm tay bằng
  `OPENROUTER_BASE_URL` trỏ một server giả.

### TC-COVERLETTERGENERATOR-066 — a server without the system key answers 503 and writes nothing

- **Requirement:** REQ-COVERLETTERGENERATOR-11
- **Layer:** api · **Priority:** P2
- **Mong đợi:** `POST` không `credentialId` trên server thiếu `OPENROUTER_API_KEY` → 503, không row
- **Automated:** manual — dev server dùng chung luôn có `OPENROUTER_API_KEY` và `CREDENTIAL_ENCRYPTION_KEY`; cần một
  instance riêng thiếu biến. Phía UI của 503 tự động ở TC-COVERLETTERGENERATOR-044.
