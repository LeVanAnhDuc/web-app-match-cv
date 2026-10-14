# DATAEXPORT — Bug log

Không có bug log cũ gom về lúc scaffold (`docs/specs/data-export/` chỉ có `e2e.md`, không có `e2e-bugs.md`).

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-DATAEXPORT-01](#bug-dataexport-01) | Trung bình | TC-DATAEXPORT-032 | Export bỏ sót cover letter và match run của user |
| [BUG-DATAEXPORT-02](#bug-dataexport-02) | Trung bình | TC-DATAEXPORT-033 | Export bỏ sót hồ sơ user (email / fullName / avatar), `parentId` của tài liệu; `schemaVersion` vẫn 1 |

### BUG-DATAEXPORT-01

- **TC:** TC-DATAEXPORT-032 · **Requirement:** REQ-DATAEXPORT-34
- **Bước tái hiện:** user đăng nhập có một match result, một match run và một cover letter (cover letter là PII theo
  bảng PII của `nfr.md`) → `GET /api/v1/me/export` → mở `data.json`.
- **Mong đợi:** `data.json` có `coverLetters[]` (chứa cover letter đó) và `matchRuns[]` (chứa run đó) — FR-15 "export
  toàn bộ dữ liệu của user", quyết định Q1 (a).
- **Thực tế:** `data.json` chỉ có `documents`, `matchResults`, `aiCredentials`; `server/src/modules/me/me.service.ts`
  không đọc `CoverLetter` hay `MatchRun`, `export-manifest.ts` không có field cho chúng.

### BUG-DATAEXPORT-02

- **TC:** TC-DATAEXPORT-033 · **Requirement:** REQ-DATAEXPORT-34
- **Bước tái hiện:** user đăng nhập có email; CV gốc + CV con (`parentId` = CV gốc, như bản viết lại từ FR-14) →
  `GET /api/v1/me/export` → mở `data.json`.
- **Mong đợi:** `user` có `email`, `fullName`, `avatar` (hồ sơ mirror từ Ducker ID, FR-18); phần tử tài liệu có
  `parentId`; `schemaVersion` = 2 vì shape đã đổi — quyết định Q1 (a).
- **Thực tế:** `user` chỉ có `id`, `role`, `createdAt`; tài liệu không có `parentId`; `schemaVersion` = 1
  (`export-manifest.ts` map tường minh từng field và không gồm các field này).

## Đã sửa

_(chưa có)_
