# CVREWRITEASSISTANT — Bug log

Bug cũ gom về lúc scaffold: không có (`docs/specs/cv-rewrite-assistant/e2e.md` ghi "không có vòng lặp fail nào → không
có `e2e-bugs.md`"). BUG-01…04 tìm ra khi đối chiếu requirement chốt ngày 2026-10-14 với code; BUG-05 tìm ra khi chạy
suite cùng ngày. Lượt chạy 2026-10-14 (app, app-tablet, app-mobile) tái hiện cả năm bug (`test.fail()` đạt).

## Đang mở

_(không còn)_

## Đã sửa

Lượt sửa 2026-10-15 (branch `fix/open-bugs`): cả năm bug đã sửa, `test.fail()` đã gỡ khỏi spec.

### BUG-CVREWRITEASSISTANT-01

- **TC:** TC-CVREWRITEASSISTANT-058 · **Requirement:** REQ-CVREWRITEASSISTANT-24
- **Bước tái hiện:** `/cv-rewrite/<match>` → Generate → tick một thay đổi → "Save as new CV" → xoá tên, gõ `"   "` → Save
- **Mong đợi:** lỗi `save.nameRequired` ("Please enter a name") trong modal, không gửi `POST /cv-rewrite/accept`
- **Thực tế:** rule `required` của antd không coi khoảng trắng là rỗng (`SaveRewriteModal` thiếu `whitespace: true`), form
  gửi `title.trim()` = `""`, server trả 400 (title trim rồi `Length(1,200)`), `RewriteReview.runAccept` map mọi 400 thành
  `rewrite.err.notGrounded` ("One of the approved changes no longer matches your CV…") — sai lý do
  (`client/src/views/CvRewrite/components/SaveRewriteModal/index.tsx`, `mains/RewriteReview/index.tsx`)
- **Đã sửa:** root cause — rule `required` của antd thiếu `whitespace: true` nên tên toàn khoảng trắng qua được validate, server 400 và UI map thành `notGrounded`. Fix — thêm `whitespace: true` vào rule; modal báo `save.nameRequired` và không gửi request (commit: ef69625).

### BUG-CVREWRITEASSISTANT-02

- **TC:** TC-CVREWRITEASSISTANT-065 · **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Bước tái hiện:** đề xuất có hai thay đổi cùng `sectionHint = "Experience"` → đọc accessible name của hai checkbox
- **Mong đợi:** hai tên khác nhau (vd. kèm trích đoạn `original` hoặc số thứ tự) để trình đọc màn hình và
  `getByRole('checkbox', { name })` phân biệt được (design §7 row 12, NFR-A11Y-04)
- **Thực tế:** `ChangeCard` đặt `aria-label` của group và checkbox = `sectionHint` → cả hai đều là "Experience"
  (`client/src/views/CvRewrite/components/ChangeCard/index.tsx`)
- **Đã sửa:** root cause — `ChangeCard` dùng mỗi `sectionHint` làm `aria-label` nên các thay đổi cùng section trùng tên. Fix — tên truy cập của group và checkbox kèm vị trí, khoá mới `rewrite.change.accessibleName` ("Experience — change 1 of 2" / "Experience — thay đổi 1/2") (commit: 09f1546).

### BUG-CVREWRITEASSISTANT-03

- **TC:** TC-CVREWRITEASSISTANT-066 · **Requirement:** REQ-CVREWRITEASSISTANT-34
- **Bước tái hiện:** Generate → tick → "Save as new CV"
- **Mong đợi:** ô "Document name" nhận focus ngay khi modal mở (NFR-A11Y-02, design §7 row 12)
- **Thực tế:** antd `Modal` (rc-dialog 9.6) focus vào sentinel của dialog; `Input` không có `autoFocus` → người dùng bàn
  phím phải Tab thêm mới tới ô tên (`SaveRewriteModal/index.tsx`)
- **Đã sửa:** root cause — rc-dialog tự focus wrapper khi mở nên ô tên không nhận focus. Fix — `SaveRewriteModal` focus ô tên trong `afterOpenChange` qua ref, cùng cách `CredentialFormModal` (commit: ef69625).

### BUG-CVREWRITEASSISTANT-04

- **TC:** TC-CVREWRITEASSISTANT-043 · **Requirement:** REQ-CVREWRITEASSISTANT-11
- **Bước tái hiện:** Generate (provider chậm) → trong lúc chờ, tìm phần tử `aria-busy="true"` trong vùng `aria-live`
- **Mong đợi:** skeleton đang chờ mang `aria-busy="true"` (design §7 row 12, NFR-REL-03)
- **Thực tế:** `RewriteReview` truyền `aria-busy="true"` cho `SectionCard`, nhưng `SectionCard` chỉ nhận các prop khai báo
  và không rải phần còn lại xuống `<div>` → thuộc tính không có trong DOM (`client/src/components/SectionCard/index.tsx`).
  Cùng nguyên nhân có ở skeleton của `MatchResultCard` (module khác)
- **Đã sửa:** root cause — `SectionCard` không khai báo `aria-busy` nên bỏ thuộc tính này. Fix — sửa chung với BUG-MULTIPROVIDERCOMPARE-01 / BUG-CVJDMATCHINGWIZARD-07: `SectionCard` đặt `aria-busy` lên `div` gốc; module này chỉ gỡ `test.fail()` (commit: 1585c8d).

### BUG-CVREWRITEASSISTANT-05

- **TC:** TC-CVREWRITEASSISTANT-061 · **Requirement:** REQ-CVREWRITEASSISTANT-29 (D4: chặn double-submit chỉ ở client)
- **Bước tái hiện:** `/cv-rewrite/<match>` → Generate → Select all → "Save as new CV" → double-click "Save"
- **Mong đợi:** đúng 1 request `POST /cv-rewrite/accept`, đúng 1 CV con
- **Thực tế:** chạy suite 2026-10-14 (desktop, tái hiện 2/2 lần): hai request accept cùng body được gửi rồi trang mới
  tới `/cv`. `onOk` của `SaveRewriteModal` gọi `form.submit()` (validate bất đồng bộ) và `confirmLoading` chỉ bật khi
  `accept.isPending` đã re-render, nên cú click thứ hai lọt qua trước khi nút chuyển sang loading; server không có
  idempotency (D4) nên mỗi request tạo một `Document`
  (`client/src/views/CvRewrite/components/SaveRewriteModal/index.tsx`, `mains/RewriteReview/index.tsx`)
- **Đã sửa:** root cause — `form.submit()` validate bất đồng bộ và nút chỉ chuyển loading sau khi `accept.isPending` re-render, nên cú click thứ hai lọt qua. Fix — `RewriteReview.runAccept` chặn bằng ref đồng bộ, chỉ mở lại khi accept lỗi (commit: 452404e).
