# MULTIPROVIDERCOMPARE — So sánh nhiều provider AI trong một lần so khớp

**Bước 3 — chọn provider**

- **REQ-MULTIPROVIDERCOMPARE-01** User đã đăng nhập chọn **nhiều** lựa chọn trong một danh sách checkbox: mỗi credential một dòng, cộng dòng "System key"; danh sách là một nhóm (`role="group"`) có accessible name "Run with" / "Chạy bằng"; mỗi checkbox tới được bằng Tab và bật/tắt được bằng phím Space.
- **REQ-MULTIPROVIDERCOMPARE-02** Bỏ chọn hết → nút Run match disabled, dòng quyền riêng tư đổi thành "Select at least one key to run the match." / "Chọn ít nhất một key để chạy so khớp.", không request nào được gửi; danh sách **không** tự chọn lại mặc định.
- **REQ-MULTIPROVIDERCOMPARE-03** Không giới hạn số lựa chọn. Nút CTA nói rõ số lượng trước khi bấm: 1 lựa chọn → "Run match" / "Chạy so khớp"; N ≥ 2 → "Run match · {N} providers" / "Chạy so khớp · {N} provider".
- **REQ-MULTIPROVIDERCOMPARE-04** Ngay dưới danh sách, trước khi chạy, thông báo quyền riêng tư nêu **đích danh** mọi nhà cung cấp sẽ nhận CV/JD ("Your CV and JD text will be sent to: {providers}."): nhãn provider của từng credential đã chọn; key hệ thống được nêu là OpenRouter (nhà cung cấp thật của key hệ thống), không chỉ là chữ "System key".
- **REQ-MULTIPROVIDERCOMPARE-05** Khách không thấy khối chọn provider; lần chạy của khách luôn đúng 1 lựa chọn là key hệ thống, và trước khi chạy khách thấy thông báo "Your CV and JD text will be sent to OpenRouter using the system key." / "Nội dung CV và JD của bạn sẽ được gửi tới OpenRouter bằng key hệ thống.".

**Mở run**

- **REQ-MULTIPROVIDERCOMPARE-06** Bấm Run match → `POST /match/runs { cvDocumentId, jdDocumentId }` → 201 `{ id, cvDocumentId, jdDocumentId, createdAt }`, rồi sang bước 4 **ngay**, không chờ kết quả AI. Luôn tạo run, kể cả khi N = 1. Nút ở trạng thái loading trong lúc gửi; bấm hai lần nhanh chỉ tạo **một** run.
- **REQ-MULTIPROVIDERCOMPARE-07** `POST /match/runs` lỗi → ở lại bước 3, hiện `role="alert"` với message của server (hoặc "We couldn't run the match. Please try again." khi không có), không sang bước 4 rỗng.
- **REQ-MULTIPROVIDERCOMPARE-08** `POST /match/runs` kiểm tra: hai id là UUID (khác → 400); cả hai tài liệu phải thuộc người gọi (không → 400 "Document not found or does not belong to you."); đúng loại CV/JD (đảo → 400 "Document kind does not match (expected CV/JD as specified)."). Khách gọi được.

**Bước 4 — N card, hiện dần**

- **REQ-MULTIPROVIDERCOMPARE-09** Bước 4 vẽ đúng N card, mỗi lựa chọn một card, theo thứ tự cố định bằng thứ tự các dòng trong danh sách chọn (không phải thứ tự bấm).
- **REQ-MULTIPROVIDERCOMPARE-10** Mỗi card gửi **đúng một** `POST /match { cvDocumentId, jdDocumentId, runId, credentialId? }` khi hiện ra (key hệ thống → không gửi `credentialId`); N request chạy song song, độc lập; không polling.
- **REQ-MULTIPROVIDERCOMPARE-11** Card đang chạy: skeleton, `aria-busy="true"`, tiêu đề "Running…" / "Đang chạy…" (hoặc "System key" / "Key hệ thống" cho key hệ thống). Card xong trước hiện kết quả trước trong khi card khác còn skeleton. Vùng chứa card có `aria-live="polite"`.
- **REQ-MULTIPROVIDERCOMPARE-12** Card thành công: tiêu đề "`<nhãn provider> · <chatModel>`" đọc từ chính kết quả (không từ danh sách credential); ba chỉ số Overall / Semantic / Keyword hiện dạng `%`; báo cáo strengths / gaps / suggestions.
- **REQ-MULTIPROVIDERCOMPARE-13** N = 1 → báo cáo mở sẵn (như match đơn); N ≥ 2 → báo cáo gập trong "Show full report" / "Xem báo cáo đầy đủ", điểm luôn hiện.
- **REQ-MULTIPROVIDERCOMPARE-14** Thời gian của một run ≈ provider chậm nhất, không phải tổng: cả N request cùng đang chờ một lúc.

**Lỗi từng phần**

- **REQ-MULTIPROVIDERCOMPARE-15** Provider lỗi khi chạy → `POST /match` vẫn **201**, `status = "failed"`, `errorCode` ∈ {`invalid_key`, `no_quota`, `model_unavailable`, `timeout`, `unreachable`}, điểm 0, báo cáo rỗng, không bao giờ chứa message thô của provider hay key. Thành công → `status = "succeeded"`, `errorCode = null`, `overallScore = round(0.6 × semantic + 0.4 × keyword)`.
- **REQ-MULTIPROVIDERCOMPARE-16** Lỗi cấu hình không thành kết quả: key hệ thống chưa cấu hình → 503 "Matching service is not configured. Please contact the administrator."; thiếu khoá mã hoá khi dùng credential → 503 "Credential storage is not configured. Please contact the administrator.".
- **REQ-MULTIPROVIDERCOMPARE-17** Card lỗi hiện Alert `role="alert"` với câu theo `errorCode` (en: "That API key was rejected by the provider." · "This key has no quota left with the provider." · "The provider does not offer that model." · "The provider took too long to answer." · "Could not reach the provider."; vi tương ứng); không bao giờ vẽ thành điểm "0%" hay hiện mã lỗi thô.
- **REQ-MULTIPROVIDERCOMPARE-18** Partial success: một card lỗi thì các card khác giữ nguyên kết quả của chúng.
- **REQ-MULTIPROVIDERCOMPARE-19** Card lỗi có nút "Try again" / "Thử lại": bấm → chỉ card đó gửi lại `POST /match`; các card khác không gửi lại.
- **REQ-MULTIPROVIDERCOMPARE-20** Request của một card trả lỗi HTTP (4xx/5xx) → card đó hiện trạng thái lỗi kèm Try again với **message của server** (vd "Credential not found."); câu "Could not reach the provider." chỉ dùng khi không tới được server (lỗi mạng); các card khác không bị ảnh hưởng.

**Hợp đồng `POST /match` liên quan run**

- **REQ-MULTIPROVIDERCOMPARE-21** `runId` / `credentialId` tuỳ chọn, phải là UUID (khác → 400). Thứ tự kiểm: tài liệu (400) → run → credential → gọi AI. `runId` trỏ cặp tài liệu khác → 400 "This run is for a different pair of documents."; `runId` không thuộc người gọi hoặc không tồn tại → 404 "Match run not found."; `credentialId` không thuộc người gọi → 404 "Credential not found."; mọi nhánh lỗi này không tạo kết quả nào.
- **REQ-MULTIPROVIDERCOMPARE-22** Kết quả match có `runId` (null cho kết quả cũ), `status`, `errorCode`, `provider`, `chatModel`, `embedModel`, `credentialId`; không chứa key. N kết quả cùng `runId` phân biệt bằng `provider` / `credentialId`.

**Đọc lại run**

- **REQ-MULTIPROVIDERCOMPARE-23** `GET /match/runs/:id` → 200 `{ id, cvDocumentId, jdDocumentId, createdAt, results[] }`, `results` sắp `createdAt` tăng dần, chỉ gồm những gì đã xong (rỗng là hợp lệ). Run của người khác / không tồn tại → 404 "Match run not found."; id không phải UUID → 400; route không bị `GET /match/:id` nuốt. Kết quả cũ không có run (`runId = null`) vẫn đọc được qua `GET /match/:id`.
- **REQ-MULTIPROVIDERCOMPARE-24** Tải lại trang giữa lúc chạy **không** gửi lại `POST /match` nào; wizard trở về bước 1 (run chỉ đọc lại được qua `/wizard?runId=`).
- **REQ-MULTIPROVIDERCOMPARE-25** Mở `/wizard?runId=<id>`: trong lúc đọc hiện skeleton `aria-busy`; đọc `GET /match/runs/:id` → vào bước 4 với cặp tài liệu của run, các card chỉ hiện kết quả đã lưu (không gửi `POST /match`), rồi bỏ `runId` khỏi URL. 404 / 401 → toast "No run to show. Start a new match." và wizard về bước 1; lỗi khác → toast "We couldn't run the match. Please try again.".
- **REQ-MULTIPROVIDERCOMPARE-26** Run chưa có kết quả nào → bước 4 hiện Alert "Nothing finished yet" + "This run has no results. Providers that were still running when you reloaded are not resumed.", không phải màn trắng.
- **REQ-MULTIPROVIDERCOMPARE-27** Đọc run ở bước 4 thất bại: 404 → `role="alert"` "No run to show. Start a new match."; lỗi khác → "We couldn't run the match. Please try again."; cả hai kèm nút "Start over" / "Làm lại".
- **REQ-MULTIPROVIDERCOMPARE-28** Đổi JD hoặc CV ở bước 1–2 sau khi đã chạy → run cũ bị bỏ khỏi wizard: bước 4 bị khoá cho tới khi chạy lại, không hiện kết quả của cặp cũ.

**Card cho user và khách**

- **REQ-MULTIPROVIDERCOMPARE-29** Card thành công của user đã đăng nhập có action "Improve my CV", "Write cover letter", và "Compare versions" (chỉ khi CV có phiên bản trước); trên mobile mỗi nút cao ≥ 44 px và rộng hết card. Card của khách không có các action đó.
- **REQ-MULTIPROVIDERCOMPARE-30** Khách hết lượt (`POST /match` → 429 `GUEST_QUOTA_EXCEEDED` kèm `limit`, `resetsAt`) → card hiện cổng đăng nhập hết lượt; khung "Kept for 24 hours" chỉ hiện khi mọi card đã xong và có ít nhất một card thành công.
- **REQ-MULTIPROVIDERCOMPARE-31** Đủ `en` + `vi`, không lộ key thô, cho: nhãn danh sách chọn, CTA có số đếm, thông báo quyền riêng tư, tiêu đề card đang chạy, 5 câu `errorCode`, "Try again", "Show full report", trạng thái rỗng, message lỗi của server (`runNotFound`, `runDocumentMismatch`, `documentNotOwned`).
- **REQ-MULTIPROVIDERCOMPARE-32** Thông báo lỗi của card và của bước 3 được screen reader đọc (`role="alert"`); card đang chạy `aria-busy`; vùng kết quả `aria-live="polite"`.
- **REQ-MULTIPROVIDERCOMPARE-33** "Try again" tạo thêm một kết quả trong cùng run (lần lỗi được giữ làm dữ liệu): đọc lại run thấy mọi lần thử, kể cả lần lỗi, theo thứ tự thời gian.
- **REQ-MULTIPROVIDERCOMPARE-34** Khách gửi `credentialId` → 403 `GUEST_FORBIDDEN_CREDENTIAL` "Guests can only use the system AI key.", trước khi gọi AI.
- **REQ-MULTIPROVIDERCOMPARE-35** Nội dung tiếng Việt được chấm có phân biệt: với cùng một JD tiếng Việt, CV tiếng Việt phù hợp được `overallScore` cao hơn CV tiếng Việt không liên quan.
