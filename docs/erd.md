# ERD — web-app-match-cv

> Sơ bộ tại brainstorm `cv-jd-matching-wizard` (2026-07-14). Chi tiết field/type chốt ở `writing-plans` + sync với Prisma schema khi scaffold `server/`. DB: **PostgreSQL** (pgvector **defer** — chưa bật extension nào, xem ADR #5b).
> Cập nhật 2026-08-06 (brainstorm Goal 6 — BYO AI credentials): thêm `AiCredential` + `MatchRun`, mở rộng `User` + `MatchResult`. **Các phần đánh dấu 📝 SPEC là spec chưa implement** — ERD mới hơn code, phải flag ở `writing-plans` khi làm.
> Cập nhật 2026-08-08 (Goal 8/9/10 — `specs/goals-8-9-10/design.md`): thêm `Document.parentId` (lineage, Goal 9) + model `DataDisclosure` (Goal 10). Goal 8 không đổi ERD. Đổi số roadmap batch ranking #7 → **#11**.
> Cập nhật 2026-08-08 (feature `ai-credentials` — **đã merge**): `AiCredential` **đã implement**, `MatchResult` nhận 4 cột snapshot (`credentialId`/`provider`/`chatModel`/`embedModel`). `MatchRun` + `runId`/`status`/`errorCode` **vẫn 📝** — chúng chỉ có nghĩa khi một lần chạy sinh nhiều kết quả, tức Roadmap #9 (multi-provider compare).
> Cập nhật 2026-08-09 (feature `cv-version-comparison` — Roadmap #7): **không đổi schema** — Goal 9 tiêu thụ `Document.parentId` sẵn có. Chốt: **không thêm cột `version`** (suy từ chuỗi `parentId`, xem Notes) và lineage khai báo thủ công được qua `PATCH /documents/:id/parent`. `DocumentSummaryDto` thêm `parentId` (DTO, không phải schema).
> Cập nhật 2026-08-09 (feature `cv-rewrite-assistant` — Roadmap #6): `Document.parentId` **đã implement** (migration `add_document_parent`, self-FK `ON DELETE SET NULL`, ADR #15). Mục "Generated content 📝" **đã chốt phương án (a)** — không thêm model, xem cuối file.
> Cập nhật 2026-08-08 (đồng bộ doc ↔ code): xác nhận lại **đúng 4 model đang tồn tại trong `server/prisma/schema.prisma`** — `User`, `Document`, `MatchResult` (bản rút gọn), và **không có** `MatchRun` / `AiCredential`. Bỏ model `Job` khỏi kế hoạch (ADR #12 — "Recruiter đăng Job" + "Apply flow" đã loại khỏi roadmap). Thêm ghi chú Goal 7 (CV rewrite + cover letter) ở cuối.
> Cập nhật 2026-08-09 (feature `cover-letter-generator`, Roadmap #8 / Goal 7b): thêm model **`CoverLetter`** + 4 enum (`CoverLetterTone`/`Length`/`Language`/`Status`), migration `add_cover_letter`. Đóng open question "cover letter có lưu không" — **có lưu, bảng riêng**. Mục "Generated content" gộp lại: **hai nửa Goal 7 chốt ngược hướng nhau, có chủ ý** — 7a không thêm model (đề xuất không lưu), 7b có bảng riêng (mọi lần sinh đều lưu); tiêu chí phân biệt là **output có chảy tiếp vào hệ thống hay không**.

## Trạng thái implement (đối chiếu `server/prisma/schema.prisma`, 2026-08-08 — sau feature `ai-credentials`)

| Model | Trong ERD | Trong Prisma | Ghi chú |
|---|---|---|---|
| `User` | ✅ | 🟡 **một phần** | Có `id`/`role`/`externalSub`/`createdAt`. **Thiếu**: `isMock`, `email`, `fullName`, `avatar`, `phone`, `updatedAt` (tất cả đánh 📝) |
| `Document` | ✅ | ✅ **đủ** | Kể cả `fileData`/`fileMime` (feature `home-dashboard-library`) và `parentId` (Roadmap **#6**, migration `add_document_parent`) |
| `MatchResult` | ✅ | ✅ **đủ** | Scores + `report` + FK cv/jd, `credentialId`/`provider`/`chatModel`/`embedModel` (Roadmap #4), và `runId`/`status`/`errorCode` (Roadmap #9) |
| `MatchRun` | ✅ | ✅ **đủ** | Roadmap **#9** đã merge — migration `add_match_run` |
| `AiCredential` | ✅ | ✅ **đủ** | Roadmap **#4** đã merge — migration `add_ai_credential`, kèm enum `AiProvider` + `AiTestStatus` |
| ~~`Job`~~ | ❌ | ❌ | **Không làm** — ADR #12 |
| `DataDisclosure` 📝 | ✅ | ❌ **chưa có** | Chỉ tạo khi làm Roadmap #5 (Goal 10) |
| `CoverLetter` | ✅ | ✅ **đủ** | Roadmap **#8** (Goal 7b) — migration `add_cover_letter`, kèm 4 enum `CoverLetter*` |

> **Goal 8 (tiếng Việt) KHÔNG đổi ERD** — thuần logic trong `matching.service.ts`. Nhưng có **script chạy một lần** tính lại `keywordScore` + `overallScore` cho `MatchResult` đã lưu (không tốn call AI: `rawText` còn, `semanticScore` đã lưu).

## Module groups

- **Identity**: `User` (mock user khi chưa auth — xem `project-goals.md` §3)
- **Documents**: `Document` (CV | JD, per-user, reusable)
- **Matching**: `MatchRun` + `MatchResult`
- **AI credentials**: `AiCredential` (token AI của user, mã hoá at-rest)
- **Privacy** 📝 *(Goal 10)*: `DataDisclosure` (nhật ký tài liệu đã gửi tới provider nào)
- **Generated content** *(Goal 7)*: hai nửa lưu **khác nhau, có chủ ý** — CV rewrite (7a) **không có model riêng** (bản đã duyệt → `Document` mới có `parentId`; bản đề xuất không lưu); cover letter (7b) có bảng riêng **`CoverLetter`**, mỗi lần sinh một row. Xem cuối file.

## Schema

### User (mock user khi chưa auth — SSO-ready)

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| role | enum(candidate, recruiter, admin) | |
| externalSub | text (nullable) | subject từ IdP store-app (điền khi SSO) |
| isMock | boolean 📝 | default `false`. `true` = mock user dùng khi chưa đăng nhập (`00000000-…-0001`, seed idempotent). Clean data: `DELETE FROM users WHERE is_mock = true` cascade |
| email | text (nullable) 📝 | **mirror** claim từ IdP — không phải source of truth |
| fullName | text (nullable) 📝 | mirror claim |
| avatar | text (nullable) 📝 | mirror claim |
| phone | text (nullable) 📝 | mirror claim |
| createdAt | timestamptz | |
| updatedAt | timestamptz 📝 | phục vụ re-sync profile mỗi lần login |

> **KHÔNG có** bảng credential/password ở đây — `store-app` (IdP) sở hữu `Authentication` + `OAuthConsent`; match-cv chỉ link qua `externalSub` (`project-goals.md` ADR #7).

### Document

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | **per-user isolation** |
| kind | enum(CV, JD) | |
| title | text | tên hiển thị (cho radio-select reuse) |
| sourceFormat | enum(pdf, docx, text) | |
| rawText | text | text sau parse |
| parsedContent | jsonb (nullable) | structured — **null ở Plan 1** (chỉ dùng rawText) |
| fileData | bytea (nullable) | **binary file gốc** (PDF/DOCX) để preview/download; `null` với doc paste-text. Chỉ phục vụ qua `GET /documents/:id/file` (per-user), KHÔNG expose trong JSON DTO |
| fileMime | text (nullable) | mimetype file gốc (`application/pdf` \| docx mime); `null` với paste-text |
| ~~embedding~~ | ~~vector~~ | **CHƯA implement** — pgvector defer; semantic tính embedding on-the-fly + cosine in-app (Plan 2), không lưu vector |
| isSaved | boolean | true = lưu tái dùng; false = transient session |
| parentId | uuid (FK → Document, nullable) | **lineage (Goal 9 — implemented ở Roadmap #6)** — bản này là phiên bản mới của tài liệu nào. `null` = bản gốc. `ON DELETE SET NULL`: xoá bản gốc KHÔNG được xoá bản cải tiến, chỉ mất liên kết (ADR #15) |
| createdAt | timestamptz | |

### MatchRun *(implemented — feature `multi-provider-compare`)*

Một lần bấm "Run match" — nhóm N `MatchResult` của cùng cặp CV↔JD (mỗi provider 1 kết quả) để đối chiếu.

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | per-user |
| cvDocumentId | uuid (FK → Document) | kind=CV |
| jdDocumentId | uuid (FK → Document) | kind=JD |
| createdAt | timestamptz | |

> Run được tạo **trước** khi gọi AI (trả `runId` ngay để FE sang step 4 và render skeleton). Chạy 1 provider duy nhất vẫn tạo run (N=1) để giữ 1 hình dạng dữ liệu.

### MatchResult

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | per-user |
| runId | uuid (FK → MatchRun, nullable) | nhóm đối chiếu. Nullable để không phá dữ liệu cũ (match tạo trước Goal 6) |
| cvDocumentId | uuid (FK → Document) | kind=CV |
| jdDocumentId | uuid (FK → Document) | kind=JD |
| credentialId | uuid (FK → AiCredential, nullable) | `null` = chạy bằng key hệ thống (fallback). `ON DELETE SET NULL` — xoá credential KHÔNG được xoá kết quả cũ |
| provider | enum(openrouter, openai, gemini) | provider đã chạy — cần để phân biệt kết quả nào của ai |
| chatModel | text | model thực tế đã dùng (snapshot, không suy ra từ credential vì credential có thể bị đổi sau) |
| embedModel | text | idem |
| status | enum(succeeded, failed) | **không có `pending`** — row chỉ được tạo khi provider đó đã xong (thành công hoặc lỗi). Trạng thái "đang chờ" chỉ tồn tại ở FE (request đang bay). Refresh giữa lúc chạy → run có ít result hơn số provider đã chọn, và đó là hành vi đúng |
| errorCode | text (nullable) | `invalid_key` \| `no_quota` \| `model_unavailable` \| `timeout` \| `unreachable`. **KHÔNG chứa message thô của provider** (rủi ro rò rỉ) |
| overallScore | int | % match tổng = `round(0.6*semantic + 0.4*keyword)` |
| semanticScore | int | % — cosine của 2 embedding (tính in-app, no pgvector) |
| keywordScore | int | % — skill/keyword overlap (\|JD∩CV\|/\|JD\|) |
| report | jsonb | { strengths[], gaps[], suggestions[] } |
| createdAt | timestamptz | |

> **Implemented**: `MatchResult` (không có các field 📝) từ Plan 2 + `Document` từ Plan 1, mở rộng `fileData`/`fileMime` ở `home-dashboard-library` — đều đã có trong `server/prisma/schema.prisma`. Không cột embedding/vector. Index hiện có: `Document @@index([userId, kind])`, `MatchResult @@index([userId])`.

### AiCredential *(implemented — feature `ai-credentials`)*

Token AI do **user** cung cấp. Mọi provider trong enum đều có **cả** chat + embeddings (ADR #10).

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | **per-user isolation** |
| provider | enum(openrouter, openai, gemini) | |
| label | text | tên user tự đặt, vd "OpenRouter cá nhân". Unique theo `(userId, label)` |
| encryptedKey | bytea | ciphertext **AES-256-GCM**; key từ env `CREDENTIAL_ENCRYPTION_KEY` |
| keyIv | bytea | IV riêng cho mỗi record |
| keyTag | bytea | GCM auth tag |
| keyLast4 | text | 4 ký tự cuối để hiển thị `••••1234` — **không đủ để dùng lại key** |
| chatModel | text (nullable) | override; `null` = default của provider |
| embedModel | text (nullable) | override; `null` = default của provider |
| lastTestStatus | enum(ok, invalid_key, no_quota, model_unavailable, timeout, unreachable) (nullable) | kết quả **test connection** lần cuối. `timeout` thêm 2026-08-09 (migration `add_timeout_test_status`): trước đó "quá chậm" bị gộp vào `unreachable`, khiến mã `timeout` được ghi khắp tài liệu nhưng **không bao giờ xảy ra** |
| lastTestedAt | timestamptz (nullable) | |
| lastUsedAt | timestamptz (nullable) | audit: credential này chạy match lần cuối khi nào |
| createdAt | timestamptz | |

> **Bất biến bắt buộc**: `encryptedKey`/`keyIv`/`keyTag` **KHÔNG BAO GIỜ** ra khỏi tầng service — không lên DTO, không vào log, không vào Swagger example. API chỉ trả `id`/`provider`/`label`/`keyLast4`/`chatModel`/`embedModel`/`lastTest*`/`lastUsedAt`.

### DataDisclosure 📝 *(spec — Goal 10)*

Nhật ký **mỗi lần dữ liệu của user rời khỏi hệ thống**. Ghi **TRƯỚC** khi gọi AI, không phải sau — nên không phụ thuộc kết quả và không bỏ sót lần lỗi.

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | **per-user isolation** |
| documentId | uuid (FK → Document) | tài liệu nào đã bị gửi đi |
| provider | enum(openrouter, openai, gemini) | gửi cho ai |
| purpose | enum(embed, chat) | gửi để làm gì — 1 lần match sinh ≥2 row (2 embed + 1 chat) |
| sentAt | timestamptz | |
| outcome | enum(ok, failed) | cập nhật sau khi call xong. `failed` **vẫn nghĩa là dữ liệu đã gửi đi** |

> **Bất biến bắt buộc**:
> - **KHÔNG chứa nội dung tài liệu** và **KHÔNG chứa key** — chỉ con trỏ (`documentId`) + metadata.
> - **Fail-closed**: ghi row không thành công → **không gọi AI**. Nhật ký có lỗ là nhật ký không tin được.
> - **KHÔNG suy nhật ký từ `MatchResult`** (ADR #16): lần match lỗi không tạo row `MatchResult`, nhưng đó lại chính là lần dữ liệu đã rời hệ thống rồi mới lỗi.

### CoverLetter *(implemented — feature `cover-letter-generator`, Goal 7b)*

Một lá thư ứng tuyển sinh từ **một `MatchResult`**. Mỗi lần sinh là một row — kể cả lần lỗi.

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | **per-user isolation**, `ON DELETE CASCADE` |
| matchResultId | uuid (FK → MatchResult) | `ON DELETE CASCADE` — lá thư sinh từ một report; report mất thì thư mất ngữ cảnh. Neo vào `MatchResult` chứ không vào cặp `(cv, jd)`: mỗi lần chấm cho `strengths`/`gaps` khác nhau, nên thư khác nhau |
| tone | enum(formal, friendly) | |
| length | enum(short, standard) | |
| language | enum(en, vi) | **ngôn ngữ của lá thư**, độc lập với ngôn ngữ UI |
| content | text | **plain text** (đích đến là ô soạn email — markdown ở đó hiện ra dạng `**dấu sao**`; cũng loại bỏ bề mặt XSS). Rỗng khi `status=failed` |
| omittedRequirements | text[] | Yêu cầu của JD mà CV **không** chống lưng được — do model tự khai. Đây là nửa **nhìn thấy được** của ADR #13: thay vì bịa, nó nói ra cái nó không nhận |
| status | enum(succeeded, failed) | Không có `pending` — row chỉ tạo khi đã xong (thành công hoặc lỗi) |
| errorCode | text (nullable) | `invalid_key` \| `no_quota` \| `model_unavailable` \| `timeout` \| `unreachable`. **KHÔNG** chứa message thô của provider |
| edited | boolean | `true` khi user đã sửa tay — phân biệt bản AI với bản đã biên tập |
| credentialId | uuid (FK → AiCredential, nullable) | `null` = key hệ thống. `ON DELETE SET NULL` |
| provider | enum(openrouter, openai, gemini) | snapshot |
| chatModel | text | snapshot. **Không** có `embedModel` — sinh thư chỉ dùng chat |
| createdAt / updatedAt | timestamptz | |

> **Vì sao `errorCode` là `text`, không phải enum**: người ghi vào cột này chỉ có **một** — `AiProviderError.reason`, kiểu `AiTestStatus` — nên TypeScript đã chặn giá trị lạ tại điểm ghi duy nhất. Không có enum nào đúng để gắn: `AiTestStatus` chứa `ok`, thứ **không bao giờ** hợp lệ cho một mã lỗi; còn đúc enum thứ hai chỉ để bỏ `ok` sẽ tạo hai enum lệch nhau một member và một nguồn drift mới. Cột cũng mang tính **ghi chú lịch sử**, nên kiểu chữ khoan dung hơn khi tập mã đổi. Áp dụng cho cả `MatchResult.errorCode`. Xem `specs/cover-letter-generator/security-report.md`.

> **Bất biến bắt buộc**:
> - **Độc lập `Document` và độc lập lineage `parentId`** (Goal 9). Cover letter là **lá**: không engine nào chấm nó, không thư viện nào liệt kê nó, không delta nào đo nó. Nhét vào `Document` sẽ bắt mọi query `kind IN (CV, JD)` và mọi màn library học thêm một loại thứ ba mà chẳng đổi lấy gì.
> - **Thất bại được LƯU, không ném 503** — cùng hợp đồng `POST /match` sau `multi-provider-compare` (ADR/D3). 503 chỉ còn cho lỗi *cấu hình*.
> - **Tự lưu mỗi lần sinh, không có nút "Save"**. §6.4 nói "lưu lại là tuỳ chọn" — đó là câu về **user** (họ xoá được bất cứ lúc nào), không phải về hệ thống. Nút Save đặt quyết định vào đúng lúc user chưa có gì để so, và bản lỗi thì chẳng ai bấm Save.
> - Điều này **không** vi phạm ADR #13: ADR #13 nói về CV rewrite — thứ **chảy tiếp** vào hệ thống (thành `Document`, đem match lại, đo delta ở Goal 9) nên phải qua cửa duyệt. Cái ADR #13 thật sự cấm — **bịa nội dung** — được giữ nguyên và siết chặt hơn qua `omittedRequirements` + prompt (xem `specs/cover-letter-generator/design.md` §4).

### Generated content — hai nửa Goal 7 lưu **khác nhau, có chủ ý**

Câu hỏi cũ *"thêm một bảng `GeneratedContent` chung hay không"* đã được **cả hai** feature trả lời, và câu trả lời **không giống nhau**. Đó là kết luận đúng, không phải sự thiếu nhất quán: hai thứ khác nhau ở chỗ **có chảy tiếp vào hệ thống hay không**.

**CV rewrite (Goal 7a, Roadmap #6) — phương án (a), KHÔNG thêm model** *(2026-08-09, feature `cv-rewrite-assistant`)*

- Đề xuất **KHÔNG được lưu**. Sau khi user duyệt từng thay đổi → lưu thành `Document` mới (`kind=CV`, `sourceFormat=text`, `isSaved=true`, `parentId` = CV gốc, `fileData`/`fileMime` = `null`).
- **Vì sao không lưu bản đề xuất**: ADR #13 nói output "chỉ thành dữ liệu thật khi user duyệt". Lưu mọi đề xuất chưa duyệt là **lưu thêm một bản sao CV (PII)** cho thứ user có thể không bao giờ nhận — đi ngược Goal 10.
- **Vì sao không cần `GeneratedContent`**: cái nó mua là truy vết *"bản này sinh ra từ match nào"*. Consumer duy nhất được biết là Goal 9, mà §6.6 so **2 phiên bản CV trên một JD do user chọn** — nó cần `parentId` + JD, không cần con trỏ ngược về `MatchResult`. Xem `specs/cv-rewrite-assistant/design.md` §4.1.
- **Đánh đổi đã chấp nhận**: reload giữa chừng làm mất đề xuất, phải sinh lại (tốn 1 chat call). Khác `multi-provider-compare` — ở đó **kết quả** là sản phẩm cuối nên phải bền; ở đây sản phẩm cuối là `Document` sau khi duyệt, và nó được lưu hẳn hoi.

**Cover letter (Goal 7b, Roadmap #8) — bảng riêng `CoverLetter`, tự lưu mỗi lần sinh** *(2026-08-09, feature `cover-letter-generator`)*

Xem bảng `CoverLetter` ở trên. Ngược hướng 7a **vì đúng cái tiêu chí mà 7a dùng để loại việc lưu**: bản CV rewrite **chảy tiếp** (thành `Document`, đem match lại, đo delta ở Goal 9) nên phải qua cửa duyệt và không được lưu trước khi duyệt; lá thư là **lá** — không engine nào chấm nó, không thư viện nào liệt kê nó, nên lưu nó **không** tạo ra một bản sao PII chưa duyệt nào chảy vào đâu cả. Ngược lại, không lưu thì mất khả năng **so nhiều bản** (đúng lý do tồn tại của 3 núm tone/length/language) và **không ghi nổi lần lỗi** của provider. Lập luận đầy đủ: `specs/cover-letter-generator/design.md` §3.

~~**(b) Một bảng `GeneratedContent` chung cho cả hai**~~ — **đã loại**, giữ lại để không cân nhắc lại từ đầu: `id`, `userId`, `matchResultId` (FK), `kind` enum(`cv_rewrite`, `cover_letter`), `content` text, `accepted` boolean, `createdAt`. Sau khi hai nửa chốt ngược hướng nhau, bảng gộp này sẽ có **nửa số cột luôn null** ở mỗi `kind`.

Ràng buộc chung (ADR #13): **không ghi đè CV gốc**; nội dung sinh ra phải bám vào những gì CV thật sự có.

## Notes (semantics ngoài schema)

- **Per-user isolation**: mọi query `Document`/`MatchResult` filter theo `userId`; user khác KHÔNG thấy data của nhau.
- **isSaved**: reuse ở wizard step 1/2 chỉ liệt kê `Document` có `isSaved=true` của user hiện tại (radio-select).
- **embedding/pgvector**: DEFER — match 1 CV × 1 JD chỉ cần cosine 2 vector tính in-app (không lưu). pgvector + cột embedding chỉ thêm khi rank nhiều CV (**roadmap #11** — roadmap đánh số lại 2026-08-08, trước đó là #7).
- **overallScore**: `round(0.6*semanticScore + 0.4*keywordScore)` (Plan 2). Đổi trọng số → cập nhật ở đây + code.
- **mock user** 📝: khi chưa có auth, `userId` của mọi bảng trỏ về `User` có `isMock = true`. Đây là user **hợp lệ trong DB**, không phải id ảo → FK toàn vẹn, clean data 1 câu lệnh.
- **Lineage `Document.parentId`**: bản CV viết lại **luôn là row mới** — CV gốc không bao giờ bị ghi đè (ADR #13). `ON DELETE SET NULL` (ADR #15): xoá bản gốc thì bản cải tiến **vẫn còn**, chỉ mất liên kết. Bản viết lại có `sourceFormat=text` và `fileData=null` — **không** copy file PDF/DOCX của cha, vì file cũ không còn nói đúng nội dung mới. **`CoverLetter` không tham gia lineage này** — nó không phải một phiên bản của CV.
- **Số phiên bản KHÔNG có cột riêng** *(chốt 2026-08-09, Roadmap #7)*: `version` (1 = bản gốc, 2 = bản viết lại của nó…) được **suy ra bằng cách đi ngược chuỗi `parentId`**, cap ở `MAX_LINEAGE_DEPTH = 20`. Lưu hẳn một cột sẽ drift ngay ở ca đầu tiên — `ON DELETE SET NULL` biến `v2` thành gốc mới khi xoá bản gốc, nhưng cột đã lưu vẫn nói "2". Đóng open question của `project-goals.md` §12.
- **Vòng lineage bị chặn ở đường ghi**: `PATCH /documents/:id/parent` từ chối trỏ vào chính nó, vào tài liệu khác `kind`, hoặc vào bất kỳ hậu duệ nào (**400**). Cột tự nó cho phép vòng, nên bất biến này sống ở service chứ không ở schema.
- **AiCredential ↔ MatchResult / CoverLetter**: quan hệ **soft** (`ON DELETE SET NULL`). Xoá credential không được xoá lịch sử; `provider`/`chatModel`(/`embedModel`) được **snapshot** vào row nên kết quả cũ vẫn đọc được sau khi credential bị xoá/đổi model.
- **Thứ tự xoá (FK)** khi clean data: `CoverLetter` → `MatchResult` → `MatchRun` → `Document`. `CoverLetter` cascade theo `MatchResult`, nhưng `MatchResult`/`MatchRun` **restrict** trên `Document` nên vẫn phải xoá từ dưới lên.
- **So sánh được giữa các provider** 📝: mọi provider trong whitelist đều chạy **cùng công thức điểm** (0.6 semantic + 0.4 keyword) nên điểm giữa các card trong 1 `MatchRun` là so sánh được. Đây là lý do provider không có embeddings API bị loại khỏi enum (`project-goals.md` ADR #10) — nếu sau này nới ra thì `semanticScore` phải thành nullable và tính so sánh mất đi.

## How to update

- Source-of-truth = file này. Sync **tay** với Prisma schema (`server/`) khi có tech DB.
- Drift code ↔ ERD: xử lý theo `docs/.claude/CLAUDE.md` §2 (code mới hơn → update ERD cùng PR; ERD mới hơn → spec chưa impl, flag ở `writing-plans`).
