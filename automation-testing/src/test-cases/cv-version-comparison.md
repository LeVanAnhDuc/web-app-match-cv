# CVVERSIONCOMPARISON — So sánh phiên bản CV

Dữ liệu: mọi case seed `Document` / `MatchResult` / `MatchRun` thẳng vào DB dev cho một user đăng nhập riêng của từng
test (fixture `cvcSeed`), rồi chạy **live** cả API lẫn UI (quyết định Q1). Trình duyệt chỉ stub 5xx, mất mạng và phản hồi
chậm; `POST /match` luôn bị chặn bằng stub ở các case UI chạm wizard (D1). Thứ tự dưới đây theo 6 lăng kính: truy vết →
phân vùng → biên → trạng thái → đoán lỗi → bảo mật.

## API — quyền truy cập

### TC-CVVERSIONCOMPARISON-001 — khách và người chưa đăng nhập nhận 401 SIGN_IN_REQUIRED ở cả hai endpoint

- **Requirement:** REQ-CVVERSIONCOMPARISON-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** cặp v1 → v2 đã match; một session khách
- **Bước:** `GET /comparisons/<v2>` và `PATCH /documents/<v2>/parent {parentId:null}` không cookie, rồi bằng cookie khách
- **Mong đợi:** cả 4 lần → 401 `{ code: "SIGN_IN_REQUIRED", message: auth.errors.signInRequired }`
- **Kiểm chứng thêm:** `parentId` của v2 vẫn là v1
- **Automated:** `tests/api/cv-version-comparison/access.api.ts`

### TC-CVVERSIONCOMPARISON-002 — CV và tài liệu của user khác trả 404 như không tồn tại

- **Requirement:** REQ-CVVERSIONCOMPARISON-04
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user B có cặp v1 → v2 đã match
- **Bước:** user A gọi `GET /comparisons/<v2 của B>`, `GET /comparisons/<uuid ngẫu nhiên>`, `PATCH /documents/<v2 của B>/parent`
- **Mong đợi:** 404 `comparison.errors.documentNotFound`, message giống hệt id không tồn tại, body không chứa tiêu đề của B; PATCH → 404
- **Kiểm chứng thêm:** lineage của B không đổi
- **Automated:** `tests/api/cv-version-comparison/access.api.ts`

### TC-CVVERSIONCOMPARISON-003 — bản trước thuộc user khác bị từ chối giống hệt id không tồn tại

- **Requirement:** REQ-CVVERSIONCOMPARISON-04, REQ-CVVERSIONCOMPARISON-23
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `PATCH /documents/<của tôi>/parent` với `parentId` = CV của user khác, rồi = uuid ngẫu nhiên
- **Mong đợi:** cả hai 400 `documents.errors.lineageParentNotFound`, cùng message; `parentId` vẫn null
- **Automated:** `tests/api/cv-version-comparison/access.api.ts`

### TC-CVVERSIONCOMPARISON-004 — JD của user khác ở jdDocumentId trả 400 jdNotComparable và không lộ dữ liệu

- **Requirement:** REQ-CVVERSIONCOMPARISON-04
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /comparisons/<v2>?jdDocumentId=<JD của user khác>`
- **Mong đợi:** 400 `comparison.errors.jdNotComparable`; body không chứa tiêu đề JD của người kia
- **Automated:** `tests/api/cv-version-comparison/access.api.ts`

## API — hợp đồng GET /comparisons

### TC-CVVERSIONCOMPARISON-005 — so sánh hai phiên bản trả delta, gap diff và số phiên bản

- **Requirement:** REQ-CVVERSIONCOMPARISON-05, REQ-CVVERSIONCOMPARISON-09, REQ-CVVERSIONCOMPARISON-10, REQ-CVVERSIONCOMPARISON-12
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** v1 (61/70/48, gap reworded + closed) → v2 (75/78/71, gap reworded + introduced) trên cùng JD
- **Bước:** `GET /comparisons/<v2>`
- **Mong đợi:** 200; `base{v1,1}`, `revision{v2,2}`, `jdOptions=[{jd,hasBase,hasRevision}]`, `delta {14,8,23}`, gapDiff 1 closed / 1 persisted (nguyên văn 2 câu) / 1 introduced, `sameChatModel = sameEmbedModel = true`
- **Automated:** `tests/api/cv-version-comparison/comparison-contract.api.ts`

### TC-CVVERSIONCOMPARISON-006 — response không chứa raw text, file, errorCode hay key

- **Requirement:** REQ-CVVERSIONCOMPARISON-05
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `GET /comparisons/<v2>`, duyệt mọi key ở mọi tầng
- **Mong đợi:** không key `rawText`, `fileData`, `fileMime`, `errorCode`, `encryptedKey`, `apiKey`, `key`, `userId`; body không chứa rawText của CV/JD
- **Automated:** `tests/api/cv-version-comparison/comparison-contract.api.ts`

### TC-CVVERSIONCOMPARISON-007 — documentId sai lớp trả đúng mã lỗi và message

- **Requirement:** REQ-CVVERSIONCOMPARISON-06
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /comparisons/` với `not-a-uuid`, uuid không tồn tại, id của JD, id của CV không có cha
- **Mong đợi:** 400 · 404 `documentNotFound` · 400 `notCv` · 400 `noParent`
- **Automated:** `tests/api/cv-version-comparison/comparison-contract.api.ts`

### TC-CVVERSIONCOMPARISON-008 — jdDocumentId không hợp lệ bị từ chối, không âm thầm đổi JD

- **Requirement:** REQ-CVVERSIONCOMPARISON-06
- **Layer:** api · **Priority:** P1
- **Bước:** `?jdDocumentId=` = `not-a-uuid`, uuid ngẫu nhiên, JD của mình chưa match
- **Mong đợi:** 400; hai ca sau 400 `jdNotComparable` (không trả 200 với JD khác)
- **Automated:** `tests/api/cv-version-comparison/comparison-contract.api.ts`

### TC-CVVERSIONCOMPARISON-009 — bản gốc bị xoá biến so sánh thành noParent

- **Requirement:** REQ-CVVERSIONCOMPARISON-06
- **Layer:** api · **Priority:** P2
- **Bước:** v1 → v2 chưa match; `DELETE /documents/<v1>` (204), rồi `GET /comparisons/<v2>`
- **Mong đợi:** 400 `noParent` (cha bị xoá ⇒ `parentId` thành null, không có link treo)
- **Automated:** `tests/api/cv-version-comparison/comparison-contract.api.ts`

### TC-CVVERSIONCOMPARISON-010 — message lỗi so sánh theo ngôn ngữ của request

- **Requirement:** REQ-CVVERSIONCOMPARISON-27
- **Layer:** api · **Priority:** P1
- **Bước:** 4 lớp lỗi (`documentNotFound`, `notCv`, `noParent`, `jdNotComparable`) với `Accept-Language: vi`
- **Mong đợi:** message = `server/src/i18n/vi/comparison.json`
- **Automated:** `tests/api/cv-version-comparison/comparison-contract.api.ts`

## API — chọn kết quả, delta, phiên bản

### TC-CVVERSIONCOMPARISON-011 — jdOptions liệt kê mọi JD đã match, mới nhất trước, gồm JD chưa lưu, cờ đúng

- **Requirement:** REQ-CVVERSIONCOMPARISON-07
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** JD "cả hai" (cũ nhất), JD "chỉ bản gốc" (chưa lưu), JD "chỉ bản mới" (mới nhất), JD chỉ có row failed
- **Mong đợi:** `jdOptions` = [chỉ bản mới, chỉ bản gốc, cả hai] với cờ đúng; JD chỉ có row failed không xuất hiện
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-012 — JD mặc định là JD mới nhất đủ hai bên, rồi JD đầu danh sách, rồi null

- **Requirement:** REQ-CVVERSIONCOMPARISON-07
- **Layer:** api · **Priority:** P1
- **Bước:** ba cặp: có JD đủ hai bên cũ hơn một JD một bên · không JD nào đủ · chưa match gì
- **Mong đợi:** chọn JD đủ hai bên · chọn JD mới nhất, `revisionResult=null` · `jdDocumentId=null`, `jdOptions=[]`, mọi kết quả null
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-013 — jdDocumentId hợp lệ được dùng đúng JD đó

- **Requirement:** REQ-CVVERSIONCOMPARISON-07
- **Layer:** api · **Priority:** P1
- **Bước:** hai JD đều đủ hai bên; ghim JD cũ hơn
- **Mong đợi:** `jdDocumentId` = JD được ghim, delta tính trên JD đó (+10/+10/+10)
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-014 — lần match failed không bao giờ được chọn

- **Requirement:** REQ-CVVERSIONCOMPARISON-08
- **Layer:** api · **Priority:** P1
- **Bước:** thêm row `failed` 0/0/0 mới hơn cho cả hai bản
- **Mong đợi:** vẫn dùng row succeeded: overall 61 → 75, delta +14
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-015 — bản gốc ưu tiên lần match cùng model, không có thì lấy mới nhất và báo khác model

- **Requirement:** REQ-CVVERSIONCOMPARISON-08, REQ-CVVERSIONCOMPARISON-09
- **Layer:** api · **Priority:** P1
- **Bước:** bản gốc có row cùng model (cũ) và row khác chat model (mới) · cặp thứ hai bản gốc chỉ có row khác embed model
- **Mong đợi:** chọn row cùng model, `same* = true` · chọn row mới nhất, `sameEmbedModel=false`
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-016 — thiếu một bên thì delta và gapDiff là null, không bịa số 0

- **Requirement:** REQ-CVVERSIONCOMPARISON-09
- **Layer:** api · **Priority:** P1
- **Bước:** CV con mới của v1, chưa match; `GET /comparisons/<con>`
- **Mong đợi:** `revisionResult=null`, `delta=null`, `gapDiff=null`, `same*=true`, JD của bản gốc vẫn trong `jdOptions` (`hasRevision=false`)
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-017 — bản mới kém hơn cho delta âm có dấu

- **Requirement:** REQ-CVVERSIONCOMPARISON-09
- **Layer:** api · **Priority:** P2
- **Bước:** điểm 100/0/50 → 0/100/50 (biên 0 và 100)
- **Mong đợi:** `delta = {-100, +100, 0}`
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-018 — số phiên bản suy từ chuỗi parentId, đúng tới 21 phiên bản và không treo khi dài hơn

- **Requirement:** REQ-CVVERSIONCOMPARISON-10
- **Layer:** api · **Priority:** P2
- **Bước:** chuỗi 3 (mở v3), chuỗi 21 (mở v21, đúng biên 20 bước), chuỗi 22 (mở v22, quá biên)
- **Mong đợi:** 2 → 3 · 20 → 21 · 200 (không treo, không 5xx)
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

### TC-CVVERSIONCOMPARISON-019 — endpoint so sánh chỉ chịu throttle global

- **Requirement:** REQ-CVVERSIONCOMPARISON-11
- **Layer:** api · **Priority:** P2
- **Mong đợi:** header `X-RateLimit-Limit: 100` (không có throttle AI chặt hơn)
- **Automated:** `tests/api/cv-version-comparison/result-selection.api.ts`

## API — ghép gap

### TC-CVVERSIONCOMPARISON-020 — gap được ghép theo chủ đề, giữ nguyên văn, kể cả tiếng Việt không dấu

- **Requirement:** REQ-CVVERSIONCOMPARISON-12
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** base [CI/CD cũ, AWS, "Thiếu kinh nghiệm Docker"], revision ["Chua co kinh nghiem Docker", Azure, CI/CD mới]
- **Mong đợi:** closed [AWS], introduced [Azure], persisted đúng 2 cặp nguyên văn (CI/CD, Docker có/không dấu)
- **Automated:** `tests/api/cv-version-comparison/gap-diff.api.ts`

### TC-CVVERSIONCOMPARISON-021 — mỗi bên chỉ xét tối đa 50 gap

- **Requirement:** REQ-CVVERSIONCOMPARISON-12
- **Layer:** api · **Priority:** P2
- **Bước:** bản gốc có 51 gap khác chủ đề, bản mới 0 gap
- **Mong đợi:** `baseResult.gaps` = 50 gap đầu; `closed` có 50 phần tử, không chứa gap thứ 51
- **Automated:** `tests/api/cv-version-comparison/gap-diff.api.ts`

## API — khai báo lineage

### TC-CVVERSIONCOMPARISON-022 — khai báo rồi gỡ liên kết phiên bản trước

- **Requirement:** REQ-CVVERSIONCOMPARISON-22, REQ-CVVERSIONCOMPARISON-26
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `PATCH {parentId: v1}` rồi `PATCH {parentId: null}`
- **Mong đợi:** 200 `DocumentDto` có `parentId = v1`, rồi 200 `parentId = null`; DB khớp
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-023 — body hoặc id không hợp lệ trả 400 và không âm thầm gỡ liên kết

- **Requirement:** REQ-CVVERSIONCOMPARISON-22
- **Layer:** api · **Priority:** P1
- **Bước:** body `{}`, `{parentId:"not-a-uuid"}`, `{parentId:42}`, `{parentId:""}`; `:id = not-a-uuid`
- **Mong đợi:** tất cả 400; `parentId` của v2 vẫn là v1
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-024 — tự trỏ, khác loại, tạo vòng, cha không tồn tại đều bị từ chối và giữ nguyên lineage

- **Requirement:** REQ-CVVERSIONCOMPARISON-23
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** chuỗi v1 → v2 → v3 và một JD
- **Bước:** v2→v2 · v2→JD · JD→v1 · v1→v2 · v1→v3 · v2→uuid ngẫu nhiên
- **Mong đợi:** 400 với message `lineageSelf` · `lineageKindMismatch` ×2 · `lineageCycle` ×2 · `lineageParentNotFound`; mọi `parentId` không đổi
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-025 — cha có đúng 20 tài liệu trong chuỗi được nhận, 21 bị từ chối lineageTooDeep

- **Requirement:** REQ-CVVERSIONCOMPARISON-23
- **Layer:** api · **Priority:** P2
- **Bước:** nối CV mới vào đuôi chuỗi 20 (đúng biên), rồi vào đuôi chuỗi 21 (trên biên)
- **Mong đợi:** 200 · 400 `lineageTooDeep`, `parentId` vẫn null
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-026 — danh sách thư viện trả parentId của từng tài liệu

- **Requirement:** REQ-CVVERSIONCOMPARISON-22
- **Layer:** api · **Priority:** P1
- **Bước:** `GET /documents?kind=CV&saved=true`
- **Mong đợi:** v1 `parentId=null`, v2 `parentId=v1`
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-027 — vòng đời lineage phản ánh ngay ở so sánh

- **Requirement:** REQ-CVVERSIONCOMPARISON-26
- **Layer:** api · **Priority:** P1
- **Bước:** so sánh (400) → đặt cha → so sánh (200, base = v1) → gỡ → so sánh
- **Mong đợi:** lần cuối 400 `noParent`
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-028 — message lỗi lineage theo ngôn ngữ của request

- **Requirement:** REQ-CVVERSIONCOMPARISON-27
- **Layer:** api · **Priority:** P1
- **Bước:** 5 lớp `lineage*` với `Accept-Language: vi`
- **Mong đợi:** message = `server/src/i18n/vi/documents.json`
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

### TC-CVVERSIONCOMPARISON-029 — mỗi lớp lỗi 400 trả code máy đọc được riêng

- **Requirement:** REQ-CVVERSIONCOMPARISON-06, REQ-CVVERSIONCOMPARISON-23
- **Layer:** api · **Priority:** P1
- **Bước:** gây 8 lớp 400: `notCv`, `noParent`, `jdNotComparable`, `lineageSelf`, `lineageParentNotFound`, `lineageKindMismatch`, `lineageCycle`, `lineageTooDeep`
- **Mong đợi:** mỗi body có `code` là chuỗi không rỗng, 8 code khác nhau — đã sửa: [BUG-CVVERSIONCOMPARISON-02](../defects/cv-version-comparison.md#bug-cvversioncomparison-02)
- **Automated:** `tests/api/cv-version-comparison/lineage.api.ts`

## API — provider thật (@live-ai)

### TC-CVVERSIONCOMPARISON-030 — hai lần match thật cho delta và gap diff khớp kết quả đã lưu

- **Requirement:** REQ-CVVERSIONCOMPARISON-09, REQ-CVVERSIONCOMPARISON-12
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Bước:** `POST /match` thật cho v1 và v2 (tiếng Anh) trên cùng JD, rồi `GET /comparisons/<v2>`
- **Mong đợi:** mỗi kết quả succeeded, điểm 0–100, `overall = round(0.6×semantic + 0.4×keyword)`; comparison dùng đúng hai kết quả đó, `delta` = hiệu điểm, mỗi gap của mỗi bên nằm đúng một nhóm, nguyên văn; cùng model
- **Automated:** `tests/api/cv-version-comparison/live-ai.api.ts`

### TC-CVVERSIONCOMPARISON-031 — so sánh hai phiên bản CV tiếng Việt chấm bằng provider thật

- **Requirement:** REQ-CVVERSIONCOMPARISON-12
- **Layer:** api · **Priority:** P2 · **Tags:** @live-ai
- **Bước:** như TC-030 với CV/JD tiếng Việt; v2 thêm Docker, CI/CD, PostgreSQL, TypeScript
- **Mong đợi:** như TC-030; `keywordScore` của v2 ≥ v1
- **Automated:** `tests/api/cv-version-comparison/live-ai.api.ts`

## UI — điểm vào

### TC-CVVERSIONCOMPARISON-032 — thư viện CV chỉ mời so sánh ở CV có bản trước và mở đúng trang so sánh

- **Requirement:** REQ-CVVERSIONCOMPARISON-01
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `/cv` → Actions của v1 → Actions của v2 → "Compare versions"
- **Mong đợi:** v1 chỉ có "Mark as a new version of…"; v2 có cả hai; URL `/compare/<v2>` (không `?jd`), hiện Version 1 / Version 2
- **Automated:** `tests/e2e/cv-version-comparison/entry-points.e2e.ts`

### TC-CVVERSIONCOMPARISON-033 — thư viện JD không bao giờ mời so sánh, kể cả JD có bản trước

- **Requirement:** REQ-CVVERSIONCOMPARISON-01
- **Layer:** e2e · **Priority:** P1
- **Bước:** `/jd` → Actions của JD gốc và JD có `parentId`
- **Mong đợi:** cả hai có "Mark as a new version of…", không có "Compare versions"
- **Automated:** `tests/e2e/cv-version-comparison/entry-points.e2e.ts`

### TC-CVVERSIONCOMPARISON-034 — card kết quả step 4 của CV có bản trước mời so sánh, đứng cuối, mở kèm JD

- **Requirement:** REQ-CVVERSIONCOMPARISON-02
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** run lưu sẵn của v2 (có cha) trên JD; `/wizard?runId=` đọc kết quả đã lưu
- **Mong đợi:** nút theo thứ tự Improve my CV · Write cover letter · Compare versions; bấm → `/compare/<v2>?jd=<jd>`, JD đó được chọn sẵn; không có `POST /match`
- **Automated:** `tests/e2e/cv-version-comparison/entry-points.e2e.ts`

### TC-CVVERSIONCOMPARISON-035 — card kết quả step 4 không có nút so sánh khi CV chưa có bản trước hoặc người xem là khách

- **Requirement:** REQ-CVVERSIONCOMPARISON-02
- **Layer:** e2e · **Priority:** P1
- **Bước:** run của CV gốc (user) · run của CV có cha (khách)
- **Mong đợi:** không có "Compare versions" ở cả hai (user vẫn có Write cover letter)
- **Automated:** `tests/e2e/cv-version-comparison/entry-points.e2e.ts`

### TC-CVVERSIONCOMPARISON-036 — người chưa đăng nhập thấy cổng đăng nhập và không có request so sánh nào

- **Requirement:** REQ-CVVERSIONCOMPARISON-03
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** xoá cookie, mở `/compare/<v2>`
- **Mong đợi:** heading `gate.compare`, không có tiêu đề trang so sánh, 0 request `/comparisons`
- **Automated:** `tests/e2e/cv-version-comparison/entry-points.e2e.ts`

## UI — báo cáo so sánh

### TC-CVVERSIONCOMPARISON-037 — trang so sánh có tiêu đề, phụ đề, Version 1 → Version 2 và tên hai bản

- **Requirement:** REQ-CVVERSIONCOMPARISON-13
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** `compare.title`, `compare.subtitle`, "Version 1", "Version 2", "<v1> → <v2>"
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-038 — mỗi khối điểm hiện điểm bản mới, thanh meter và delta có dấu đọc được

- **Requirement:** REQ-CVVERSIONCOMPARISON-15
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** Overall 75% +14, Semantic 78% +8, Keyword 71% +23; meter `aria-valuenow` = điểm mới; không hiện điểm cũ 61; 3 câu screen reader `compare.delta.up`
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-039 — delta âm in dấu trừ, delta 0 không có dấu cộng

- **Requirement:** REQ-CVVERSIONCOMPARISON-15
- **Layer:** e2e · **Priority:** P1
- **Bước:** 70/50/50 → 64/50/51 (−1, 0, +1 quanh biên 0)
- **Mong đợi:** `-6`, `0`, `+1`; mỗi hướng down / flat / up một câu screen reader
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-040 — delta biên +100 và -100 hiển thị trọn trong khối

- **Requirement:** REQ-CVVERSIONCOMPARISON-15
- **Layer:** e2e · **Priority:** P2
- **Bước:** 0/100/50 → 100/0/50
- **Mong đợi:** `+100`, `-100`, `0`; meter 100 và 0; mỗi khối nằm trọn trong viewport (desktop / tablet / mobile)
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-041 — gap được chia ba nhóm có số đếm, giữ nguyên văn, nhóm còn tồn tại hiện cả hai câu

- **Requirement:** REQ-CVVERSIONCOMPARISON-19
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Mong đợi:** thẻ `compare.gaps.title` + caveat; heading Closed (1) / Still open (1) / New (1); list có accessible name chứa đúng gap; Still open có cả câu cũ và câu mới, không `[object Object]`
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-042 — nhóm gap rỗng ghi rõ là không có

- **Requirement:** REQ-CVVERSIONCOMPARISON-19
- **Layer:** e2e · **Priority:** P2
- **Bước:** cả hai bản 0 gap
- **Mong đợi:** 3 lần `compare.gaps.none`, heading (0)
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-043 — hai lần match khác model bị cảnh báo và delta ghi không so được

- **Requirement:** REQ-CVVERSIONCOMPARISON-16
- **Layer:** e2e · **Priority:** P1
- **Bước:** chat model khác nhau
- **Mong đợi:** Alert `compare.modelWarning.title` nêu cả hai chat model; 3 lần `readout.notComparable`, không số delta
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-044 — chỉ khác embedding model thì cảnh báo nêu đúng hai embedding model

- **Requirement:** REQ-CVVERSIONCOMPARISON-16
- **Layer:** e2e · **Priority:** P2
- **Bước:** cùng chat model, embed model khác nhau
- **Mong đợi:** cảnh báo + "Not comparable"; hint chứa tên hai embedding model — đã sửa: [BUG-CVVERSIONCOMPARISON-01](../defects/cv-version-comparison.md#bug-cvversioncomparison-01)
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-045 — phiên bản chưa match có lời mời match, không có ô điểm nào

- **Requirement:** REQ-CVVERSIONCOMPARISON-17
- **Layer:** e2e · **Priority:** P1
- **Bước:** bản mới chưa match · bản gốc chưa match
- **Mong đợi:** Alert `compare.missing.revision` / `compare.missing.base` + hint + "Match this version"; 0 meter, 0 số delta
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-046 — nút Match this version mở wizard ở bước Review với đúng CV và JD, không tự chạy match

- **Requirement:** REQ-CVVERSIONCOMPARISON-17, REQ-CVVERSIONCOMPARISON-11
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** URL `/wizard`, bước "Review documents" với nút "Run match", preview là raw text của bản còn thiếu và của JD; 0 `POST /match`
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-047 — chưa phiên bản nào được match thì có trạng thái rỗng dẫn tới wizard

- **Requirement:** REQ-CVVERSIONCOMPARISON-18
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** Alert `compare.empty.title` + hint; không Select, không meter; "Go to the wizard" → `/wizard`
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-048 — chuỗi ba thế hệ hiển thị Version 2 → Version 3

- **Requirement:** REQ-CVVERSIONCOMPARISON-10
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** "Version 2", "Version 3", không "Version 1"
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

### TC-CVVERSIONCOMPARISON-049 — markup trong gap và tiêu đề hiện dạng chữ, raw text không lên trang

- **Requirement:** REQ-CVVERSIONCOMPARISON-21
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** tiêu đề bản gốc chứa `<img onerror>`, gap chứa `<script>`
- **Mong đợi:** cả hai hiện nguyên văn; không có `<script>` chứa marker, `window.__cvcPwned` không tồn tại; HTML trang không chứa raw text của hai CV
- **Automated:** `tests/e2e/cv-version-comparison/comparison-report.e2e.ts`

## UI — chọn JD

### TC-CVVERSIONCOMPARISON-050 — đổi JD ghi vào URL và giữ nguyên sau khi tải lại

- **Requirement:** REQ-CVVERSIONCOMPARISON-14
- **Layer:** e2e · **Priority:** P1
- **Bước:** mặc định JD mới nhất (+14/+8/+23) → chọn JD cũ → F5
- **Mong đợi:** URL `?jd=<JD cũ>`, delta +10 ×3, giữ sau F5; request gửi `jdDocumentId=<JD cũ>`
- **Automated:** `tests/e2e/cv-version-comparison/jd-selector.e2e.ts`

### TC-CVVERSIONCOMPARISON-051 — mở thẳng link có jd thì JD đó được chọn sẵn

- **Requirement:** REQ-CVVERSIONCOMPARISON-14
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** JD trong URL là giá trị của Select, delta +10 ×3
- **Automated:** `tests/e2e/cv-version-comparison/jd-selector.e2e.ts`

### TC-CVVERSIONCOMPARISON-052 — duyệt màn so sánh không bao giờ gửi request match

- **Requirement:** REQ-CVVERSIONCOMPARISON-11
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** mở trang → đổi JD → F5
- **Mong đợi:** 0 request `POST /match*` hoặc `POST /cv-rewrite*`
- **Automated:** `tests/e2e/cv-version-comparison/jd-selector.e2e.ts`

## UI — lỗi và đang tải

### TC-CVVERSIONCOMPARISON-053 — CV không tồn tại báo không tìm thấy và có nút về thư viện

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `compare.err.notFound`; "Back to the library" → `/cv`
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

### TC-CVVERSIONCOMPARISON-054 — CV chưa khai bản trước báo rõ lý do

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `compare.err.noParent` + nút về thư viện
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

### TC-CVVERSIONCOMPARISON-055 — JD được ghim nhưng không so được thì báo đúng lý do

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `compare.err.jdNotComparable` + nút về thư viện
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

### TC-CVVERSIONCOMPARISON-056 — lỗi server hoặc mất kết nối hiện thông báo chung, không trang trắng

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P1
- **Bước:** stub 500, rồi abort kết nối
- **Mong đợi:** cả hai `compare.err.failed`, tiêu đề trang và nút về thư viện vẫn hiện
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

### TC-CVVERSIONCOMPARISON-057 — đang tải hiện skeleton aria-busy rồi kết quả trong vùng aria-live

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P2
- **Bước:** trả body thật trễ 2 s
- **Mong đợi:** `[aria-busy="true"]` hiện, rồi khối điểm trong `[aria-live="polite"]`, busy biến mất
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

### TC-CVVERSIONCOMPARISON-058 — JD được ghim trên CV chưa có bản trước vẫn báo là chưa có bản trước

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P2
- **Bước:** `/compare/<CV gốc>?jd=<JD đã match>` (server trả 400 `noParent`)
- **Mong đợi:** `compare.err.noParent` — đã sửa: [BUG-CVVERSIONCOMPARISON-03](../defects/cv-version-comparison.md#bug-cvversioncomparison-03)
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

### TC-CVVERSIONCOMPARISON-059 — mở so sánh bằng id của JD không bị báo nhầm là chưa có bản trước

- **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Layer:** e2e · **Priority:** P2
- **Bước:** `/compare/<id của JD>` (server trả 400 `notCv`)
- **Mong đợi:** có thông báo lỗi, không phải `compare.err.noParent` hay `jdNotComparable` — đã sửa: [BUG-CVVERSIONCOMPARISON-03](../defects/cv-version-comparison.md#bug-cvversioncomparison-03)
- **Automated:** `tests/e2e/cv-version-comparison/errors-and-loading.e2e.ts`

## UI — hộp thoại lineage

### TC-CVVERSIONCOMPARISON-060 — khai báo bản trước trong hộp thoại làm hiện lối so sánh

- **Requirement:** REQ-CVVERSIONCOMPARISON-24, REQ-CVVERSIONCOMPARISON-25, REQ-CVVERSIONCOMPARISON-26
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `/cv` → v2 → "Mark as a new version of…" → chọn v1 → Save → Actions v2 → "Compare versions"
- **Mong đợi:** toast `library.lineage.success`, modal đóng, DB `parentId = v1`; "Compare versions" xuất hiện và mở `/compare/<v2>` (Version 1 → Version 2)
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-061 — gỡ liên kết làm mất lối so sánh và trang so sánh báo chưa có bản trước

- **Requirement:** REQ-CVVERSIONCOMPARISON-26, REQ-CVVERSIONCOMPARISON-25
- **Layer:** e2e · **Priority:** P1
- **Bước:** modal của v2 → xoá lựa chọn (×) → Save → Actions v2 → mở `/compare/<v2>`
- **Mong đợi:** toast thành công, `parentId = null`, không còn "Compare versions"; trang so sánh báo `compare.err.noParent`
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-062 — hộp thoại chỉ liệt kê tài liệu đã lưu cùng loại khác chính nó và chọn sẵn bản trước hiện tại

- **Requirement:** REQ-CVVERSIONCOMPARISON-24
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** Parent, Target (cha = Parent), Other (đã lưu), Unsaved (chưa lưu), một JD
- **Mong đợi:** mô tả có tên Target; Parent chọn sẵn; danh sách có Parent, Other, không có Target / Unsaved / JD; modal của Other hiện placeholder `library.lineage.placeholder`
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-063 — nút Lưu bị khoá khi chưa đổi gì và không gửi request

- **Requirement:** REQ-CVVERSIONCOMPARISON-24
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở modal của v1 (không cha) và v2 (có cha), không đổi gì
- **Mong đợi:** Save disabled ở cả hai; 0 `PATCH /parent`
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-064 — double-click Lưu chỉ gửi đúng một PATCH

- **Requirement:** REQ-CVVERSIONCOMPARISON-24
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** đúng 1 `PATCH` với body `{parentId: v1}`, toast thành công, DB khớp
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-065 — liên kết tạo vòng bị từ chối, hộp thoại vẫn mở và giữ lựa chọn

- **Requirement:** REQ-CVVERSIONCOMPARISON-25
- **Layer:** e2e · **Priority:** P1
- **Bước:** modal của v1 → chọn v2 (con của v1) → Save (server 400 `lineageCycle`)
- **Mong đợi:** Alert `library.lineage.rejected` trong modal; modal mở; v2 vẫn được chọn; `parentId` v1 vẫn null
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-066 — lỗi server khi lưu báo không lưu được và giữ hộp thoại

- **Requirement:** REQ-CVVERSIONCOMPARISON-25
- **Layer:** e2e · **Priority:** P2
- **Bước:** stub `PATCH /parent` → 500
- **Mong đợi:** Alert `library.lineage.failed`, lựa chọn còn, Save bật lại
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-067 — chuỗi phiên bản quá dài bị từ chối với đúng lý do

- **Requirement:** REQ-CVVERSIONCOMPARISON-25, REQ-CVVERSIONCOMPARISON-23
- **Layer:** e2e · **Priority:** P2
- **Bước:** chọn đuôi một chuỗi 21 CV làm bản trước (server 400 `lineageTooDeep`)
- **Mong đợi:** Alert trong modal, modal mở, `parentId` không đổi; nội dung **không** phải câu "tự trỏ / bản mới hơn" `library.lineage.rejected` — đã sửa: [BUG-CVVERSIONCOMPARISON-04](../defects/cv-version-comparison.md#bug-cvversioncomparison-04)
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-068 — Esc đóng hộp thoại mà không lưu

- **Requirement:** REQ-CVVERSIONCOMPARISON-28
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** chọn một bản rồi `Esc` → modal đóng, 0 PATCH, `parentId` không đổi
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-069 — mở hộp thoại đưa focus vào Select và đóng trả focus về nút Actions

- **Requirement:** REQ-CVVERSIONCOMPARISON-28
- **Layer:** e2e · **Priority:** P2
- **Mong đợi:** khi mở, combobox "Previous version" có focus; `Esc` → focus về nút Actions của hàng đó — đã sửa: [BUG-CVVERSIONCOMPARISON-05](../defects/cv-version-comparison.md#bug-cvversioncomparison-05)
- **Automated:** `tests/e2e/cv-version-comparison/lineage-dialog.e2e.ts`

### TC-CVVERSIONCOMPARISON-070 — Select JD dùng được bằng bàn phím và Tab đi tiếp tới nút hành động

- **Requirement:** REQ-CVVERSIONCOMPARISON-28, REQ-CVVERSIONCOMPARISON-14
- **Layer:** e2e · **Priority:** P2
- **Bước:** focus Select → ArrowDown → ArrowUp → Enter; mở lại với JD chỉ có bản mới, focus Select → Tab
- **Mong đợi:** URL đổi sang JD vừa chọn; `Tab` đưa focus tới "Match this version"
- **Automated:** `tests/e2e/cv-version-comparison/jd-selector.e2e.ts`

## UI — tiếng Việt

### TC-CVVERSIONCOMPARISON-071 — trang so sánh hiển thị đủ tiếng Việt, không lộ key thô

- **Requirement:** REQ-CVVERSIONCOMPARISON-27
- **Layer:** e2e · **Priority:** P1
- **Bước:** mở `/compare/<v2>`, đổi sang `vi` qua `window.__i18n`
- **Mong đợi:** tiêu đề, phụ đề, Phiên bản 1/2, nhãn JD, meter, câu screen reader, thẻ gap, caveat, 3 nhóm đều theo `vi`; `<main>` không chứa key thô `compare.*` / `readout.*`…
- **Automated:** `tests/e2e/cv-version-comparison/i18n.e2e.ts`

### TC-CVVERSIONCOMPARISON-072 — trạng thái lỗi, cổng đăng nhập, menu thư viện và hộp thoại lineage có tiếng Việt

- **Requirement:** REQ-CVVERSIONCOMPARISON-27
- **Layer:** e2e · **Priority:** P1
- **Mong đợi:** `compare.err.noParent` + "Về thư viện"; menu "So sánh phiên bản" / "Khai báo là phiên bản mới của…"; modal "Lịch sử phiên bản" với mô tả, nhãn, Lưu, Huỷ theo `vi`; cổng `gate.compare` theo `vi`
- **Automated:** `tests/e2e/cv-version-comparison/i18n.e2e.ts`
