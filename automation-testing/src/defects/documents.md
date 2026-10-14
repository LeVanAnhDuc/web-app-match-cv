# DOCUMENTS — Bug log

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-DOCUMENTS-01](#bug-documents-01) | Cao | TC-DOCUMENTS-049 | Xoá tài liệu chỉ được một `MatchRun` rỗng tham chiếu → 500 thay vì 409/204 |
| [BUG-DOCUMENTS-02](#bug-documents-02) | Thấp | TC-DOCUMENTS-066 | Xem trước PDF chỉ vẽ trang 1 |
| [BUG-DOCUMENTS-03](#bug-documents-03) | Trung bình | TC-DOCUMENTS-068 | Modal xem trước quay vô hạn khi `GET /documents/:id` lỗi |
| [BUG-DOCUMENTS-04](#bug-documents-04) | Thấp | TC-DOCUMENTS-060 | Lỗi tải thư viện không có nút thử lại |
| [BUG-DOCUMENTS-05](#bug-documents-05) | Thấp | TC-DOCUMENTS-035 | Tên file tải về mất dấu tiếng Việt (không có `filename*`) |

### BUG-DOCUMENTS-01

- **TC:** TC-DOCUMENTS-049 · **Requirement:** REQ-DOCUMENTS-34
- **Bước tái hiện:** user có CV + JD; mở một lượt match (`POST /match/runs`, hoặc row `MatchRun`) rồi không có kết quả nào
  (đóng tab, khách hết quota rồi đăng nhập); `DELETE /documents/<cvId>`.
- **Mong đợi:** 409 `documents.errors.inUseByMatch` và tài liệu giữ nguyên, hoặc 204 và run rỗng bị xoá kèm — không 5xx.
- **Thực tế:** 500. `DocumentsService.remove` chỉ đếm `MatchResult`; FK `MatchRun.cvDocumentId/jdDocumentId` là
  `ON DELETE NO ACTION` (`server/prisma/migrations/20261004000000_auth_sessions_and_guests/migration.sql:77-80`), nên
  `document.delete` vỡ ràng buộc. Người dùng thấy toast `library.delete.failed` và không bao giờ xoá được tài liệu đó.

### BUG-DOCUMENTS-02

- **TC:** TC-DOCUMENTS-066 · **Requirement:** REQ-DOCUMENTS-35
- **Bước tái hiện:** lưu một CV PDF 3 trang; `/cv` → Actions → Preview.
- **Mong đợi:** cả 3 trang hiện (ADR-0019: xem trước để kiểm nội dung đã parse).
- **Thực tế:** chỉ trang 1 (`client/src/components/DocumentPreview/index.tsx` render `<Page pageNumber={1} />`).

### BUG-DOCUMENTS-03

- **TC:** TC-DOCUMENTS-068 · **Requirement:** REQ-DOCUMENTS-36
- **Bước tái hiện:** mở `/jd`; xoá một JD ở tab khác (hoặc qua API); quay lại tab đầu → Actions → Preview JD đó.
- **Mong đợi:** modal hiện `preview.error` ("Couldn't load this file. Please try again.").
- **Thực tế:** `GET /documents/:id` trả 404, react-query thử lại rồi báo lỗi, nhưng `DocumentPreviewModal` chỉ có nhánh
  `loading || !doc ? <Spin/>` nên modal quay mãi (lệch NFR-REL-03, HDL §6).

### BUG-DOCUMENTS-04

- **TC:** TC-DOCUMENTS-060 · **Requirement:** REQ-DOCUMENTS-37
- **Bước tái hiện:** mở `/cv` khi `GET /documents?kind=CV&saved=true` lỗi.
- **Mong đợi:** thông báo lỗi kèm nút thử lại; bấm thì tải lại danh sách (HDL §6, §8 #10 "error UI + retry").
- **Thực tế:** chỉ có dòng `library.loadError` ("… Please try again."), không có nút; người dùng phải tải lại trang.

### BUG-DOCUMENTS-05

- **TC:** TC-DOCUMENTS-035 · **Requirement:** REQ-DOCUMENTS-38
- **Bước tái hiện:** lưu CV PDF title "Sơ yếu Lý lịch"; tải xuống.
- **Mong đợi:** `Content-Disposition` có `filename*=UTF-8''S%C6%A1%20y%E1%BA%BFu%20L%C3%BD%20l%E1%BB%8Bch.pdf` cạnh
  `filename` ASCII, trình duyệt lưu đúng tên có dấu.
- **Thực tế:** chỉ có `filename="S_y_u_L_l_ch.pdf"` (sanitize `[^\w.-]+` → `_`), mất toàn bộ dấu (lệch tinh thần NFR-I18N).

## Đã sửa

_(chưa có)_
