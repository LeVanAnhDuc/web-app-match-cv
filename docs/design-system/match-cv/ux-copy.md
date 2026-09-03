# UX Copy — chuẩn UI copy (EN + VI)

> **Trả lời:** Câu chữ trên UI viết thế nào, EN và VI?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · chuyển từ `.claude/uiux/`
> **Cập nhật khi:** thêm màn hình mới · đổi tone · thêm chuỗi i18n

> Rút từ mock `cv-jd-matching-wizard` (user duyệt 2026-07-24). Token nằm ở
> [`MASTER.md`](MASTER.md) — file này **không** chứa token.

## 1. Tone & Voice

Ngắn gọn, chủ động, hướng dẫn user bước kế. Không viết hoa toàn bộ. VI dùng "bạn".

## 2. Wizard steps

| Key | EN | VI |
|---|---|---|
| step.jd | Job Description | Mô tả công việc |
| step.cv | CV / Resume | CV / Hồ sơ |
| step.review | Review | Xem lại |
| step.result | Result | Kết quả |
| stepper.progress | Step {n} of 4 | Bước {n}/4 |

## 3. Step 1–2 (input JD/CV)

| Key | EN | VI |
|---|---|---|
| input.tab.upload | Upload file | Tải file |
| input.tab.paste | Paste text | Dán văn bản |
| dropzone.title | Drop your file here or **browse** | Kéo thả file vào đây hoặc **chọn file** |
| dropzone.hint | Supports PDF, DOCX (Max 10MB) | Hỗ trợ PDF, DOCX (tối đa 10MB) |
| reuse.jd.title | Or reuse a saved job description | Hoặc chọn JD đã lưu |
| reuse.cv.title | Or reuse a saved CV | Hoặc chọn CV đã lưu |
| reuse.empty.jd | No saved job descriptions yet | Chưa có JD nào được lưu |
| reuse.empty.cv | No saved CVs yet | Chưa có CV nào được lưu |
| reuse.empty.hint | Items you save will appear here. | Tài liệu bạn lưu sẽ hiện ở đây. |
| save.jd | Save this JD for later reuse | Lưu JD này để dùng lại |
| save.cv | Save this CV for later reuse | Lưu CV này để dùng lại |
| save.title.placeholder | Enter a title for this document | Đặt tiêu đề cho tài liệu này |

## 4. Actions

| Key | EN | VI |
|---|---|---|
| action.next | Next | Tiếp |
| action.back | Back | Quay lại |
| action.runMatch | Run match | Chạy so khớp |
| action.startOver | Start over | Làm lại |
| action.saveReport | Save report | Lưu báo cáo |

## 5. Step 4 (result)

| Key | EN | VI |
|---|---|---|
| result.overall | Overall match | Mức khớp tổng |
| result.semantic | Semantic match | Khớp ngữ nghĩa |
| result.keyword | Keyword / Skills match | Khớp từ khoá / kỹ năng |
| result.strengths | Matched strengths | Điểm mạnh khớp |
| result.gaps | Gaps / Missing | Điểm thiếu |
| result.suggestions | How to improve your CV | Cách cải thiện CV |

## 6. Validation / error

| Key | EN | VI |
|---|---|---|
| err.fileType | Only PDF or DOCX files are allowed | Chỉ chấp nhận file PDF hoặc DOCX |
| err.fileSize | File exceeds the {max} limit | File vượt quá giới hạn {max} |
| err.empty | Please provide a {kind} to continue | Vui lòng nhập {kind} để tiếp tục |
| err.parseFailed | We couldn't read this file. Try another. | Không đọc được file này. Thử file khác. |

## 7. Wizard card copy (step 1–2) — thêm ở Plan 1

| Key | EN | VI |
|---|---|---|
| wizard.stepJd.title | Input Job Description | Nhập mô tả công việc |
| wizard.stepJd.description | Start by providing the details of the position you are hiring for. | Bắt đầu bằng cách cung cấp thông tin về vị trí bạn đang tuyển. |
| wizard.stepCv.title | Candidate CV / Resume | CV / Hồ sơ ứng viên |
| wizard.stepCv.description | Provide the experience details for the candidate you're analyzing. | Cung cấp thông tin kinh nghiệm của ứng viên bạn đang phân tích. |
| wizard.comingSoon | Coming in Plan 2 | Sẽ có ở Plan 2 |
| paste.placeholder | Paste the text content here | Dán nội dung văn bản vào đây |
| dropzone.title | Drop your file here or `<highlight>`browse`</highlight>` | Kéo thả file vào đây hoặc `<highlight>`chọn file`</highlight>` |

> Interpolation dùng `{{var}}` (i18next), vd `stepper.progress` = "Step {{n}} of 4". Source-of-truth runtime: `client/src/i18n/{en,vi}.json`.

## 8. Plan 2 additions (matching)

| Key | EN | VI |
|---|---|---|
| review.missingDocs | No document selected. Go back to add a CV and a JD. | Chưa chọn tài liệu. Quay lại để thêm CV và JD. |
| result.disclaimer | AI-generated. CV/JD content is sent to OpenRouter for analysis — verify results independently. | Nội dung AI tạo. CV/JD được gửi tới OpenRouter để phân tích — hãy tự kiểm chứng kết quả. |
