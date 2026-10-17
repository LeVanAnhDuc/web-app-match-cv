# MULTIPROVIDERCOMPARE — Test cases

Thứ tự theo 6 lăng kính (CLAUDE.md): truy vết → phân vùng tương đương → biên → chuyển trạng thái → đoán lỗi →
bảo mật & ngoài lề. Tầng API giữ mọi tổ hợp input / phân quyền; tầng UI mỗi luồng một case. UI stub `POST /match`
theo từng card (D1); `@live-ai` là 3 case duy nhất chạm provider thật.

Case cũ ở `docs/specs/multi-provider-compare/e2e.md` (mục "Gom từ …", đã xoá) được chuyển như sau: row 1a → 040,
1b → 035, 1c → 037, 4 → 025 + 045, 5 → 043 + 052, 6 (BVA 0/1/2) → 025 / 040 / 041, 8 → 035, 9 → 062 (+ en ở mọi case
khác), 10 → 042 + 033, 11 → 044 + 047, 12 → 023 + 024 + 032; row 2/3 (AuthN/AuthZ "N/A") nay phủ ở API (003, 008,
015, 017); row 7 (filter) không áp dụng; "an untested credential is warned about" bỏ — thuộc `ai-credentials`.

## API — mở và đọc run

### TC-MULTIPROVIDERCOMPARE-001 — mở run cho cặp CV/JD của mình

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-06, REQ-MULTIPROVIDERCOMPARE-08
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user đăng nhập riêng, một CV và một JD dán (không lưu)
- **Bước:** `POST /match/runs { cvDocumentId, jdDocumentId }`
- **Mong đợi:** 201, body đúng `{ id (uuid), cvDocumentId, jdDocumentId, createdAt }`, không thêm trường
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-002 — id tài liệu không phải UUID hoặc thiếu thì trả 400

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-08
- **Layer:** api · **Priority:** P1
- **Bước:** `POST /match/runs` với `cvDocumentId: "not-a-uuid"`, `jdDocumentId: "123"`, thiếu `jdDocumentId`, body rỗng
- **Mong đợi:** 400 cho từng biến thể
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-003 — tài liệu không thuộc mình hoặc không tồn tại thì trả 400 documentNotOwned

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-08
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user thứ hai có một CV
- **Bước:** mở run với CV của người khác; với CV uuid ngẫu nhiên; với JD uuid ngẫu nhiên
- **Mong đợi:** 400 "Document not found or does not belong to you." (không phân biệt "của người khác" với "không tồn tại")
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-004 — đảo loại CV/JD thì trả 400 invalidDocumentKind

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-08
- **Layer:** api · **Priority:** P1
- **Bước:** `POST /match/runs { cvDocumentId: <JD>, jdDocumentId: <CV> }`
- **Mong đợi:** 400 "Document kind does not match (expected CV/JD as specified)."
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-005 — khách mở được run cho cặp tài liệu của mình

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-08
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** user khách (`createGuestUser`) với CV + JD của mình
- **Bước:** `POST /match/runs` bằng phiên khách
- **Mong đợi:** 201 với đúng cặp tài liệu
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-006 — run mới đọc lại được với danh sách kết quả rỗng, không bị GET /match/:id nuốt

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-23
- **Layer:** api · **Priority:** P1
- **Bước:** mở run → `GET /match/runs/:id`
- **Mong đợi:** 200, body = run vừa mở + `results: []` (nếu route bị `/match/:id` nuốt sẽ là 400)
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-007 — run đọc lại gồm mọi kết quả kể cả lần lỗi và lần thử lại, theo thời gian tăng dần

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-23, REQ-MULTIPROVIDERCOMPARE-33, REQ-MULTIPROVIDERCOMPARE-22
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** run có 3 kết quả seed trong DB, chèn lệch thứ tự: key hệ thống lỗi `timeout` (t1), key hệ thống thử lại thành công (t2), gemini (t3)
- **Bước:** `GET /match/runs/:id`
- **Mong đợi:** `results` theo t1 → t2 → t3; lần lỗi giữ `status=failed`, `errorCode=timeout`, điểm 0; mỗi kết quả mang `runId`, `provider`, `chatModel`, `credentialId`
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-008 — run của người khác hoặc không tồn tại trả 404 runNotFound

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-23
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** run của user khác (seed DB)
- **Bước:** `GET /match/runs/<run người khác>`, `GET /match/runs/<uuid ngẫu nhiên>`
- **Mong đợi:** cả hai 404 "Match run not found." (không lộ run tồn tại)
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-009 — id run không phải UUID trả 400

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-23
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /match/runs/not-a-uuid`
- **Mong đợi:** 400
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-010 — kết quả cũ không có run vẫn đọc được với runId null và trạng thái succeeded

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-23, REQ-MULTIPROVIDERCOMPARE-22
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** kết quả seed không có `runId`
- **Bước:** `GET /match/:id`
- **Mong đợi:** 200, `runId: null`, `status: "succeeded"`, `errorCode: null`
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-011 — kết quả có đủ trường run và provider, không bao giờ chứa key

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-22
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** kết quả seed trong một run, provider `openai`
- **Bước:** `GET /match/:id`
- **Mong đợi:** đúng tập trường của `MatchResultDto` (có `runId`, `status`, `errorCode`, `provider`, `chatModel`, `embedModel`, `credentialId`), không có `apiKey` / `encryptedKey` / `keyIv` / `keyTag`
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

### TC-MULTIPROVIDERCOMPARE-012 — message lỗi của run trả tiếng Việt khi client chọn vi

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-31
- **Layer:** api · **Priority:** P2
- **Bước:** với `Accept-Language: vi`: đọc run không tồn tại; mở run với CV lạ; `POST /match` với run của cặp khác
- **Mong đợi:** message lần lượt là `runNotFound`, `documentNotOwned`, `runDocumentMismatch` bản vi
- **Automated:** `tests/api/multi-provider-compare/match-runs.api.ts`

## API — `POST /match`: các nhánh trước khi gọi provider

### TC-MULTIPROVIDERCOMPARE-013 — runId hoặc credentialId không phải UUID trả 400

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-21
- **Layer:** api · **Priority:** P1
- **Bước:** `POST /match` với `runId: "run-1"`, `credentialId: "cred-1"`, `runId: 42`, `credentialId: ""`
- **Mong đợi:** 400 từng biến thể; lịch sử match (`GET /match`) không thêm dòng nào
- **Automated:** `tests/api/multi-provider-compare/match-pre-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-014 — tài liệu được kiểm trước run: tài liệu lạ kèm runId lạ trả 400 documentNotOwned

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-21
- **Layer:** api · **Priority:** P2
- **Bước:** `POST /match { cvDocumentId: <uuid lạ>, jdDocumentId, runId: <uuid lạ> }`
- **Mong đợi:** 400 "Document not found or does not belong to you." (không phải 404 của run)
- **Automated:** `tests/api/multi-provider-compare/match-pre-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-015 — runId của người khác hoặc không tồn tại trả 404 runNotFound và không tạo kết quả

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-21
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** run của user khác trỏ đúng cặp tài liệu của mình (seed DB)
- **Bước:** `POST /match` với run đó; với uuid ngẫu nhiên
- **Mong đợi:** 404 "Match run not found." (Q1); lịch sử match không đổi
- **Automated:** `tests/api/multi-provider-compare/match-pre-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-016 — runId của cặp tài liệu khác trả 400 runDocumentMismatch và không tạo kết quả

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-21
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** run của mình mở cho một CV khác cùng JD
- **Bước:** `POST /match` cặp gốc + run đó
- **Mong đợi:** 400 "This run is for a different pair of documents."; lịch sử không đổi
- **Automated:** `tests/api/multi-provider-compare/match-pre-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-017 — credentialId của người khác trả 404 Credential not found và không tạo kết quả

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-21
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user khác có một credential; run hợp lệ của mình
- **Bước:** `POST /match` với `runId` hợp lệ + credential của người khác; + uuid ngẫu nhiên
- **Mong đợi:** 404 "Credential not found." cả hai; lịch sử không đổi; key của người khác không bao giờ được dùng
- **Automated:** `tests/api/multi-provider-compare/match-pre-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-018 — khách gửi credentialId bị từ chối 403 GUEST_FORBIDDEN_CREDENTIAL

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-34
- **Layer:** api · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** user khách với CV + JD của mình
- **Bước:** `POST /match { …, credentialId: <uuid> }`
- **Mong đợi:** 403 `{ code: "GUEST_FORBIDDEN_CREDENTIAL", message: "Guests can only use the system AI key." }`
- **Automated:** `tests/api/multi-provider-compare/match-pre-ai.api.ts`

## API — provider thật (`@live-ai`)

### TC-MULTIPROVIDERCOMPARE-019 — key hệ thống trả kết quả succeeded đúng hợp đồng và công thức điểm

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-15, REQ-MULTIPROVIDERCOMPARE-22
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`, dev server có `OPENROUTER_API_KEY`
- **Bước:** mở run → `POST /match { …, runId }` không `credentialId` → `GET /match/runs/:id`
- **Mong đợi:** 201 `succeeded`, `errorCode: null`, `provider: openrouter`, `credentialId: null`, ba điểm nguyên 0–100, `overall = round(0.6 × semantic + 0.4 × keyword)`, báo cáo có nội dung; run liệt kê đúng kết quả đó
- **Automated:** `tests/api/multi-provider-compare/live-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-020 — key bị provider từ chối thành kết quả failed trong run, provider khác vẫn thành công

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-15, REQ-MULTIPROVIDERCOMPARE-18, REQ-MULTIPROVIDERCOMPARE-22
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`; credential OpenRouter mang key giả
- **Bước:** trong cùng run: `POST /match` bằng credential đó, rồi bằng key hệ thống → `GET /match/runs/:id`
- **Mong đợi:** lần 1 là 201 `failed`, `errorCode: invalid_key` (thuộc tập đóng), điểm 0, báo cáo rỗng, body không chứa key; lần 2 `succeeded`; run có 2 kết quả phân biệt bằng `credentialId`
- **Automated:** `tests/api/multi-provider-compare/live-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-021 — CV tiếng Việt phù hợp được điểm cao hơn CV tiếng Việt không liên quan

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-35
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`; JD tiếng Việt (backend NestJS), CV tiếng Việt phù hợp, CV tiếng Việt đầu bếp
- **Bước:** `POST /match` cho từng cặp bằng key hệ thống
- **Mong đợi:** cả hai `succeeded`, công thức điểm đúng; CV phù hợp có `overallScore` và `keywordScore` cao hơn
- **Automated:** `tests/api/multi-provider-compare/live-ai.api.ts`

### TC-MULTIPROVIDERCOMPARE-022 — lỗi cấu hình trả 503 và không tạo kết quả

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-16
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** server Match CV riêng không có `OPENROUTER_API_KEY` (rồi không có `CREDENTIAL_ENCRYPTION_KEY`)
- **Bước:** `POST /match` hợp lệ bằng key hệ thống; bằng một credential
- **Mong đợi:** 503 "Matching service is not configured. Please contact the administrator."; 503 "Credential storage is not configured. Please contact the administrator."; không có dòng kết quả
- **Automated:** manual — cần một server khởi động thiếu biến môi trường; dev server dùng chung có cấu hình đủ và không được khởi động lại (Q12)

## UI — bước 3: chọn provider

### TC-MULTIPROVIDERCOMPARE-023 — mỗi credential và key hệ thống có một checkbox tới được bằng Tab và bật tắt được bằng Space

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-01
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng có 1 credential Gemini
- **Bước:** dán JD, CV → bước 3; focus checkbox credential → Tab → Space → Space
- **Mong đợi:** 2 checkbox (credential, System key); credential được chọn sẵn; Tab tới System key; Space bật rồi tắt
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-024 — danh sách checkbox là một nhóm có tên Run with

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-01, REQ-MULTIPROVIDERCOMPARE-32
- **Layer:** e2e · **Priority:** P2
- **Bước:** bước 3 với 1 credential
- **Mong đợi:** có `role="group"` tên "Run with" chứa đủ 2 checkbox
- **Kiểm chứng thêm:** đã sửa — [BUG-MULTIPROVIDERCOMPARE-05](../defects/multi-provider-compare.md#bug-multiprovidercompare-05)
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-025 — bỏ chọn hết thì Run match bị khoá, báo chọn ít nhất một key và không gửi request nào

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-02
- **Layer:** e2e · **Priority:** P1
- **Bước:** bước 3 → bỏ tick mọi dòng → bấm (cưỡng bức) Run match
- **Mong đợi:** nút disabled; dòng quyền riêng tư = "Select at least one key to run the match."; không dòng nào tự được tick lại; không `POST /match/runs` / `POST /match`; vẫn ở bước 3
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-026 — nút chạy nói rõ số provider sẽ chạy

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-03
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 2 credential
- **Bước:** chọn 1 → 2 → 3 dòng (biên 1 / 2 / 3)
- **Mong đợi:** "Run match" → "Run match · 2 providers" → "Run match · 3 providers"
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-027 — thông báo quyền riêng tư nêu provider của mọi credential đã chọn

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-04
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** credential Gemini rồi OpenAI
- **Bước:** chọn đúng hai credential
- **Mong đợi:** "Your CV and JD text will be sent to: OpenAI, Google Gemini." (nhãn lấy từ `GET /ai-credentials/providers`, theo thứ tự dòng)
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-028 — thông báo quyền riêng tư nêu OpenRouter cho key hệ thống

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-04
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user không có credential (key hệ thống là lựa chọn mặc định duy nhất)
- **Mong đợi:** dòng quyền riêng tư có chữ "OpenRouter"
- **Kiểm chứng thêm:** đã sửa — [BUG-MULTIPROVIDERCOMPARE-04](../defects/multi-provider-compare.md#bug-multiprovidercompare-04) (mục key hệ thống đọc "OpenRouter (system key)", Q13)
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-029 — khách không thấy khối chọn và chạy đúng một card bằng key hệ thống

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-05
- **Layer:** e2e · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** trình duyệt không có phiên (khách được mint ở `POST /documents`)
- **Bước:** dán JD, CV → bước 3 → Run match
- **Mong đợi:** không có "Run with" hay checkbox nào; nút là "Run match"; đúng 1 card, đúng 1 `POST /match` mang `runId` và không có `credentialId`
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-030 — khách được báo tài liệu sẽ gửi tới OpenRouter trước khi chạy

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-05
- **Layer:** e2e · **Priority:** P1 · **Tags:** @creates-data
- **Bước:** khách tới bước 3
- **Mong đợi:** thấy "Your CV and JD text will be sent to OpenRouter using the system key."
- **Kiểm chứng thêm:** đã sửa — [BUG-MULTIPROVIDERCOMPARE-03](../defects/multi-provider-compare.md#bug-multiprovidercompare-03)
- **Automated:** `tests/e2e/multi-provider-compare/provider-selection.e2e.ts`

## UI — mở run

### TC-MULTIPROVIDERCOMPARE-031 — Run match mở run và sang bước 4 trước khi AI trả lời

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-06
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** `POST /match` (key hệ thống) trả sau 4 s
- **Bước:** bước 3 → Run match
- **Mong đợi:** `POST /match/runs` 201; bước 4 active trong khi card vẫn đang chạy (tiêu đề "System key", chưa có điểm, request chưa được trả lời); request của card mang `runId` vừa mở; sau đó điểm hiện
- **Automated:** `tests/e2e/multi-provider-compare/run-start.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-032 — bấm Run match hai lần nhanh chỉ mở một run

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-06
- **Layer:** e2e · **Priority:** P1
- **Bước:** double-click Run match
- **Mong đợi:** đúng 1 `POST /match/runs`, đúng 1 `POST /match`
- **Automated:** `tests/e2e/multi-provider-compare/run-start.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-033 — mở run lỗi thì ở lại bước 3 với thông báo của server

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-07, REQ-MULTIPROVIDERCOMPARE-32
- **Layer:** e2e · **Priority:** P1
- **Bước:** tới bước 3 → xoá JD qua API (như bị xoá ở tab khác) → Run match
- **Mong đợi:** `role="alert"` "Document not found or does not belong to you."; vẫn ở "Review documents"; bước 4 không active; không `POST /match`
- **Automated:** `tests/e2e/multi-provider-compare/run-start.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-034 — đổi JD sau khi chạy thì bước 4 bị khoá cho tới khi chạy lại

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-28
- **Layer:** e2e · **Priority:** P1
- **Bước:** chạy xong → bấm stepper về bước 1 → dán JD khác → Next
- **Mong đợi:** đang ở bước 2; chấm bước 4 `aria-disabled="true"`, không còn nút nhảy tới bước 4
- **Automated:** `tests/e2e/multi-provider-compare/run-start.e2e.ts`

## UI — bước 4: N card hiện dần

### TC-MULTIPROVIDERCOMPARE-035 — hai provider cho hai card theo thứ tự danh sách, tiêu đề lấy từ chính kết quả

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-09, REQ-MULTIPROVIDERCOMPARE-12
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** credential Gemini; stub: credential → `gemini · gemini-2.5-flash` 71; key hệ thống → `openai · stub-model-x` 84
- **Bước:** tick System key trước rồi credential → Run match
- **Mong đợi:** 2 card; card 1 "Google Gemini · gemini-2.5-flash" (71), card 2 "OpenAI · stub-model-x" (84) — thứ tự dòng, tiêu đề theo kết quả
- **Kiểm chứng thêm:** đã sửa — [BUG-MULTIPROVIDERCOMPARE-06](../defects/multi-provider-compare.md#bug-multiprovidercompare-06)
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-036 — mỗi card gửi đúng một POST /match cùng runId, key hệ thống không gửi credentialId

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-10
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** chọn credential + System key → Run match
- **Mong đợi:** đúng 2 `POST /match`: `{ cvDocumentId, jdDocumentId, runId, credentialId }` và `{ cvDocumentId, jdDocumentId, runId }`; không `GET /match/runs/:id` nào (không polling)
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-037 — card nhanh hiện kết quả trong khi card chậm còn đang chạy

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** credential trả sau 6 s, key hệ thống trả ngay
- **Mong đợi:** card key hệ thống hiện 88%; card credential vẫn "Running…" không có điểm; rồi hiện 55%
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-038 — card đang chạy được đánh dấu aria-busy

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-11, REQ-MULTIPROVIDERCOMPARE-32
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** key hệ thống trả sau 8 s
- **Mong đợi:** card đang chạy có `aria-busy="true"`
- **Kiểm chứng thêm:** đã sửa — [BUG-MULTIPROVIDERCOMPARE-01](../defects/multi-provider-compare.md#bug-multiprovidercompare-01)
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-039 — mọi request của run cùng chờ một lúc

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-14
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 2 credential + key hệ thống, mỗi stub trả sau 2,5 s
- **Mong đợi:** 3 card có điểm; tại một thời điểm có đủ 3 request đang chờ (song song, run ≈ provider chậm nhất)
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-040 — một provider: báo cáo mở sẵn với ba điểm phần trăm

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-12, REQ-MULTIPROVIDERCOMPARE-13
- **Layer:** e2e · **Priority:** P1
- **Bước:** chỉ key hệ thống (biên N = 1) → Run match
- **Mong đợi:** meter Overall / Semantic / Keyword = 80 / 90 / 65 và chữ "80%", "90%", "65%"; strengths / gaps / suggestions hiện sẵn; không có "Show full report"
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-041 — hai provider: báo cáo gập trong Show full report, điểm vẫn hiện

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-13
- **Layer:** e2e · **Priority:** P1
- **Bước:** credential + key hệ thống (biên N = 2) → Run match → mở báo cáo card 1
- **Mong đợi:** mỗi card hiện điểm và "Show full report", báo cáo ẩn; mở card 1 thì chỉ card 1 hiện báo cáo
- **Automated:** `tests/e2e/multi-provider-compare/progressive-results.e2e.ts`

## UI — lỗi từng phần

### TC-MULTIPROVIDERCOMPARE-042 — một provider lỗi thì card khác vẫn giữ kết quả

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-18
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** credential → 201 `failed` `no_quota`; key hệ thống → 91
- **Mong đợi:** card 1 alert "This key has no quota left with the provider."; card 2 đủ 3 điểm, 91%, không có alert
- **Automated:** `tests/e2e/multi-provider-compare/partial-failure.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-043 — mỗi errorCode hiện câu riêng, không thành điểm 0% hay mã lỗi thô

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-17, REQ-MULTIPROVIDERCOMPARE-32
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** 4 credential + key hệ thống, mỗi card một `errorCode` (`invalid_key`, `no_quota`, `model_unavailable`, `timeout`, `unreachable`)
- **Mong đợi:** mỗi card có `role="alert"` đúng câu của mã đó và nút Try again, không meter; vùng kết quả không có "0%" và không có mã thô
- **Automated:** `tests/e2e/multi-provider-compare/partial-failure.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-044 — Try again chỉ gửi lại card bị lỗi

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-19
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** credential lỗi `timeout` lần 1, thành công 77 lần 2; key hệ thống 64
- **Bước:** Run match → Try again trên card lỗi
- **Mong đợi:** card 1 hiện 77%, card 2 giữ 64%; credential được gửi 2 lần, key hệ thống 1 lần
- **Automated:** `tests/e2e/multi-provider-compare/partial-failure.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-045 — lỗi HTTP của một card hiện trạng thái lỗi có Try again, card khác không bị ảnh hưởng

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-20
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** `POST /match` của credential trả 404 "Credential not found."; key hệ thống 58
- **Mong đợi:** card 1 có alert + Try again, không meter; card 2 hiện 58%
- **Automated:** `tests/e2e/multi-provider-compare/partial-failure.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-046 — lỗi HTTP của một card hiện message của server

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-20
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** như TC-045
- **Mong đợi:** alert card 1 chứa "Credential not found." (không phải "Could not reach the provider.")
- **Kiểm chứng thêm:** đã sửa — [BUG-MULTIPROVIDERCOMPARE-02](../defects/multi-provider-compare.md#bug-multiprovidercompare-02)
- **Automated:** `tests/e2e/multi-provider-compare/partial-failure.e2e.ts`

## UI — tải lại và mở lại run

### TC-MULTIPROVIDERCOMPARE-047 — tải lại giữa lúc chạy không gửi lại POST /match và về bước 1

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-24
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** key hệ thống trả sau 10 s
- **Bước:** Run match → khi card còn chạy, F5
- **Mong đợi:** 0 `POST /match` sau reload; bước 1 active, không có vùng kết quả (Q2)
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-048 — mở /wizard?runId hiện kết quả đã lưu, không gửi POST /match và bỏ runId khỏi URL

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-25, REQ-MULTIPROVIDERCOMPARE-12
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** run seed có 2 kết quả: gemini 72 (t1), openrouter 64 (t2)
- **Bước:** mở `/wizard?runId=<id>`
- **Mong đợi:** bước 4 active, 2 card theo thứ tự lưu với tiêu đề và điểm từ kết quả; URL không còn `runId`; 0 `POST /match`
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-049 — trong lúc đọc run hiện khung chờ aria-busy

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-25
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `GET /match/runs/:id` bị giữ 3 s rồi đi backend thật
- **Mong đợi:** khung `aria-busy="true"` hiện trong lúc đọc, biến mất khi card hiện
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-050 — runId không tồn tại báo No run to show và về bước 1

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-25
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/wizard?runId=<uuid ngẫu nhiên>` (404 thật)
- **Mong đợi:** toast "No run to show. Start a new match."; bước 1 active; URL không còn `runId`
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-051 — đọc run lỗi khác 404 báo We couldn't run the match và về bước 1

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-25
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** `GET /match/runs/:id` trả 500 (stub, Q11)
- **Mong đợi:** toast "We couldn't run the match. Please try again."; bước 1 active
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-052 — run chưa có kết quả hiện Nothing finished yet thay vì màn trống

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-26
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** run seed không có kết quả
- **Mong đợi:** bước 4 active với Alert "Nothing finished yet" + "This run has no results. …"
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-053 — run có lần lỗi và lần thử lại hiện đủ cả hai card theo thứ tự

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-33
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** run seed: key hệ thống lỗi `timeout` (t1), thử lại thành công 81 (t2)
- **Mong đợi:** 2 card: card 1 alert "The provider took too long to answer.", card 2 81% (Q4)
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-054 — đọc lại run ở bước 4 trả 404 thì báo No run to show kèm Start over

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-27, REQ-MULTIPROVIDERCOMPARE-32
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** lần đọc đầu đi backend thật, mọi lần đọc sau trả 404 (stub, Q11)
- **Mong đợi:** `role="alert"` "No run to show. Start a new match." và nút "Start over" (sau ~7 s client thử lại)
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-055 — đọc lại run ở bước 4 lỗi 500 thì báo We couldn't run the match kèm Start over

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-27
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** như TC-054 nhưng 500
- **Mong đợi:** `role="alert"` "We couldn't run the match. Please try again." và "Start over"
- **Automated:** `tests/e2e/multi-provider-compare/reload-and-reopen.e2e.ts`

## UI — card cho user và khách

### TC-MULTIPROVIDERCOMPARE-056 — card thành công có Improve my CV và Write cover letter, không có Compare khi CV chưa có bản trước

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-29
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** có "Improve my CV", "Write cover letter"; không có "Compare versions"
- **Automated:** `tests/e2e/multi-provider-compare/card-actions.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-057 — Compare versions hiện khi CV có phiên bản trước

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-29
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** run seed trên CV có `parentId`, một kết quả
- **Bước:** mở `/wizard?runId=`
- **Mong đợi:** card có "Compare versions"
- **Automated:** `tests/e2e/multi-provider-compare/card-actions.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-058 — trên mobile mỗi action cao ít nhất 44px và rộng hết card

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-29
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** project `app-mobile` (390 px); các project khác skip
- **Mong đợi:** 3 action cao ≥ 44 px, rộng ≥ chiều rộng card trừ padding
- **Automated:** `tests/e2e/multi-provider-compare/card-actions.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-059 — card của khách không có action nào

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-29
- **Layer:** e2e · **Priority:** P1 · **Tags:** @creates-data
- **Mong đợi:** card khách hiện 70% nhưng không có "Improve my CV", "Write cover letter", "Compare versions"
- **Automated:** `tests/e2e/multi-provider-compare/card-actions.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-060 — khách hết lượt thì card hiện cổng đăng nhập hết lượt

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-30
- **Layer:** e2e · **Priority:** P1 · **Tags:** @creates-data
- **Tiền điều kiện:** `POST /match` trả 429 `GUEST_QUOTA_EXCEEDED`, `limit: 5`
- **Mong đợi:** card hiện "You have used today's 5 free matches", không điểm; không có khung "Kept for 24 hours"
- **Automated:** `tests/e2e/multi-provider-compare/card-actions.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-061 — khung giữ 24 giờ chỉ hiện khi đã có card thành công

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-30
- **Layer:** e2e · **Priority:** P2 · **Tags:** @creates-data
- **Tiền điều kiện:** khách; key hệ thống lỗi `unreachable` lần 1, thành công 74 lần 2
- **Bước:** Run match → Try again
- **Mong đợi:** khi card lỗi: không có "Kept for 24 hours, then deleted"; sau khi thành công: khung hiện
- **Automated:** `tests/e2e/multi-provider-compare/card-actions.e2e.ts`

## UI — tiếng Việt

### TC-MULTIPROVIDERCOMPARE-062 — bước 3 và bước 4 hiện tiếng Việt, không lộ key thô

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-31
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** credential Gemini lỗi `no_quota`; key hệ thống thành công sau 3 s
- **Bước:** bước 3 → `setLanguage("vi")` → chọn cả hai → Run match
- **Mong đợi:** "Chạy bằng", "Chạy so khớp · 2 provider", "Nội dung CV và JD của bạn sẽ được gửi tới: Google Gemini, OpenRouter (key hệ thống)." (Q13); card chờ "Key hệ thống"; alert "Key này đã hết hạn mức ở nhà cung cấp.", "Thử lại", "Xem báo cáo đầy đủ"; không chuỗi dạng `result.xxx` / `credentials.xxx`
- **Automated:** `tests/e2e/multi-provider-compare/i18n.e2e.ts`

### TC-MULTIPROVIDERCOMPARE-063 — run chưa có kết quả hiện trạng thái rỗng bằng tiếng Việt

- **Requirement:** REQ-MULTIPROVIDERCOMPARE-31
- **Layer:** e2e · **Priority:** P2
- **Bước:** mở run rỗng → `setLanguage("vi")`
- **Mong đợi:** "Chưa có kết quả nào" + câu gợi ý bản vi; không key thô
- **Automated:** `tests/e2e/multi-provider-compare/i18n.e2e.ts`
