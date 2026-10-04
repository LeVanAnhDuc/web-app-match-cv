# UX Copy — chuẩn UI copy (EN + VI)

> **Trả lời:** Câu chữ trên UI viết thế nào, EN và VI?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-10-04 · commit —
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

## 9. Auth, khách, gate (ducker-id-sign-in)

Nguồn runtime: `client/src/locales/{en,vi}/translation.json`. Key viết gọn từ gốc `auth.*`,
`gate.*`, `home.guest.*`, `home.perks.*`, `result.keep.*`, `wizard.claimed.*`.

### 9.1 Đăng nhập và quota — `auth.*`

| Key | EN | VI |
|---|---|---|
| auth.signIn | Sign in | Đăng nhập |
| auth.signInWithDucker | Sign in with Ducker ID | Đăng nhập bằng Ducker ID |
| auth.signOut | Sign out | Đăng xuất |
| auth.account | Account | Tài khoản |
| auth.guest.eyebrow | Guest mode | Chế độ khách |
| auth.guest.pitch | Sign in to keep your CVs, match history and results — and to rewrite CVs, draft cover letters and use your own AI key. | Đăng nhập để giữ CV, lịch sử đối chiếu và kết quả — đồng thời viết lại CV, soạn thư xin việc và dùng khoá AI của riêng bạn. |
| auth.quota.label | Free matches today | Lượt đối chiếu miễn phí hôm nay |
| auth.quota.left | {{left}} / {{limit}} left | Còn {{left}} / {{limit}} |

### 9.2 Lỗi đăng nhập — `auth.error.*`

| Key | EN | VI |
|---|---|---|
| denied | Sign-in was cancelled. | Đã huỷ đăng nhập. |
| state | Sign-in expired — please try again. | Phiên đăng nhập đã hết hạn — vui lòng thử lại. |
| iss | Sign-in could not be verified. Please try again. | Không xác minh được lần đăng nhập. Vui lòng thử lại. |
| exchange | Could not complete sign-in. Please try again. | Không thể hoàn tất đăng nhập. Vui lòng thử lại. |
| token | Could not verify your sign-in. Please try again. | Không xác minh được đăng nhập của bạn. Vui lòng thử lại. |
| server | Sign-in is unavailable right now. Please try again later. | Hiện chưa thể đăng nhập. Vui lòng thử lại sau. |
| generic | Sign-in failed. Please try again. | Đăng nhập thất bại. Vui lòng thử lại. |

### 9.3 Gate — `gate.*`

| Key | EN | VI |
|---|---|---|
| gate.cv | Sign in to see your saved CVs | Đăng nhập để xem các CV đã lưu |
| gate.jd | Sign in to see your saved job descriptions | Đăng nhập để xem các mô tả công việc đã lưu |
| gate.aiCredentials | Sign in to manage your AI keys | Đăng nhập để quản lý khoá AI của bạn |
| gate.myData | Sign in to download your data | Đăng nhập để tải dữ liệu của bạn |
| gate.compare | Sign in to compare CV versions | Đăng nhập để so sánh các phiên bản CV |
| gate.cvRewrite | Sign in to rewrite this CV | Đăng nhập để viết lại CV này |
| gate.description | This page keeps things in your account. Sign in with Ducker ID to open it. | Trang này lưu dữ liệu trong tài khoản của bạn. Đăng nhập bằng Ducker ID để mở. |
| gate.quotaTitle | You have used today's {{limit}} free matches | Bạn đã dùng hết {{limit}} lượt đối chiếu miễn phí hôm nay |
| gate.quotaDescription | Guest matches run on the system AI key, so they are capped per network. Sign in to keep going — with your own AI key if you add one. | Lượt của khách chạy bằng khoá AI của hệ thống nên bị giới hạn theo mạng. Đăng nhập để tiếp tục — với khoá AI của riêng bạn nếu bạn thêm. |
| gate.resetsIn | Resets in `<time>`{{time}}`</time>` | Đặt lại sau `<time>`{{time}}`</time>` |
| gate.backHome | Back to home | Về trang chủ |
| gate.backMatching | Back to matching | Quay lại đối chiếu |

### 9.4 Trang chủ khách — `home.guest.*` và `home.perks.*`

| Key | EN | VI |
|---|---|---|
| home.guest.eyebrow | CV ↔ JD matching | Ghép CV ↔ JD |
| home.guest.title | How well does your CV fit this job? | CV của bạn khớp công việc này đến đâu? |
| home.guest.subtitle | Paste a job description and your CV. You get one score you can trace back — 60% meaning, 40% keywords — plus what is strong and what is missing. | Dán mô tả công việc và CV của bạn. Bạn nhận một điểm có thể truy ngược — 60% theo ý nghĩa, 40% theo từ khoá — cùng điểm mạnh và điểm còn thiếu. |
| home.guest.cta | Start matching → | Bắt đầu ghép → |
| home.guest.signIn | Sign in | Đăng nhập |
| home.guest.note | No account needed: {{limit}} matches a day on the system AI key. Your CV and JD are kept for 24 hours, then deleted. | Không cần tài khoản: {{limit}} lượt ghép mỗi ngày bằng khoá AI của hệ thống. CV và JD của bạn được giữ 24 giờ rồi bị xoá. |
| home.perks.eyebrow | With a Ducker ID account | Với tài khoản Ducker ID |
| home.perks.title | Everything stays in one place | Mọi thứ nằm cùng một chỗ |
| home.perks.documents.title / .meta | Saved CVs & JDs / Reuse documents across matches | CV & JD đã lưu / Dùng lại tài liệu cho nhiều lần ghép |
| home.perks.history.title / .meta | Match history / Every result you ran, kept | Lịch sử ghép / Mọi kết quả bạn đã chạy đều được giữ |
| home.perks.rewrite.title / .meta | CV rewrite & cover letters / Generated from the gaps of a match | Viết lại CV & thư xin việc / Tạo từ những điểm còn thiếu của một lần ghép |
| home.perks.keys.title / .meta | Your own AI keys / OpenAI, Gemini or OpenRouter — encrypted | Khoá AI của riêng bạn / OpenAI, Gemini hoặc OpenRouter — được mã hoá |

### 9.5 Wizard khách — `result.keep.*` và `wizard.claimed.*`

| Key | EN | VI |
|---|---|---|
| result.keep.title | Kept for 24 hours, then deleted | Giữ trong 24 giờ, sau đó bị xoá |
| result.keep.body | Sign in with Ducker ID and this result moves into your account with its CV and JD. Then you can rewrite the CV against these gaps or draft a cover letter. | Đăng nhập bằng Ducker ID và kết quả này chuyển vào tài khoản của bạn cùng CV và JD của nó. Khi đó bạn có thể viết lại CV theo các điểm thiếu này hoặc soạn thư xin việc. |
| result.keep.cta | Sign in to keep it | Đăng nhập để giữ lại |
| wizard.claimed.title | Saved to your account. | Đã lưu vào tài khoản của bạn. |
| wizard.claimed.body | This result, its CV and its JD moved over from your guest session. | Kết quả này cùng CV và JD của nó đã được chuyển từ phiên khách sang. |

Tone khách: không hứa thứ chưa có (không nói "miễn phí mãi mãi"), luôn nói rõ **24 giờ** và
lý do (khoá hệ thống ⇒ giới hạn theo mạng). `action.saveReport` ở §4 không còn dùng — nút đã gỡ.
