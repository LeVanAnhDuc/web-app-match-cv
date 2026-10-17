# DATAEXPORT — Bug log

Không có bug log cũ gom về lúc scaffold (`docs/specs/data-export/` chỉ có `e2e.md`, không có `e2e-bugs.md`).

## Đang mở

_(không có)_

## Đã sửa

### BUG-DATAEXPORT-01

- **TC:** TC-DATAEXPORT-032 · **Requirement:** REQ-DATAEXPORT-34
- **Bước tái hiện:** user đăng nhập có một match result, một match run và một cover letter (cover letter là PII theo
  bảng PII của `nfr.md`) → `GET /api/v1/me/export` → mở `data.json`.
- **Mong đợi:** `data.json` có `coverLetters[]` (chứa cover letter đó) và `matchRuns[]` (chứa run đó) — FR-15 "export
  toàn bộ dữ liệu của user", quyết định Q1 (a).
- **Thực tế:** `data.json` chỉ có `documents`, `matchResults`, `aiCredentials`; `server/src/modules/me/me.service.ts`
  không đọc `CoverLetter` hay `MatchRun`, `export-manifest.ts` không có field cho chúng.
- **Đã sửa:** root cause — allow-list của `buildExportManifest` (cố ý map từng field) và transaction của
  `MeService.buildExportArchive` chưa từng được mở rộng khi `CoverLetter` / `MatchRun` ra đời; fix — đọc thêm hai bảng
  (scope `userId`, `select` tường minh) và map `coverLetters[]` / `matchRuns[]` từng field, thêm `matchResults[].runId`
  để nối kết quả với run (commit: 54dc783).

### BUG-DATAEXPORT-02

- **TC:** TC-DATAEXPORT-033 · **Requirement:** REQ-DATAEXPORT-34
- **Bước tái hiện:** user đăng nhập có email; CV gốc + CV con (`parentId` = CV gốc, như bản viết lại từ FR-14) →
  `GET /api/v1/me/export` → mở `data.json`.
- **Mong đợi:** `user` có `email`, `fullName`, `avatar` (hồ sơ mirror từ Ducker ID, FR-18); phần tử tài liệu có
  `parentId`; `schemaVersion` = 2 vì shape đã đổi — quyết định Q1 (a).
- **Thực tế:** `user` chỉ có `id`, `role`, `createdAt`; tài liệu không có `parentId`; `schemaVersion` = 1
  (`export-manifest.ts` map tường minh từng field và không gồm các field này).
- **Đã sửa:** root cause — cùng allow-list trên không gồm `User.email/fullName/avatar` (thêm khi mirror hồ sơ Ducker ID)
  và `Document.parentId` (thêm khi có lineage), còn `select` tài liệu bỏ `parentId`; fix — map bốn field đó (null khi
  trống) và tăng `SCHEMA_VERSION` lên 2 (commit: 54dc783).
