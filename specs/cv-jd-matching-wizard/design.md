# Design — `cv-jd-matching-wizard`

> Feature: `cv-jd-matching-wizard` · Ngày: 2026-07-14 · Loại: feature sản phẩm đầu tiên (MVP core loop).
> Brainstorm này đồng thời chốt goal/tech dự án — xem `docs/project-goals.md`, `.claude/techstack/*`, `docs/erd.md`.

## 1. Bối cảnh & phạm vi

Feature đầu của `web-app-match-cv`: một **wizard 4 bước** cho user nạp 1 JD + 1 CV, review, rồi nhận **báo cáo match hybrid** (keyword/skill + vector semantic + LLM giải thích). Chứng minh giá trị lõi "matching" sớm nhất, chưa cần job board / list / apply.

**Prerequisite (chưa có):** `server/` (NestJS) + `client/` (TanStack Start) **chưa tồn tại** — phải scaffold 2 repo mới (private) trước khi implement. Việc scaffold sẽ nằm trong `plan.md`.

### Quyết định đã chốt (brainstorm)

| Mục | Chốt |
|---|---|
| Core product | Job board 2 chiều (candidate ↔ recruiter); MVP chỉ làm matching wizard |
| Matching | Hybrid: keyword/skill + semantic (Voyage embedding, pgvector) + Claude report |
| Auth | **DEFER** — stub current-user; per-user isolation vẫn bắt buộc (schema key `userId`) |
| BE | NestJS + PostgreSQL + pgvector + Prisma |
| FE | TanStack Start + Tailwind + Ant Design |
| AI | Claude (`@anthropic-ai/sdk`) + Voyage (`voyageai`) |
| Reuse UX | **radio-select** CV/JD đã lưu (per-user); action lưu thiết kế kỹ ở SuperDesign step 1.5 |

## 2. Wizard flow (4 bước)

| Bước | Input | Xử lý | Output |
|---|---|---|---|
| **1. JD** | PDF / DOCX / paste text; hoặc **radio-select** JD đã lưu | parse → text (+ embed); nếu chọn "lưu" → `Document{kind:JD, isSaved:true}` | JD text ready |
| **2. CV** | 3 định dạng tương tự; hoặc radio-select CV đã lưu | parse → text (+ embed); optional lưu | CV text ready |
| **3. Review** | — | hiển thị text/structured parsed của CV & JD; cho sửa | user xác nhận |
| **4. Kết quả** | — | tính hybrid: keywordScore + semanticScore → overallScore; Claude sinh report | báo cáo UX-first |

**Reuse (step 1 & 2)**: liệt kê `Document` của user hiện tại có `isSaved=true`, `kind` tương ứng → radio-select 1 item để dùng nhanh (bỏ qua import). Empty state khi chưa lưu gì.

## 3. Matching engine (hybrid)

```
parse (pdf-parse / mammoth / paste) → rawText
  ├─ keywordScore : trích skill/keyword JD & CV → overlap ratio
  ├─ semanticScore: Voyage embed CV & JD → cosine similarity (pgvector)
  └─ overallScore : combine (trọng số — chốt ở writing-plans)
Claude (rawText CV + JD + scores) → report { strengths[], gaps[], suggestions[] }
```

- MVP **synchronous** (loading UI). Timeout + error handling cho Claude/Voyage.
- Report trình bày dễ hiểu: % tổng nổi bật, breakdown, danh sách gap + gợi ý chỉnh CV.

## 4. Data model

Xem `docs/erd.md` — `User` (stub), `Document` (CV|JD, per-user, `isSaved`, `embedding vector`), `MatchResult` (scores + report jsonb). Mọi query filter theo `userId` (per-user isolation).

## 5. API contract (BE DTO ↔ FE type) — sơ bộ

| Endpoint (NestJS) | Mục đích |
|---|---|
| `POST /documents` (multipart hoặc text) | parse + (optional) lưu 1 CV/JD |
| `GET /documents?kind=CV\|JD&saved=true` | list saved docs của user (reuse radio) |
| `POST /match` `{cvDocumentId, jdDocumentId}` | tính hybrid + Claude report → MatchResult |
| `GET /match/:id` | lấy lại report |

Chi tiết field DTO ↔ FE type chốt ở `writing-plans`.

## 6. Non-goals (feature này)

Auth thật, multi-CV batch ranking, apply/messaging, public listing/search, payment. (Trùng `project-goals.md` §5.)

## 7. E2E Scenario Matrix

> Rubric `e2e-scenario-coverage`. Feature đụng `client/src/**` + có behavior quan sát được → matrix bắt buộc. Adversarial completeness critic sẽ chạy ở `writing-plans` (chưa chạy ở brainstorm này). Auth deferred → row authN/authZ N/A (ghi lý do). Gate: `A+B` mặc định; `A only` cho scenario mutation/multi-user (tránh contamination gate B).

| # | Category | Scenario / N/A | Gate |
|---|---|---|---|
| 1 | Happy path | ✅ Walk full wizard: nạp JD (pdf) → nạp CV (docx) → review → xem report có overall% + breakdown + gaps + suggestions. Lặp cho paste-text path. | A+B |
| 2 | AuthN | **N/A** — auth deferred trong MVP; stub current-user luôn hiện diện, không có redirect/401. (Sẽ thêm khi SSO — roadmap.) | — |
| 3 | AuthZ | **N/A (role)** — candidate/recruiter đều dùng wizard, không có 403 theo role trong MVP. **Per-user isolation** cover ở row 11. | — |
| 4 | Validation | ✅ **[EP]** file classes: `valid pdf` · `valid docx` · `valid text` · `wrong-type (.png/.exe)` → reject · `empty file` → reject · `paste rỗng` → reject · `corrupt pdf/docx` → parse-error. **[DT]** combo: `wrong-type + oversize` → assert lỗi nào surface trước (type vs size precedence); `valid-type + oversize` → size error. Server phải validate lại (không tin client). | A+B |
| 5 | Empty / null | ✅ Chưa lưu CV/JD nào → reuse radio list hiện **empty state** ("Chưa có CV/JD đã lưu"). parsedContent thiếu field → render "—" không phải `null`. | A+B |
| 6 | Boundary | ✅ **[BVA]** file size (max ví dụ 5MB): `<max` accept · `=max` accept · `>max` reject. Paste text length: `0` reject · `1` accept · min ký tự hữu ích. Wizard step: không sang bước 2 khi bước 1 chưa có data (first-step guard); bước 4 là last-step. | A+B |
| 7 | Filter / search | **N/A** — reuse list MVP là radio list đơn giản, không search/filter/pagination. (Thêm khi list lớn — roadmap.) | — |
| 8 | Data rendering | ✅ overallScore render `85%` (không phải `0.8532`); sourceFormat → label ("PDF"/"Word"/"Text") không phải enum; gaps/suggestions → bullet list dễ đọc không phải JSON thô; createdAt formatted. | A+B |
| 9 | **i18n** | ✅ Render **EN + VI** cho: label 4 bước, validation errors, empty state, nhãn report (% match / điểm thiếu / gợi ý). Catch missing-message. | A+B |
| 10 | Error / loading | ✅ Claude/Voyage API 5xx / timeout / network fail → error UI + retry. Loading skeleton khi parse file + khi tính match (synchronous vài giây). Corrupt file → thông báo lỗi rõ. | A+B |
| 11 | Mutation / state | ✅ **[ST]** transitions: `step1→2→3→4` hợp lệ · **back button** giữ data · **invalid transition**: nhảy thẳng step 4 khi thiếu CV/JD → chặn/redirect về step thiếu. Lưu CV → xuất hiện trong reuse list. Double-submit "Match" → lần 2 no-op (idempotent). **Per-user isolation**: doc user A KHÔNG hiện trong reuse list user B. `afterAll` xoá doc đã lưu trong test. | A only |
| 12 | Accessibility | ✅ Wizard step keyboard nav; radio group reuse có role/label; nút Upload có label; focus chuyển đúng khi đổi bước; report có heading structure. Selector theo role/label. | A+B |

**Feature-specific đã gộp**: reuse radio-select (rows 5/11), per-user isolation (row 11, `A only`), hybrid score breakdown (rows 1/8).

## 8. Mở / chốt sau

- Công thức `overallScore` (trọng số semantic vs keyword) → `writing-plans`.
- Schema `parsedContent` jsonb (section CV/JD) → `writing-plans`.
- Voyage model + Claude model id → khi scaffold.
- File size max cụ thể + text length min → `writing-plans` (dùng cho BVA).
- Chạy completeness critic (Error Guessing) → `writing-plans`.
