# DOCUMENTS — Bug log

## Đang mở

_(không có)_

## Đã sửa

### BUG-DOCUMENTS-01

- **TC:** TC-DOCUMENTS-049 · **Requirement:** REQ-DOCUMENTS-34
- **Bước tái hiện:** user có CV + JD; mở một lượt match (`POST /match/runs`, hoặc row `MatchRun`) rồi không có kết quả nào
  (đóng tab, khách hết quota rồi đăng nhập); `DELETE /documents/<cvId>`.
- **Mong đợi:** 409 `documents.errors.inUseByMatch` và tài liệu giữ nguyên, hoặc 204 và run rỗng bị xoá kèm — không 5xx.
- **Thực tế:** 500. `DocumentsService.remove` chỉ đếm `MatchResult`; FK `MatchRun.cvDocumentId/jdDocumentId` là
  `ON DELETE NO ACTION` (`server/prisma/migrations/20261004000000_auth_sessions_and_guests/migration.sql:77-80`), nên
  `document.delete` vỡ ràng buộc. Người dùng thấy toast `library.delete.failed` và không bao giờ xoá được tài liệu đó.
- **Đã sửa:** root cause — `remove()` chỉ chặn khi có `MatchResult`, còn FK `MatchRun.cvDocumentId/jdDocumentId` là
  `ON DELETE NO ACTION`. Fix — xoá kèm các `MatchRun` của user tham chiếu tài liệu mà chưa có kết quả, cùng transaction
  với `document.delete` → 204; tài liệu có `MatchResult` vẫn 409 (commit: 86f47ce).

### BUG-DOCUMENTS-02

- **TC:** TC-DOCUMENTS-066 · **Requirement:** REQ-DOCUMENTS-35
- **Bước tái hiện:** lưu một CV PDF 3 trang; `/cv` → Actions → Preview.
- **Mong đợi:** cả 3 trang hiện (ADR-0019: xem trước để kiểm nội dung đã parse).
- **Thực tế:** chỉ trang 1 (`client/src/components/DocumentPreview/index.tsx` render `<Page pageNumber={1} />`).
- **Đã sửa:** root cause — `PdfPreview` render cứng `<Page pageNumber={1} />`. Fix — lấy `numPages` từ `onLoadSuccess`
  của `<Document>` và render một `<Page>` cho mỗi trang (commit: 8eee917).

### BUG-DOCUMENTS-03

- **TC:** TC-DOCUMENTS-068 · **Requirement:** REQ-DOCUMENTS-36
- **Bước tái hiện:** mở `/jd`; xoá một JD ở tab khác (hoặc qua API); quay lại tab đầu → Actions → Preview JD đó.
- **Mong đợi:** modal hiện `preview.error` ("Couldn't load this file. Please try again.").
- **Thực tế:** `GET /documents/:id` trả 404, react-query thử lại rồi báo lỗi, nhưng `DocumentPreviewModal` chỉ có nhánh
  `loading || !doc ? <Spin/>` nên modal quay mãi (lệch NFR-REL-03, HDL §6).
- **Đã sửa:** root cause — hook thư viện không đưa `isError` của `useDocument` xuống modal. Fix — `previewError` từ
  `useCvLibrary`/`useJdLibrary` → `DocumentPreviewModal` hiện `preview.error` (`role="alert"`) thay vì `Spin` (commit: 1b5a814).

### BUG-DOCUMENTS-04

- **TC:** TC-DOCUMENTS-060 · **Requirement:** REQ-DOCUMENTS-37
- **Bước tái hiện:** mở `/cv` khi `GET /documents?kind=CV&saved=true` lỗi.
- **Mong đợi:** thông báo lỗi kèm nút thử lại; bấm thì tải lại danh sách (HDL §6, §8 #10 "error UI + retry").
- **Thực tế:** chỉ có dòng `library.loadError` ("… Please try again."), không có nút; người dùng phải tải lại trang.
- **Đã sửa:** root cause — `CvLibraryError`/`JdLibraryError` chỉ là một dòng chữ, không có hành động. Fix — `Alert`
  `role="alert"` kèm nút `action.tryAgain` gọi `refetch()` của query danh sách (commit: 1b5a814).

### BUG-DOCUMENTS-05

- **TC:** TC-DOCUMENTS-035 · **Requirement:** REQ-DOCUMENTS-38
- **Bước tái hiện:** lưu CV PDF title "Sơ yếu Lý lịch"; tải xuống.
- **Mong đợi:** `Content-Disposition` có `filename*=UTF-8''S%C6%A1%20y%E1%BA%BFu%20L%C3%BD%20l%E1%BB%8Bch.pdf` cạnh
  `filename` ASCII, trình duyệt lưu đúng tên có dấu.
- **Thực tế:** chỉ có `filename="S_y_u_L_l_ch.pdf"` (sanitize `[^\w.-]+` → `_`), mất toàn bộ dấu (lệch tinh thần NFR-I18N).
- **Đã sửa:** root cause — header chỉ có `filename` ASCII đã sanitize. Fix — title có ký tự ngoài ASCII thì thêm
  `filename*=UTF-8''<percent-encode RFC 5987>` (`content-disposition.ts`); title ASCII giữ nguyên header cũ (commit: 3b6fed6).
