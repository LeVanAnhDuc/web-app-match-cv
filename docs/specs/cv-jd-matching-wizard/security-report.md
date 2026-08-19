# Security Report — `cv-jd-matching-wizard` (Plan 1)

> §4.5. Review ngày 2026-07-24 (feature đụng file upload + user input → bắt buộc). Ban đầu **CONDITIONAL** → sau khi fix 3 must-fix → **✅ PASS**.

## Verdict: ✅ PASS (sau khi áp 3 must-fix)

Không có injection, không auth/authz bypass, không cross-user data leak, không secret production committed. Attack surface mới (file upload) đã được hardening.

## Must-fix (đã xử lý)

| # | Finding | Fix | Commit |
|---|---|---|---|
| 1 | `pdf-parse`/`mammoth` không giới hạn tài nguyên → DOCX zip-bomb / PDF dị dạng có thể ngốn CPU/mem (10MB chỉ chặn bytes nén) | `parsing.ts`: parse timeout 15s + cap extracted text 2MB | server `e8a216c` |
| 2 | `CreateDocumentDto.sourceText` không có `@MaxLength` (chỉ dựa body-parser default ngầm) | `@MaxLength(100_000)` cho sourceText, `@MaxLength(200)` cho title | server `e8a216c` |
| 3 | `client/e2e/db-cleanup.ts` hardcode connection string kèm password trong source tracked | Đọc từ `E2E_DATABASE_URL` (dotenv nạp `client/.env`); `.env.example` chỉ placeholder | client `72af6ea` |

## Đã kiểm — không vấn đề

- **Per-user isolation**: `DocumentsService.create()`/`.list()` áp `currentUser.getUserId()` **vô điều kiện**; test 2-user xác nhận không lọt doc user khác.
- **Injection**: 100% qua Prisma query builder; `$queryRaw` chỉ ở test (tagged template, không interpolate input).
- **Data exposure**: `GET` trả `DocumentSummaryDto` (KHÔNG rawText, có test assert); không log PII.
- **CORS**: single fixed origin (`CLIENT_ORIGIN`), không wildcard.
- **Secrets**: không `.env` committed.

## Follow-up (non-blocking, ghi nhận)

- **Magic-number file validation**: hiện check mimetype-only (`skipMagicNumbersValidation`) — mimetype client giả được, nhưng không có RCE/path-traversal (parse in-memory, không ghi disk); `parseFile()` throw nếu nội dung không hợp lệ. Cân nhắc thêm content-sniffing (`file-type`) ở Plan sau. *(Minor #4: escape regex allow-list.)*
- **Parser isolation**: timeout không cắt được sync CPU thuần — worker-thread isolation là hardening tương lai.
- **`CurrentUserService` singleton**: khi SSO về (Plan 2 auth), phải chuyển request-scoped + re-verify mọi call site (không chỉ đổi constant thành JWT claim).
- **AntdProvider dark FOUC** (Minor #5): first paint dùng light cho OS-dark user — cosmetic, để sau.

---

# Plan 2 — Matching engine (OpenRouter) · review 2026-07-24

## Verdict: ✅ PASS (sau 3 must-fix). Code: 0 Critical / 3 Important / 3 Minor.

Không IDOR (per-user scope trên `/match`, `GET /match/:id`, `GET /documents/:id` — test cross-user + kind-swap). Prompt-injection blast radius thấp: scores tính độc lập với OpenRouter generation, output ràng JSON schema, render plain text (no XSS). Key chỉ đọc từ env, không log/không trả về.

## Must-fix (đã xử lý)

| # | Finding | Fix |
|---|---|---|
| 1 | Không timeout quanh OpenRouter `embed`/`generateReport` → `/match` treo nếu OpenRouter stall | `withTimeout` 20s → 503 (ai.service.ts) |
| 2 | Không cap text gửi OpenRouter (uploaded doc tới 2M chars) → cost/latency | `capForMatch` 20k chars trong `MatchingService.run` |
| 3 | Chưa disclose CV/JD (PII) gửi OpenRouter | Note ở design.md §3 + project-goals §7 + **UI disclaimer** step 4 (`result.disclaimer`) |

## Important/Minor khác (đã xử lý / ghi nhận)

- **StepReview null docId** → infinite spinner: thêm guard error-state + Back (đã fix).
- **StepResult React keys** (duplicate content): đổi sang index key (đã fix).
- Minor: orphaned transient doc khi partial fail (ghi nhận, MVP OK — chưa có nhiều transient); redundant clamp (harmless, giữ).

## Follow-up (non-blocking)

- Prompt-injection: chỉ ảnh hưởng report advisory (đã có UI disclaimer). Rate-limit riêng cho `/match` (endpoint đắt nhất) — cân nhắc sau. Batch matching + pgvector → roadmap.
