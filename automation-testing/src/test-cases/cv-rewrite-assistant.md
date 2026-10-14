# CVREWRITEASSISTANT — Test case

Requirement: `src/docs/requirements/cv-rewrite-assistant.md` · Quyết định: `src/docs/decisions/cv-rewrite-assistant.md`.
UI spec stub riêng `POST /cv-rewrite` (D1), mọi request khác đi backend thật trên dữ liệu seed (fixture `rewriteData`).
Các kịch bản của `docs/specs/cv-rewrite-assistant/e2e.md` (gom về lúc scaffold) đã chuyển thành TC dưới đây: row 1 →
TC-032/034/056/051/064, row 4 → TC-053/057, row 5 → TC-052/054/049, row 6 → TC-057, row 8 → TC-062, row 9 → TC-063,
row 10 → TC-044/045/046, row 11 → TC-055/061/059, row 12 → TC-064; AuthZ BE → TC-003/004.

## API — quyền truy cập (`tests/api/cv-rewrite-assistant/access.api.ts`)

### TC-CVREWRITEASSISTANT-001 — người chưa đăng nhập bị từ chối ở cả sinh lẫn lưu

- **Requirement:** REQ-CVREWRITEASSISTANT-04
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** `POST /cv-rewrite { matchResultId: <uuid> }`; `POST /cv-rewrite/accept` với body hợp lệ
- **Mong đợi:** cả hai **401** `{ code: "SIGN_IN_REQUIRED", message: auth.errors.signInRequired }`
- **Automated:** `tests/api/cv-rewrite-assistant/access.api.ts`

### TC-CVREWRITEASSISTANT-002 — phiên khách bị từ chối ở cả sinh lẫn lưu

- **Requirement:** REQ-CVREWRITEASSISTANT-04
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user khách có match succeeded của chính mình
- **Bước:** khách gọi generate và accept trên match của mình
- **Mong đợi:** cả hai **401** `SIGN_IN_REQUIRED`; không document nào được tạo
- **Automated:** `tests/api/cv-rewrite-assistant/access.api.ts`

### TC-CVREWRITEASSISTANT-003 — không sinh được đề xuất trên match của người khác

- **Requirement:** REQ-CVREWRITEASSISTANT-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user A có match succeeded; user B đăng nhập
- **Bước:** B `POST /cv-rewrite { matchResultId: <match của A> }`
- **Mong đợi:** **404** `cvRewrite.errors.matchNotFound` (quyết định trước khi gọi AI)
- **Automated:** `tests/api/cv-rewrite-assistant/access.api.ts`

### TC-CVREWRITEASSISTANT-004 — không lưu được bản viết lại từ match của người khác

- **Requirement:** REQ-CVREWRITEASSISTANT-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** như TC-003
- **Bước:** B `POST /cv-rewrite/accept` với thay đổi bám đúng CV của A
- **Mong đợi:** **404** `matchNotFound`; CV của A không có bản con; B không có document nào
- **Automated:** `tests/api/cv-rewrite-assistant/access.api.ts`

### TC-CVREWRITEASSISTANT-005 — credential của người khác hoặc không tồn tại bị từ chối trước khi gọi AI

- **Requirement:** REQ-CVREWRITEASSISTANT-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user A có match succeeded; user B có một credential
- **Bước:** A generate với `credentialId` = credential của B; rồi với một UUID ngẫu nhiên
- **Mong đợi:** cả hai **404** `aiCredentials.errors.notFound`
- **Automated:** `tests/api/cv-rewrite-assistant/access.api.ts`

## API — sinh đề xuất, nhánh trước provider (`tests/api/cv-rewrite-assistant/generate.api.ts`)

### TC-CVREWRITEASSISTANT-006 — match không tồn tại trả 404

- **Requirement:** REQ-CVREWRITEASSISTANT-05, REQ-CVREWRITEASSISTANT-31
- **Layer:** api · **Priority:** P1
- **Bước:** generate với UUID ngẫu nhiên
- **Mong đợi:** **404** `cvRewrite.errors.matchNotFound`
- **Automated:** `tests/api/cv-rewrite-assistant/generate.api.ts`

### TC-CVREWRITEASSISTANT-007 — match thất bại không có gì để viết lại

- **Requirement:** REQ-CVREWRITEASSISTANT-13, REQ-CVREWRITEASSISTANT-33
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** match `status=failed` của chính user
- **Bước:** generate (mặc định), rồi `Accept-Language: vi`, rồi `?lang=vi`
- **Mong đợi:** **400** `cvRewrite.errors.matchFailed` bản en, rồi bản vi ở cả hai cách chọn ngôn ngữ
- **Automated:** `tests/api/cv-rewrite-assistant/generate.api.ts`

### TC-CVREWRITEASSISTANT-008 — body sinh sai kiểu bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-10
- **Layer:** api · **Priority:** P2
- **Bước:** `{}`; `{ matchResultId: "not-a-uuid" }`; `{ matchResultId: <uuid>, credentialId: "nope" }`
- **Mong đợi:** cả ba **400**
- **Automated:** `tests/api/cv-rewrite-assistant/generate.api.ts`

## API — lưu bản viết lại (`tests/api/cv-rewrite-assistant/accept.api.ts`)

### TC-CVREWRITEASSISTANT-009 — lưu tạo CV mới liên kết CV gốc và không đụng CV gốc

- **Requirement:** REQ-CVREWRITEASSISTANT-28, REQ-CVREWRITEASSISTANT-25
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** match succeeded trên CV `CV_TEXT`
- **Bước:** accept một thay đổi bám dòng API
- **Mong đợi:** **201** `DocumentDto` `parentId = CV gốc`, `kind=CV`, `sourceFormat=text`, `isSaved=true`; row mới
  `fileData`/`fileMime` null, cùng chủ; `rawText` có câu mới + dòng không duyệt nguyên văn; CV gốc `rawText` và
  `parentId` không đổi
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-010 — chỉ đoạn được duyệt bị thay, xoá dòng và ký tự `$` giữ nguyên văn

- **Requirement:** REQ-CVREWRITEASSISTANT-16, REQ-CVREWRITEASSISTANT-21, REQ-CVREWRITEASSISTANT-28
- **Layer:** api · **Priority:** P1
- **Bước:** accept `[{ dòng API → "…($& and $` and $')…" }, { dòng migration → "" }]`
- **Mong đợi:** **201**; `rawText` = CV với đúng hai đoạn đó được thay theo nghĩa đen (không thay pattern), phần còn lại y nguyên
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-011 — thay đổi không bám CV bị từ chối và không tạo gì

- **Requirement:** REQ-CVREWRITEASSISTANT-27
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** accept `{ original: "Certified Kubernetes Administrator since 2019" }`
- **Mong đợi:** **400** `changeNotGrounded`; CV gốc không có bản con
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-012 — đoạn neo xuất hiện hai lần bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-16, REQ-CVREWRITEASSISTANT-27
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** CV có dòng API lặp hai lần
- **Mong đợi:** **400** `changeNotGrounded`, không bản con
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-013 — neo 11 ký tự bị từ chối, 12 ký tự được nhận

- **Requirement:** REQ-CVREWRITEASSISTANT-16
- **Layer:** api · **Priority:** P2
- **Bước:** accept neo `"billing sys"` (11); accept neo `"billing syst"` (12)
- **Mong đợi:** 11 → **400** `changeNotGrounded`; 12 → **201**
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-014 — neo khác whitespace vẫn khớp và chỉ thay đúng đoạn nguyên văn

- **Requirement:** REQ-CVREWRITEASSISTANT-17
- **Layer:** api · **Priority:** P1
- **Bước:** (a) neo có xuống dòng + nhiều space so với CV; (b) CV có xuống dòng + nhiều space, neo một dòng chuẩn
- **Mong đợi:** cả hai **201**; văn bản mới = CV với đúng đoạn nguyên văn trong CV bị thay (khoảng trắng phần còn lại giữ nguyên)
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-015 — hai thay đổi chồng lấn bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-27
- **Layer:** api · **Priority:** P1
- **Bước:** accept dòng API + một đoạn con của nó
- **Mong đợi:** **400** `changesOverlap`, không bản con
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-016 — đoạn thay dài đúng 4 lần neo được nhận, dài hơn bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-16, REQ-CVREWRITEASSISTANT-27
- **Layer:** api · **Priority:** P2
- **Bước:** replacement dài `4 × len(neo)`; rồi `4 × len(neo) + 1`
- **Mong đợi:** **201**; rồi **400** `changeTooLong`
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-017 — đoạn thay 1500 ký tự được nhận, 1501 bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-26, REQ-CVREWRITEASSISTANT-16
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** CV có một dòng 400 ký tự (để 4× không chặn trước)
- **Mong đợi:** 1500 → **201**; 1501 → **400**
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-018 — áp thay đổi làm CV rỗng bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-27
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** CV chỉ có một dòng
- **Bước:** accept xoá chính dòng đó
- **Mong đợi:** **400** `emptyResult`, không bản con
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-019 — tên CV mới được trim và giới hạn 1 đến 200 ký tự

- **Requirement:** REQ-CVREWRITEASSISTANT-26
- **Layer:** api · **Priority:** P1
- **Bước:** title `"   "`; `"t"×200`; `"t"×201`; `"  Padded title  "`
- **Mong đợi:** 400; 201; 400; 201 và lưu `"Padded title"`
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-020 — số thay đổi phải từ 1 đến 25

- **Requirement:** REQ-CVREWRITEASSISTANT-26
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** CV 26 dòng, mỗi dòng là một neo duy nhất
- **Mong đợi:** 0 thay đổi → 400; 25 → **201**; 26 → 400
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-021 — body lưu sai kiểu hoặc quá dài bị từ chối

- **Requirement:** REQ-CVREWRITEASSISTANT-26
- **Layer:** api · **Priority:** P2
- **Bước:** `original` 5001 ký tự; `matchResultId: "not-a-uuid"`; thiếu `changes`
- **Mong đợi:** cả ba **400**
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-022 — không lưu được bản viết lại từ match thất bại

- **Requirement:** REQ-CVREWRITEASSISTANT-13
- **Layer:** api · **Priority:** P2
- **Mong đợi:** **400** `matchFailed`, không bản con
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-023 — lỗi grounding trả theo ngôn ngữ của request

- **Requirement:** REQ-CVREWRITEASSISTANT-33
- **Layer:** api · **Priority:** P1
- **Bước:** accept thay đổi bịa với `Accept-Language: vi`; với `?lang=vi`; chồng lấn với `vi`
- **Mong đợi:** message = `cvRewrite.errors.changeNotGrounded` / `changesOverlap` bản vi
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

### TC-CVREWRITEASSISTANT-024 — lỗi trả client không lộ chi tiết nội bộ

- **Requirement:** REQ-CVREWRITEASSISTANT-35, REQ-CVREWRITEASSISTANT-32
- **Layer:** api · **Priority:** P1
- **Bước:** gom body lỗi 400 (grounding, validation), 404 (match lạ), 401
- **Mong đợi:** không body nào có `stack`, dòng `at …(.ts|.js):n`, `prisma`, tên bảng, ciphertext/key
- **Automated:** `tests/api/cv-rewrite-assistant/accept.api.ts`

## API — dòng phiên bản (`tests/api/cv-rewrite-assistant/lineage.api.ts`)

### TC-CVREWRITEASSISTANT-025 — CV gốc đang có lịch sử match không xoá được, bản viết lại giữ nguyên

- **Requirement:** REQ-CVREWRITEASSISTANT-30
- **Layer:** api · **Priority:** P1
- **Bước:** accept → bản con; `DELETE /documents/<CV gốc>`
- **Mong đợi:** **409** `documents.errors.inUseByMatch`; bản con còn, `parentId` vẫn là CV gốc
- **Automated:** `tests/api/cv-rewrite-assistant/lineage.api.ts`

### TC-CVREWRITEASSISTANT-026 — xoá CV cha không kéo theo bản con

- **Requirement:** REQ-CVREWRITEASSISTANT-30
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** CV cha không có match, CV con `parentId` = cha
- **Bước:** `DELETE /documents/<cha>`
- **Mong đợi:** 2xx; bản con còn, `parentId = null`
- **Automated:** `tests/api/cv-rewrite-assistant/lineage.api.ts`

## API — throttle (`tests/api/cv-rewrite-assistant/throttle.api.ts`)

### TC-CVREWRITEASSISTANT-027 — sinh đề xuất giới hạn 10 request mỗi phút

- **Requirement:** REQ-CVREWRITEASSISTANT-15
- **Layer:** api · **Priority:** P1
- **Bước:** đẩy route vào trạng thái chặn, chờ hết chặn, gửi 10 request (match lạ → 404, không chạm AI), gửi request 11
- **Mong đợi:** 10 request đầu không 429; request 11 → **429** có `Retry-After`
- **Automated:** `tests/api/cv-rewrite-assistant/throttle.api.ts`

### TC-CVREWRITEASSISTANT-028 — lưu bản viết lại giới hạn 20 request mỗi phút

- **Requirement:** REQ-CVREWRITEASSISTANT-15
- **Layer:** api · **Priority:** P2
- **Bước:** như TC-027 với `/cv-rewrite/accept`, 20 request rồi request 21
- **Mong đợi:** 20 đầu không 429; request 21 → **429**
- **Automated:** `tests/api/cv-rewrite-assistant/throttle.api.ts`

## API — provider thật (`tests/api/cv-rewrite-assistant/live-ai.api.ts`, chỉ khi `LIVE_AI=1`)

### TC-CVREWRITEASSISTANT-029 — đề xuất thật đúng hợp đồng và mọi thay đổi bám CV

- **Requirement:** REQ-CVREWRITEASSISTANT-12, REQ-CVREWRITEASSISTANT-16, REQ-CVREWRITEASSISTANT-17, REQ-CVREWRITEASSISTANT-18
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Bước:** generate bằng key hệ thống trên match succeeded (CV tiếng Anh)
- **Mong đợi:** **201** đúng bộ field; mỗi `original` là đoạn nguyên văn, duy nhất, ≥ 12 ký tự trong CV; `replacement` ≤ 1500
  và ≤ 4× neo; sắp theo vị trí, `id` 0..n-1; `sectionHint` ≤ 60 hoặc null; `rationale`/`addressesGap` ≤ 300;
  `unaddressedGaps` ≤ 25 mục, mỗi mục 1..300; không chuỗi key nào
- **Automated:** `tests/api/cv-rewrite-assistant/live-ai.api.ts`

### TC-CVREWRITEASSISTANT-030 — CV tiếng Việt: đề xuất thật trích nguyên văn tiếng Việt

- **Requirement:** REQ-CVREWRITEASSISTANT-16, REQ-CVREWRITEASSISTANT-17
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Mong đợi:** như TC-029 trên CV/JD/gaps tiếng Việt (dấu giữ nguyên trong `original`)
- **Automated:** `tests/api/cv-rewrite-assistant/live-ai.api.ts`

### TC-CVREWRITEASSISTANT-031 — đề xuất thật lưu được nguyên vẹn qua accept

- **Requirement:** REQ-CVREWRITEASSISTANT-25, REQ-CVREWRITEASSISTANT-27
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Bước:** generate thật → accept toàn bộ thay đổi
- **Mong đợi:** **201**, văn bản mới chứa mọi `replacement` khác rỗng (bỏ qua nếu model không đề xuất gì)
- **Automated:** `tests/api/cv-rewrite-assistant/live-ai.api.ts`

## UI — điểm vào (`tests/e2e/cv-rewrite-assistant/entry-points.e2e.ts`)

### TC-CVREWRITEASSISTANT-032 — card kết quả thành công mở trợ lý viết lại

- **Requirement:** REQ-CVREWRITEASSISTANT-01
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** một run của user e2e gồm một kết quả succeeded và một kết quả failed
- **Bước:** mở `/wizard?runId=<run>` → bấm "Improve my CV"
- **Mong đợi:** đúng **một** nút "Improve my CV" (card failed không có); tới `/cv-rewrite/<id kết quả succeeded>`, thấy tiêu đề trang
- **Automated:** `tests/e2e/cv-rewrite-assistant/entry-points.e2e.ts`

### TC-CVREWRITEASSISTANT-033 — card kết quả của khách không có nút viết lại

- **Requirement:** REQ-CVREWRITEASSISTANT-01
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** khách có run với một kết quả succeeded; tab mang cookie khách
- **Mong đợi:** card hiện điểm, không có "Improve my CV"
- **Automated:** `tests/e2e/cv-rewrite-assistant/entry-points.e2e.ts`

### TC-CVREWRITEASSISTANT-034 — mở lại match từ Recent matches thấy đúng một card có nút viết lại

- **Requirement:** REQ-CVREWRITEASSISTANT-02
- **Layer:** e2e · **Priority:** P1
- **Bước:** Home → bấm dòng "<CV> × <JD>" vừa seed → bấm "Improve my CV"
- **Mong đợi:** step 4 với một card (không "No run to show"), một nút "Improve my CV", tới `/cv-rewrite/<id>`
- **Automated:** `tests/e2e/cv-rewrite-assistant/entry-points.e2e.ts`

### TC-CVREWRITEASSISTANT-035 — người chưa đăng nhập mở thẳng trang thấy cổng đăng nhập

- **Requirement:** REQ-CVREWRITEASSISTANT-03
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** tab không cookie
- **Mong đợi:** heading `gate.cvRewrite` + `gate.description`; không heading trang; không request nào tới match /
  documents / ai-credentials / cv-rewrite
- **Automated:** `tests/e2e/cv-rewrite-assistant/entry-points.e2e.ts`

### TC-CVREWRITEASSISTANT-036 — khách mở thẳng trang thấy cổng đăng nhập

- **Requirement:** REQ-CVREWRITEASSISTANT-03
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** tab mang cookie khách, khách có match succeeded
- **Mong đợi:** như TC-035
- **Automated:** `tests/e2e/cv-rewrite-assistant/entry-points.e2e.ts`

## UI — trang & sinh đề xuất (`tests/e2e/cv-rewrite-assistant/generate.e2e.ts`)

### TC-CVREWRITEASSISTANT-037 — trang hiện CV và gaps, chưa sinh gì trước khi bấm

- **Requirement:** REQ-CVREWRITEASSISTANT-06, REQ-CVREWRITEASSISTANT-07
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** mở `/cv-rewrite/<match>`; quan sát; bấm Generate
- **Mong đợi:** h1 `rewrite.title`, phụ đề, h2 "Rewrite "<tên CV>"", `rewrite.gapsTitle` + gap của match; 0 request
  `POST /cv-rewrite` trước khi bấm, đúng 1 sau khi bấm và thẻ "Suggested changes" hiện
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-038 — tiêu đề setup không lộ placeholder khi CV chưa tải xong

- **Requirement:** REQ-CVREWRITEASSISTANT-06
- **Layer:** e2e · **Priority:** P2
- **Bước:** làm chậm `GET /documents/:id` (backend thật, trễ 3 s); mở trang
- **Mong đợi:** trong lúc chờ: h2 "Rewrite "this CV"", không chuỗi `{{…}}`; sau đó: h2 với tên CV
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-039 — match chạy bằng key hệ thống: mặc định System key và không gửi credentialId

- **Requirement:** REQ-CVREWRITEASSISTANT-08, REQ-CVREWRITEASSISTANT-09, REQ-CVREWRITEASSISTANT-10
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** match `credentialId = null`
- **Mong đợi:** "Run with" hiển thị `credentials.systemKey`; dòng `privacySystem`; không tag chưa test; body POST
  chỉ có `matchResultId`, không có key `credentialId`
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-040 — match chạy bằng credential riêng: chọn sẵn, che key, cảnh báo chưa test

- **Requirement:** REQ-CVREWRITEASSISTANT-08, REQ-CVREWRITEASSISTANT-09, REQ-CVREWRITEASSISTANT-32
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** credential chưa test của user e2e; match chạy bằng nó
- **Mong đợi:** chọn sẵn `"<Provider> · <nhãn> · ••••<last4>"`; tag `untestedWarning`; `privacy` nêu tên provider; body
  gửi `credentialId` đó; HTML trang không chứa ciphertext
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-041 — credential đã test không bị cảnh báo, chuyển sang key hệ thống đổi thông báo

- **Requirement:** REQ-CVREWRITEASSISTANT-08, REQ-CVREWRITEASSISTANT-09, REQ-CVREWRITEASSISTANT-10
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** credential `lastTestStatus=ok`; match chạy bằng nó
- **Bước:** mở trang; chọn "System key"; Generate
- **Mong đợi:** không tag cảnh báo; sau khi đổi: dòng `privacySystem`; body không có `credentialId`
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-042 — đang sinh thì bấm thêm không gửi request thứ hai

- **Requirement:** REQ-CVREWRITEASSISTANT-11
- **Layer:** e2e · **Priority:** P1
- **Bước:** stub sinh trễ 2 s; bấm Generate hai lần liền
- **Mong đợi:** đúng 1 request `POST /cv-rewrite`; đề xuất hiện sau đó
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-043 — vùng chờ khi đang sinh được đánh dấu aria-busy trong vùng aria-live

- **Requirement:** REQ-CVREWRITEASSISTANT-11
- **Layer:** e2e · **Priority:** P2
- **Bước:** stub sinh trễ 2 s; bấm Generate
- **Mong đợi:** trong lúc chờ có phần tử `aria-busy="true"` bên trong vùng `aria-live="polite"`
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-044 — provider lỗi được báo và đề xuất cũ vẫn còn

- **Requirement:** REQ-CVREWRITEASSISTANT-14
- **Layer:** e2e · **Priority:** P1
- **Bước:** lần sinh 1 thành công; lần 2 stub 503
- **Mong đợi:** `rewrite.err.generateFailed`; các thẻ của đề xuất 1 vẫn hiện; nút sinh lại vẫn bấm được
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-045 — match bị xoá ở tab khác được báo rõ khi sinh

- **Requirement:** REQ-CVREWRITEASSISTANT-31
- **Layer:** e2e · **Priority:** P2
- **Bước:** mở trang; stub sinh trả 404 (như server khi match đã bị xoá); Generate
- **Mong đợi:** `rewrite.err.matchNotFound`
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-046 — match không tồn tại hiện lỗi thay vì trang trắng

- **Requirement:** REQ-CVREWRITEASSISTANT-31
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/cv-rewrite/<uuid ngẫu nhiên>` (backend thật trả 404)
- **Mong đợi:** alert `rewrite.err.matchNotFound`; không nút Generate
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

### TC-CVREWRITEASSISTANT-047 — lỗi khác khi tải match hiện thông báo chung

- **Requirement:** REQ-CVREWRITEASSISTANT-31
- **Layer:** e2e · **Priority:** P2
- **Bước:** stub `GET /match/:id` trả 500; mở trang
- **Mong đợi:** alert `err.matchFailed`
- **Automated:** `tests/e2e/cv-rewrite-assistant/generate.e2e.ts`

## UI — duyệt thay đổi (`tests/e2e/cv-rewrite-assistant/review.e2e.ts`)

### TC-CVREWRITEASSISTANT-048 — thẻ thay đổi hiện section, đoạn gốc, đề xuất, lý do và gap

- **Requirement:** REQ-CVREWRITEASSISTANT-19
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** 2 thẻ `group`; thẻ 1: eyebrow "Experience", nhãn `change.original` + dòng API, nhãn `change.suggested` +
  câu mới, lý do, tag gap; thẻ 2 (`addressesGap` null): không tag gap
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-049 — thay đổi xoá dòng được gắn nhãn và không có khối đề xuất

- **Requirement:** REQ-CVREWRITEASSISTANT-19
- **Layer:** e2e · **Priority:** P2
- **Bước:** đề xuất một thay đổi `replacement=""`, `sectionHint=null`
- **Mong đợi:** tag `change.removal`; không nhãn `change.suggested`; eyebrow `change.untitled`
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-050 — mặc định không chọn gì, chọn tất cả và bộ đếm theo số nhiều

- **Requirement:** REQ-CVREWRITEASSISTANT-20
- **Layer:** e2e · **Priority:** P1
- **Bước:** sinh; tick thẻ 1; Select all; bỏ Select all
- **Mong đợi:** ban đầu 0 tick, Save disabled, "0 changes selected"; tick 1 → "1 change selected", Save enabled; Select
  all → cả 2 tick, "2 changes selected"; bỏ → 0 tick, Save disabled
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-051 — xem trước áp đúng các thay đổi đang chọn

- **Requirement:** REQ-CVREWRITEASSISTANT-21
- **Layer:** e2e · **Priority:** P1
- **Bước:** đề xuất thẻ 1 có replacement chứa `$&`, `` $` ``, `$'`; tick thẻ 1; mở "Preview the result"
- **Mong đợi:** preview có replacement nguyên văn, dòng migration nguyên văn, không có câu của thẻ 2
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-052 — đề xuất rỗng nói rõ thay vì danh sách trống

- **Requirement:** REQ-CVREWRITEASSISTANT-22
- **Layer:** e2e · **Priority:** P1
- **Bước:** đề xuất `changes=[]`, `unaddressedGaps=[]`
- **Mong đợi:** `changes.empty` + `emptyHint`; không nút Save; không "Select all"; không cảnh báo unaddressed
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-053 — gap không thể đóng được liệt kê thay vì bịa

- **Requirement:** REQ-CVREWRITEASSISTANT-22
- **Layer:** e2e · **Priority:** P1
- **Bước:** đề xuất 1 thay đổi + `unaddressedGaps` 2 mục
- **Mong đợi:** 1 thẻ; `unaddressed.title` + hint + cả 2 mục
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-054 — match không có gap vẫn mở và nói rõ

- **Requirement:** REQ-CVREWRITEASSISTANT-22
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** match `report.gaps=[]`
- **Mong đợi:** `rewrite.noGaps`; không `gapsTitle`; Generate enabled
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

### TC-CVREWRITEASSISTANT-055 — sinh lại thay đề xuất và bỏ mọi lựa chọn mà không hỏi

- **Requirement:** REQ-CVREWRITEASSISTANT-23
- **Layer:** e2e · **Priority:** P1
- **Bước:** sinh; Select all; "Generate again" (đề xuất 2 khác)
- **Mong đợi:** không dialog xác nhận; thẻ của đề xuất 2 thay đề xuất 1; 0 tick; Save disabled
- **Automated:** `tests/e2e/cv-rewrite-assistant/review.e2e.ts`

## UI — lưu (`tests/e2e/cv-rewrite-assistant/save.e2e.ts`)

### TC-CVREWRITEASSISTANT-056 — sinh, duyệt một phần rồi lưu thành CV mới

- **Requirement:** REQ-CVREWRITEASSISTANT-24, REQ-CVREWRITEASSISTANT-25, REQ-CVREWRITEASSISTANT-28
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** sinh; tick thẻ 1; "Save as new CV"; giữ tên mặc định; Save (accept thật)
- **Mong đợi:** modal `save.title`, tên mặc định `"<CV> (improved)"`, hint; body accept có đúng 1 thay đổi (dòng API);
  `rewrite.save.success`; tới `/cv` và thấy CV mới; DB: một bản con với câu mới + dòng migration nguyên văn
- **Automated:** `tests/e2e/cv-rewrite-assistant/save.e2e.ts`

### TC-CVREWRITEASSISTANT-057 — tên rỗng bị chặn và tên tối đa 200 ký tự

- **Requirement:** REQ-CVREWRITEASSISTANT-24
- **Layer:** e2e · **Priority:** P1
- **Bước:** điền 250 ký tự; xoá trống; Save
- **Mong đợi:** ô giữ 200 ký tự; `save.nameRequired`; không request accept; modal vẫn mở
- **Automated:** `tests/e2e/cv-rewrite-assistant/save.e2e.ts`

### TC-CVREWRITEASSISTANT-058 — tên chỉ có khoảng trắng bị chặn ở client

- **Requirement:** REQ-CVREWRITEASSISTANT-24
- **Layer:** e2e · **Priority:** P1
- **Bước:** điền `"   "`; Save
- **Mong đợi:** `save.nameRequired` trong modal; không request accept; không hiện `rewrite.err.notGrounded`
- **Automated:** `tests/e2e/cv-rewrite-assistant/save.e2e.ts`

### TC-CVREWRITEASSISTANT-059 — lưu bị từ chối giữ modal và các lựa chọn

- **Requirement:** REQ-CVREWRITEASSISTANT-29
- **Layer:** e2e · **Priority:** P1
- **Bước:** đề xuất có thay đổi không bám CV; Select all; Save (backend thật trả 400)
- **Mong đợi:** `rewrite.err.notGrounded`; modal vẫn mở; "Select all" vẫn tick; không bản con
- **Automated:** `tests/e2e/cv-rewrite-assistant/save.e2e.ts`

### TC-CVREWRITEASSISTANT-060 — lỗi máy chủ khi lưu báo thử lại

- **Requirement:** REQ-CVREWRITEASSISTANT-29
- **Layer:** e2e · **Priority:** P2
- **Bước:** stub accept trả 500; Save
- **Mong đợi:** `rewrite.err.saveFailed`; modal vẫn mở; tick còn
- **Automated:** `tests/e2e/cv-rewrite-assistant/save.e2e.ts`

### TC-CVREWRITEASSISTANT-061 — bấm Save hai lần chỉ tạo một CV

- **Requirement:** REQ-CVREWRITEASSISTANT-29
- **Layer:** e2e · **Priority:** P1
- **Bước:** double-click nút Save của modal (accept thật)
- **Mong đợi:** đúng 1 request accept; tới `/cv`; DB đúng 1 bản con
- **Automated:** `tests/e2e/cv-rewrite-assistant/save.e2e.ts`

## UI — dữ liệu, ngôn ngữ, bàn phím (`tests/e2e/cv-rewrite-assistant/quality.e2e.ts`)

### TC-CVREWRITEASSISTANT-062 — nội dung CV hiển thị dạng chữ, không thành markup

- **Requirement:** REQ-CVREWRITEASSISTANT-32
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** CV có dòng `Wrote <script>alert(1)</script> tooling…`
- **Bước:** đề xuất thay dòng đó bằng `Wrote <b>tooling</b>…`; tick; mở preview
- **Mong đợi:** cả hai chuỗi hiện nguyên văn; `<main>` không có phần tử `script` / `b`; không dialog alert
- **Automated:** `tests/e2e/cv-rewrite-assistant/quality.e2e.ts`

### TC-CVREWRITEASSISTANT-063 — toàn bộ luồng hiển thị tiếng Việt

- **Requirement:** REQ-CVREWRITEASSISTANT-33
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở trang; `setLanguage("vi")`; sinh; mở modal lưu
- **Mong đợi:** mọi nhãn (tiêu đề, phụ đề, gaps, Run with, privacy, Sinh gợi ý, Thay đổi đề xuất, Chọn tất cả, nhãn thẻ,
  cảnh báo gap, bộ đếm, Lưu thành CV mới, modal + tên mặc định "(cải thiện)") là bản vi; không chuỗi `{{…}}` hay key thô
- **Automated:** `tests/e2e/cv-rewrite-assistant/quality.e2e.ts`

### TC-CVREWRITEASSISTANT-064 — điều khiển dùng được bằng bàn phím

- **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Layer:** e2e · **Priority:** P1
- **Bước:** focus "Run with" → Tab tới Generate → Enter; Tab tới Select all → từng checkbox thẻ (Space tick) → Tab tới
  Save → Enter; Esc
- **Mong đợi:** mỗi điều khiển được focus theo thứ tự đó; Space tick checkbox; Enter mở modal; Esc đóng modal
- **Automated:** `tests/e2e/cv-rewrite-assistant/quality.e2e.ts`

### TC-CVREWRITEASSISTANT-065 — checkbox của các thay đổi có tên truy cập phân biệt

- **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** 2 thay đổi cùng `sectionHint="Experience"`
- **Mong đợi:** mỗi checkbox có tên truy cập khác rỗng và hai tên khác nhau
- **Automated:** `tests/e2e/cv-rewrite-assistant/quality.e2e.ts`

### TC-CVREWRITEASSISTANT-066 — mở modal lưu thì focus vào ô tên

- **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** ngay khi modal mở, ô "Document name" đang được focus
- **Automated:** `tests/e2e/cv-rewrite-assistant/quality.e2e.ts`

### TC-CVREWRITEASSISTANT-067 — luồng chuẩn không có lỗi JS hay response 5xx

- **Requirement:** REQ-CVREWRITEASSISTANT-35
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở trang → sinh → tick → preview → lưu (accept thật)
- **Mong đợi:** không `pageerror`; không `console.error` ngoài cảnh báo dev của React/antd; không response ≥ 500
- **Automated:** `tests/e2e/cv-rewrite-assistant/quality.e2e.ts`

## Manual

### TC-CVREWRITEASSISTANT-068 — log máy chủ không chứa nội dung CV hay key

- **Requirement:** REQ-CVREWRITEASSISTANT-35
- **Layer:** manual · **Priority:** P2
- **Bước:** chạy TC-056 và TC-029 với dev server ở log mặc định; đọc log
- **Mong đợi:** không dòng nào chứa văn bản CV, replacement hay API key
- **Automated:** manual — suite không đọc được stdout của dev server qua HTTP

### TC-CVREWRITEASSISTANT-069 — lọc lúc sinh loại thay đổi bịa và cắt chuỗi model viết

- **Requirement:** REQ-CVREWRITEASSISTANT-16, REQ-CVREWRITEASSISTANT-18
- **Layer:** manual · **Priority:** P2
- **Bước:** đọc kết quả unit test server `server/src/modules/cv-rewrite/grounding.spec.ts` (`groundChanges`, `clipGaps`)
- **Mong đợi:** phần tử bịa / trùng / ngắn / chồng lấn / phình / không phải object bị bỏ; chỉ xét 25 phần tử đầu; cắt
  60 / 300 / 25 × 300; mục rỗng bị bỏ
- **Automated:** manual — cần phản hồi model do test dựng; qua HTTP chỉ có provider thật (không tất định, D1). Bất biến
  đầu ra được TC-029 kiểm live, các luật dùng chung với accept được TC-011…018 kiểm tất định
