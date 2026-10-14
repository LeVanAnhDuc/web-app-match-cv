# CVREWRITEASSISTANT — Bug log

Bug cũ gom về lúc scaffold: không có (`docs/specs/cv-rewrite-assistant/e2e.md` ghi "không có vòng lặp fail nào → không
có `e2e-bugs.md`"). BUG-01…04 tìm ra khi đối chiếu requirement chốt ngày 2026-10-14 với code; BUG-05 tìm ra khi chạy
suite cùng ngày. Lượt chạy 2026-10-14 (app, app-tablet, app-mobile) tái hiện cả năm bug (`test.fail()` đạt).

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-CVREWRITEASSISTANT-01](#bug-cvrewriteassistant-01) | Trung bình | TC-CVREWRITEASSISTANT-058 | Tên toàn khoảng trắng lọt qua modal, server 400, UI báo nhầm "thay đổi không còn khớp CV" |
| [BUG-CVREWRITEASSISTANT-02](#bug-cvrewriteassistant-02) | Thấp | TC-CVREWRITEASSISTANT-065 | Checkbox của các thay đổi cùng section có tên truy cập trùng nhau |
| [BUG-CVREWRITEASSISTANT-03](#bug-cvrewriteassistant-03) | Thấp | TC-CVREWRITEASSISTANT-066 | Mở modal "Save as a new CV" không focus vào ô tên |
| [BUG-CVREWRITEASSISTANT-04](#bug-cvrewriteassistant-04) | Thấp | TC-CVREWRITEASSISTANT-043 | Skeleton lúc sinh không mang `aria-busy="true"` |
| [BUG-CVREWRITEASSISTANT-05](#bug-cvrewriteassistant-05) | Trung bình | TC-CVREWRITEASSISTANT-061 | Double-click "Save" trong modal gửi hai `POST /cv-rewrite/accept` → hai CV con |

### BUG-CVREWRITEASSISTANT-01

- **TC:** TC-CVREWRITEASSISTANT-058 · **Requirement:** REQ-CVREWRITEASSISTANT-24
- **Bước tái hiện:** `/cv-rewrite/<match>` → Generate → tick một thay đổi → "Save as new CV" → xoá tên, gõ `"   "` → Save
- **Mong đợi:** lỗi `save.nameRequired` ("Please enter a name") trong modal, không gửi `POST /cv-rewrite/accept`
- **Thực tế:** rule `required` của antd không coi khoảng trắng là rỗng (`SaveRewriteModal` thiếu `whitespace: true`), form
  gửi `title.trim()` = `""`, server trả 400 (title trim rồi `Length(1,200)`), `RewriteReview.runAccept` map mọi 400 thành
  `rewrite.err.notGrounded` ("One of the approved changes no longer matches your CV…") — sai lý do
  (`client/src/views/CvRewrite/components/SaveRewriteModal/index.tsx`, `mains/RewriteReview/index.tsx`)

### BUG-CVREWRITEASSISTANT-02

- **TC:** TC-CVREWRITEASSISTANT-065 · **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Bước tái hiện:** đề xuất có hai thay đổi cùng `sectionHint = "Experience"` → đọc accessible name của hai checkbox
- **Mong đợi:** hai tên khác nhau (vd. kèm trích đoạn `original` hoặc số thứ tự) để trình đọc màn hình và
  `getByRole('checkbox', { name })` phân biệt được (design §7 row 12, NFR-A11Y-04)
- **Thực tế:** `ChangeCard` đặt `aria-label` của group và checkbox = `sectionHint` → cả hai đều là "Experience"
  (`client/src/views/CvRewrite/components/ChangeCard/index.tsx`)

### BUG-CVREWRITEASSISTANT-03

- **TC:** TC-CVREWRITEASSISTANT-066 · **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Bước tái hiện:** Generate → tick → "Save as new CV"
- **Mong đợi:** ô "Document name" nhận focus ngay khi modal mở (NFR-A11Y-02, design §7 row 12)
- **Thực tế:** antd `Modal` (rc-dialog 9.6) focus vào sentinel của dialog; `Input` không có `autoFocus` → người dùng bàn
  phím phải Tab thêm mới tới ô tên (`SaveRewriteModal/index.tsx`)

### BUG-CVREWRITEASSISTANT-04

- **TC:** TC-CVREWRITEASSISTANT-043 · **Requirement:** REQ-CVREWRITEASSISTANT-11
- **Bước tái hiện:** Generate (provider chậm) → trong lúc chờ, tìm phần tử `aria-busy="true"` trong vùng `aria-live`
- **Mong đợi:** skeleton đang chờ mang `aria-busy="true"` (design §7 row 12, NFR-REL-03)
- **Thực tế:** `RewriteReview` truyền `aria-busy="true"` cho `SectionCard`, nhưng `SectionCard` chỉ nhận các prop khai báo
  và không rải phần còn lại xuống `<div>` → thuộc tính không có trong DOM (`client/src/components/SectionCard/index.tsx`).
  Cùng nguyên nhân có ở skeleton của `MatchResultCard` (module khác)

### BUG-CVREWRITEASSISTANT-05

- **TC:** TC-CVREWRITEASSISTANT-061 · **Requirement:** REQ-CVREWRITEASSISTANT-29 (D4: chặn double-submit chỉ ở client)
- **Bước tái hiện:** `/cv-rewrite/<match>` → Generate → Select all → "Save as new CV" → double-click "Save"
- **Mong đợi:** đúng 1 request `POST /cv-rewrite/accept`, đúng 1 CV con
- **Thực tế:** chạy suite 2026-10-14 (desktop, tái hiện 2/2 lần): hai request accept cùng body được gửi rồi trang mới
  tới `/cv`. `onOk` của `SaveRewriteModal` gọi `form.submit()` (validate bất đồng bộ) và `confirmLoading` chỉ bật khi
  `accept.isPending` đã re-render, nên cú click thứ hai lọt qua trước khi nút chuyển sang loading; server không có
  idempotency (D4) nên mỗi request tạo một `Document`
  (`client/src/views/CvRewrite/components/SaveRewriteModal/index.tsx`, `mains/RewriteReview/index.tsx`)

## Đã sửa

_(chưa có)_
