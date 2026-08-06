# Security Report — `home-dashboard-library`

> §4.5 review (feature đụng file streaming/download + untrusted file render + input user rename/delete). BE + FE review riêng. Verdict tổng: **✅ PASS**.

## Verdict: ✅ PASS (BE + FE)

Không IDOR, không cross-user data leak, không XSS trong render untrusted, không secret committed. Attack surface mới (stream file gốc, render PDF/DOCX client-side, rename/delete) đã hardening.

## Backend (server) — SECURITY PASS · QUALITY APPROVED · 0 Critical / 0 Important / 7 Minor

Endpoints mới: `GET /documents/:id/file`, `PATCH /documents/:id`, `DELETE /documents/:id` (409 nếu ref bởi match), `GET /match`.

Đã kiểm — không vấn đề:
- **Per-user isolation**: mọi endpoint scope theo `CurrentUserService.getUserId()` (findFirst `{id,userId}`); test cross-user (user khác → 404) cho file/rename/delete + match list.
- **Không leak binary trong JSON**: `fileData`/`fileMime` KHÔNG có trong `DocumentDto`/`DocumentSummaryDto`; binary chỉ qua endpoint stream.
- **Content-Disposition filename**: title sanitize (`replace(/[^\w.-]+/g,"_")`) → không header-injection qua title.
- **Delete 409**: đếm `MatchResult` ref cả `cvDocumentId`/`jdDocumentId`; giữ lịch sử match (không cascade).
- **helmet global** (`X-Content-Type-Options: nosniff` áp cho cả file stream). Injection: 100% qua Prisma. Không secret committed.

Minor (đã polish `6aa5b54`): bỏ `userId` thừa trong refCount query; thêm e2e coverage (header-injection filename); fix pre-existing flake `current-user` beforeAll 5s→60s.

## Frontend (client) — SECURITY PASS · QUALITY APPROVED · 0 Critical / 3 Important / 6 Minor

Surface chính: render file gốc untrusted client-side (`DocumentPreview` — react-pdf/docx-preview/text).

Đã kiểm — không vấn đề:
- **rawText** render React-escaped (`<pre>{rawText}</pre>`), không `dangerouslySetInnerHTML` ở đâu.
- **pdf.js**: scripting tắt (default), worker = asset same-origin bundle qua Vite (`new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`) — không CDN ngoài. (Deploy: CSP cần `worker-src 'self' blob:`.)
- **docx-preview**: render DOM cục bộ, không exec script (default); doc luôn của **chính user** (per-user, id từ saved-list của user) → self-XSS at worst, không stored cross-user. **Đã hardening** (`60699e7`): truyền options an toàn tường minh (`inWrapper: true`, `experimental: false`) + comment untrusted-input.
- **SSR-safe**: react-pdf/docx-preview chỉ `import type` ở top; module thật load qua dynamic `import()` trong effect mount-gated; có node-env SSR smoke test.

Important (đã xử `60699e7`):
- **I2/I3**: thêm `apiFetchBinary` tập trung fetch binary (base URL + ApiError), route `fetchDocumentFile` qua đó → bỏ `credentials:"include"` ad-hoc, nhất quán với `apiFetch` + tuân rule "mọi HTTP qua wrapper".
- **I1**: docx-preview safe options (trên).

Minor (đã xử phần a11y/defense: `60699e7`): encode id trong file endpoint (M2); RecentMatches row activate bằng Space + preventDefault (M3); RenameModal label `htmlFor`/`id` (M4); "View all" → muted non-interactive text (M5). Còn ghi nhận (non-blocking): M1 (DocumentPreview tự fetch bytes — architectural, để sau), M6 (react-pdf CSS import top-level — negligible).

## Follow-up (non-blocking)
- Khi **auth về (Roadmap #2)**: chốt credentials policy tập trung trong `apiFetch`/`apiFetchBinary`; cross-origin cần CORS `Allow-Credentials`.
- Deploy CSP: `worker-src 'self' blob:` cho pdf.js.
- Pin `docx-preview` sang version đã review (hiện `^0.4.0`).
