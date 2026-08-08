# ERD — web-app-match-cv

> Sơ bộ tại brainstorm `cv-jd-matching-wizard` (2026-07-14). Chi tiết field/type chốt ở `writing-plans` + sync với Prisma schema khi scaffold `server/`. DB: **PostgreSQL** (pgvector **defer** — chưa bật extension nào, xem ADR #5b).
> Cập nhật 2026-08-06 (brainstorm Goal 6 — BYO AI credentials): thêm `AiCredential` + `MatchRun`, mở rộng `User` + `MatchResult`. **Các phần đánh dấu 📝 SPEC là spec chưa implement** — ERD mới hơn code, phải flag ở `writing-plans` khi làm.
> Cập nhật 2026-08-08 (Goal 8/9/10 — `specs/goals-8-9-10/design.md`): thêm `Document.parentId` (lineage, Goal 9) + model `DataDisclosure` (Goal 10). Goal 8 không đổi ERD. Đổi số roadmap batch ranking #7 → **#11**.
> Cập nhật 2026-08-08 (feature `ai-credentials` — **đã merge**): `AiCredential` **đã implement**, `MatchResult` nhận 4 cột snapshot (`credentialId`/`provider`/`chatModel`/`embedModel`). `MatchRun` + `runId`/`status`/`errorCode` **vẫn 📝** — chúng chỉ có nghĩa khi một lần chạy sinh nhiều kết quả, tức Roadmap #9 (multi-provider compare).
> Cập nhật 2026-08-08 (đồng bộ doc ↔ code): xác nhận lại **đúng 4 model đang tồn tại trong `server/prisma/schema.prisma`** — `User`, `Document`, `MatchResult` (bản rút gọn), và **không có** `MatchRun` / `AiCredential`. Bỏ model `Job` khỏi kế hoạch (ADR #12 — "Recruiter đăng Job" + "Apply flow" đã loại khỏi roadmap). Thêm ghi chú Goal 7 (CV rewrite + cover letter) ở cuối.

## Trạng thái implement (đối chiếu `server/prisma/schema.prisma`, 2026-08-08 — sau feature `ai-credentials`)

| Model | Trong ERD | Trong Prisma | Ghi chú |
|---|---|---|---|
| `User` | ✅ | 🟡 **một phần** | Có `id`/`role`/`externalSub`/`createdAt`. **Thiếu**: `isMock`, `email`, `fullName`, `avatar`, `phone`, `updatedAt` (tất cả đánh 📝) |
| `Document` | ✅ | ✅ **đủ** | Kể cả `fileData`/`fileMime` (feature `home-dashboard-library`) |
| `MatchResult` | ✅ | ✅ **đủ** | Scores + `report` + FK cv/jd, `credentialId`/`provider`/`chatModel`/`embedModel` (Roadmap #4), và `runId`/`status`/`errorCode` (Roadmap #9) |
| `MatchRun` | ✅ | ✅ **đủ** | Roadmap **#9** đã merge — migration `add_match_run` |
| `AiCredential` | ✅ | ✅ **đủ** | Roadmap **#4** đã merge — migration `add_ai_credential`, kèm enum `AiProvider` + `AiTestStatus` |
| ~~`Job`~~ | ❌ | ❌ | **Không làm** — ADR #12 |
| `DataDisclosure` 📝 | ✅ | ❌ **chưa có** | Chỉ tạo khi làm Roadmap #5 (Goal 10) |

> **Goal 8 (tiếng Việt) KHÔNG đổi ERD** — thuần logic trong `matching.service.ts`. Nhưng có **script chạy một lần** tính lại `keywordScore` + `overallScore` cho `MatchResult` đã lưu (không tốn call AI: `rawText` còn, `semanticScore` đã lưu).

## Module groups

- **Identity**: `User` (mock user khi chưa auth — xem `project-goals.md` §3)
- **Documents**: `Document` (CV | JD, per-user, reusable)
- **Matching**: `MatchRun` + `MatchResult`
- **AI credentials**: `AiCredential` (token AI của user, mã hoá at-rest)
- **Privacy** 📝 *(Goal 10)*: `DataDisclosure` (nhật ký tài liệu đã gửi tới provider nào)
- **Generated content** 📝 *(Goal 7 — chưa thiết kế)*: nơi chứa output CV rewrite / cover letter — **chưa chốt model**, xem cuối file

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
| parentId | uuid (FK → Document, nullable) 📝 | **lineage (Goal 9)** — bản này là phiên bản mới của tài liệu nào. `null` = bản gốc. `ON DELETE SET NULL`: xoá bản gốc KHÔNG được xoá bản cải tiến, chỉ mất liên kết (ADR #15) |
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
| lastTestStatus | enum(ok, invalid_key, no_quota, model_unavailable, unreachable) (nullable) | kết quả **test connection** lần cuối |
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

### Generated content 📝 *(Goal 7 — CV rewrite + cover letter, CHƯA thiết kế)*

Roadmap #6/#8 sẽ sinh nội dung từ một `MatchResult`. **Model chưa chốt** — 2 hướng, quyết ở `superpowers:brainstorming` của feature đó:

- **(a) Không thêm model**: CV rewrite sau khi user duyệt → lưu thành `Document` mới (`kind=CV`, `sourceFormat=text`, `isSaved=true`); cover letter chỉ generate-and-copy, không lưu. Rẻ nhất, nhưng mất truy vết "bản này sinh ra từ match nào".
- **(b) Thêm `GeneratedContent`**: `id`, `userId`, `matchResultId` (FK), `kind` enum(`cv_rewrite`, `cover_letter`), `content` text, `accepted` boolean, `createdAt`. Truy vết được, so được nhiều bản, nhưng thêm 1 bảng + migration.

Ràng buộc chung dù chọn hướng nào (ADR #13): **không ghi đè CV gốc**; output là đề xuất, chỉ thành dữ liệu thật khi user duyệt.

## Notes (semantics ngoài schema)

- **Per-user isolation**: mọi query `Document`/`MatchResult` filter theo `userId`; user khác KHÔNG thấy data của nhau.
- **isSaved**: reuse ở wizard step 1/2 chỉ liệt kê `Document` có `isSaved=true` của user hiện tại (radio-select).
- **embedding/pgvector**: DEFER — match 1 CV × 1 JD chỉ cần cosine 2 vector tính in-app (không lưu). pgvector + cột embedding chỉ thêm khi rank nhiều CV (**roadmap #11** — roadmap đánh số lại 2026-08-08, trước đó là #7).
- **overallScore**: `round(0.6*semanticScore + 0.4*keywordScore)` (Plan 2). Đổi trọng số → cập nhật ở đây + code.
- **mock user** 📝: khi chưa có auth, `userId` của mọi bảng trỏ về `User` có `isMock = true`. Đây là user **hợp lệ trong DB**, không phải id ảo → FK toàn vẹn, clean data 1 câu lệnh.
- **AiCredential ↔ MatchResult**: quan hệ **soft** (`ON DELETE SET NULL`). Xoá credential không được xoá lịch sử match; `provider`/`chatModel`/`embedModel` được **snapshot** vào `MatchResult` nên kết quả cũ vẫn đọc được sau khi credential bị xoá/đổi model.
- **So sánh được giữa các provider** 📝: mọi provider trong whitelist đều chạy **cùng công thức điểm** (0.6 semantic + 0.4 keyword) nên điểm giữa các card trong 1 `MatchRun` là so sánh được. Đây là lý do provider không có embeddings API bị loại khỏi enum (`project-goals.md` ADR #10) — nếu sau này nới ra thì `semanticScore` phải thành nullable và tính so sánh mất đi.

## How to update

- Source-of-truth = file này. Sync **tay** với Prisma schema (`server/`) khi có tech DB.
- Drift code ↔ ERD: xử lý theo `docs/.claude/CLAUDE.md` §2 (code mới hơn → update ERD cùng PR; ERD mới hơn → spec chưa impl, flag ở `writing-plans`).
