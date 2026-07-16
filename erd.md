# ERD — web-app-match-cv

> Sơ bộ tại brainstorm `cv-jd-matching-wizard` (2026-07-14). Chi tiết field/type chốt ở `writing-plans` + sync với Prisma schema khi scaffold `server/`. DB: **PostgreSQL + pgvector**.

## Module groups

- **Identity** (stub MVP): `User`
- **Documents**: `Document` (CV | JD, per-user, reusable)
- **Matching**: `MatchResult`

## Schema

### User (stub MVP — SSO-ready)

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| role | enum(candidate, recruiter, admin) | MVP stub |
| externalSub | text (nullable) | subject từ IdP store-app (điền khi SSO) |
| createdAt | timestamptz | |

### Document

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | **per-user isolation** |
| kind | enum(CV, JD) | |
| title | text | tên hiển thị (cho radio-select reuse) |
| sourceFormat | enum(pdf, docx, text) | |
| rawText | text | text sau parse |
| parsedContent | jsonb | structured (schema chốt ở writing-plans) |
| embedding | vector | Voyage embedding (pgvector) |
| isSaved | boolean | true = lưu tái dùng; false = transient session |
| createdAt | timestamptz | |

### MatchResult

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | per-user |
| cvDocumentId | uuid (FK → Document) | kind=CV |
| jdDocumentId | uuid (FK → Document) | kind=JD |
| overallScore | numeric | % match tổng (công thức combine TBD) |
| semanticScore | numeric | cosine similarity (Voyage) |
| keywordScore | numeric | skill/keyword overlap |
| report | jsonb | { strengths[], gaps[], suggestions[] } (từ Claude) |
| createdAt | timestamptz | |

## Notes (semantics ngoài schema)

- **Per-user isolation**: mọi query `Document`/`MatchResult` filter theo `userId`; user khác KHÔNG thấy data của nhau.
- **isSaved**: reuse ở wizard step 1/2 chỉ liệt kê `Document` có `isSaved=true` của user hiện tại (radio-select).
- **embedding**: sinh khi parse xong; dùng cho semantic score. Index pgvector (ivfflat/hnsw) — chốt khi scale.
- **overallScore**: kết hợp semantic + keyword theo trọng số — công thức chốt ở design feature.

## How to update

- Source-of-truth = file này. Sync **tay** với Prisma schema (`server/`) khi có tech DB.
- Drift code ↔ ERD: xử lý theo `docs/.claude/CLAUDE.md` §2 (code mới hơn → update ERD cùng PR; ERD mới hơn → spec chưa impl, flag ở `writing-plans`).
