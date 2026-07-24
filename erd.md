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
| parsedContent | jsonb (nullable) | structured — **null ở Plan 1** (chỉ dùng rawText) |
| ~~embedding~~ | ~~vector~~ | **CHƯA implement** — pgvector defer; semantic tính embedding on-the-fly + cosine in-app (Plan 2), không lưu vector |
| isSaved | boolean | true = lưu tái dùng; false = transient session |
| createdAt | timestamptz | |

### MatchResult

| Field | Type | Note |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | per-user |
| cvDocumentId | uuid (FK → Document) | kind=CV |
| jdDocumentId | uuid (FK → Document) | kind=JD |
| overallScore | int | % match tổng = `round(0.6*semantic + 0.4*keyword)` |
| semanticScore | int | % — cosine của 2 **Gemini embedding** (tính in-app, no pgvector) |
| keywordScore | int | % — skill/keyword overlap (\|JD∩CV\|/\|JD\|) |
| report | jsonb | { strengths[], gaps[], suggestions[] } (từ **Gemini**) |
| createdAt | timestamptz | |

> **Implemented (Plan 2)**: `MatchResult` + `Document` (Plan 1) đã có trong Prisma schema (`server/prisma/schema.prisma`). Không cột embedding/vector.

## Notes (semantics ngoài schema)

- **Per-user isolation**: mọi query `Document`/`MatchResult` filter theo `userId`; user khác KHÔNG thấy data của nhau.
- **isSaved**: reuse ở wizard step 1/2 chỉ liệt kê `Document` có `isSaved=true` của user hiện tại (radio-select).
- **embedding/pgvector**: DEFER — match 1 CV × 1 JD chỉ cần cosine 2 vector tính in-app (không lưu). pgvector + cột embedding chỉ thêm khi rank nhiều CV (roadmap #5).
- **overallScore**: `round(0.6*semanticScore + 0.4*keywordScore)` (Plan 2). Đổi trọng số → cập nhật ở đây + code.

## How to update

- Source-of-truth = file này. Sync **tay** với Prisma schema (`server/`) khi có tech DB.
- Drift code ↔ ERD: xử lý theo `docs/.claude/CLAUDE.md` §2 (code mới hơn → update ERD cùng PR; ERD mới hơn → spec chưa impl, flag ở `writing-plans`).
