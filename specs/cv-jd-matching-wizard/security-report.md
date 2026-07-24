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
