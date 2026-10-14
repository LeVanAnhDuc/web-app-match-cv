# CVVERSIONCOMPARISON — Bug log

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-CVVERSIONCOMPARISON-01](#bug-cvversioncomparison-01) | Thấp | TC-CVVERSIONCOMPARISON-044 | Cảnh báo khác model chỉ nêu chat model; khác embedding thì đọc thành "gpt-4o-mini và gpt-4o-mini" |
| [BUG-CVVERSIONCOMPARISON-02](#bug-cvversioncomparison-02) | Trung bình | TC-CVVERSIONCOMPARISON-029 | Lỗi 400 của `/comparisons` và `/documents/:id/parent` không có `code` máy đọc được |
| [BUG-CVVERSIONCOMPARISON-03](#bug-cvversioncomparison-03) | Trung bình | TC-CVVERSIONCOMPARISON-058, TC-CVVERSIONCOMPARISON-059 | Trang so sánh đoán lý do lỗi 400 theo việc URL có `?jd` hay không |
| [BUG-CVVERSIONCOMPARISON-04](#bug-cvversioncomparison-04) | Thấp | TC-CVVERSIONCOMPARISON-067 | Modal lineage gộp mọi 400 thành "tự trỏ / bản mới hơn", kể cả chuỗi quá dài |
| [BUG-CVVERSIONCOMPARISON-05](#bug-cvversioncomparison-05) | Thấp | TC-CVVERSIONCOMPARISON-069 | Modal lineage không đưa focus vào Select khi mở, đóng không trả focus về nút Actions |

### BUG-CVVERSIONCOMPARISON-01

- **TC:** TC-CVVERSIONCOMPARISON-044 · **Requirement:** REQ-CVVERSIONCOMPARISON-16
- **Bước tái hiện:** v1 → v2 match cùng chat model (`openai/gpt-4o-mini`), khác embedding model (`text-embedding-3-small` / `-large`); mở `/compare/<v2>`.
- **Mong đợi:** hint của cảnh báo nêu hai embedding model thực sự khác nhau (semantic score nằm ở hai không gian vector khác nhau — invariant #10).
- **Thực tế:** `ComparisonReport` truyền `baseResult.chatModel` / `revisionResult.chatModel` vào `compare.modelWarning.hint` bất kể model nào khác, nên câu đọc thành "Scores and gap wording from openai/gpt-4o-mini and openai/gpt-4o-mini are not strictly comparable". Quyết định Q3 = (a).

### BUG-CVVERSIONCOMPARISON-02

- **TC:** TC-CVVERSIONCOMPARISON-029 · **Requirement:** REQ-CVVERSIONCOMPARISON-06, REQ-CVVERSIONCOMPARISON-23
- **Bước tái hiện:** gây 8 lớp 400 (`notCv`, `noParent`, `jdNotComparable`, `lineageSelf`, `lineageParentNotFound`, `lineageKindMismatch`, `lineageCycle`, `lineageTooDeep`).
- **Mong đợi:** mỗi body có `code` máy đọc được, khác nhau giữa các lớp (như `SIGN_IN_REQUIRED` của auth), để client không phải đoán.
- **Thực tế:** body là envelope mặc định của Nest `{ statusCode, message, error }` — chỉ có message đã dịch, không có `code`. Đây là gốc của BUG-03 và BUG-04. Quyết định Q4 = (a).

### BUG-CVVERSIONCOMPARISON-03

- **TC:** TC-CVVERSIONCOMPARISON-058, TC-CVVERSIONCOMPARISON-059 · **Requirement:** REQ-CVVERSIONCOMPARISON-20
- **Bước tái hiện:** (1) mở `/compare/<CV không có cha>?jd=<JD đã match>`; (2) mở `/compare/<id của một JD>` không `?jd`.
- **Mong đợi:** (1) `compare.err.noParent` — server trả `noParent`; (2) thông báo riêng cho lớp `notCv`, không phải "chưa khai bản trước".
- **Thực tế:** `errorMessage()` trong `ComparisonReport` trả `compare.err.jdNotComparable` cho **mọi** 400 khi URL có `?jd` và `compare.err.noParent` cho **mọi** 400 khi không có, nên (1) báo "Neither version has been matched against that job description" và (2) báo "This CV is not marked as a new version…". FE cũng chưa có copy cho `notCv`. Quyết định Q4 = (a).

### BUG-CVVERSIONCOMPARISON-04

- **TC:** TC-CVVERSIONCOMPARISON-067 · **Requirement:** REQ-CVVERSIONCOMPARISON-25
- **Bước tái hiện:** `/cv` → modal "Version history" của một CV → chọn đuôi của chuỗi 21 CV → Save (server 400 `lineageTooDeep`).
- **Mong đợi:** Alert nêu đúng lý do (chuỗi phiên bản quá dài).
- **Thực tế:** `useCvLibrary.confirmLineage` hiện `library.lineage.rejected` ("a document can't be a version of itself or of its own newer version") cho mọi 400 — sai lý do với `lineageTooDeep` (và với `lineageKindMismatch` / `lineageParentNotFound` khi gọi trực tiếp). Quyết định Q4 = (a).

### BUG-CVVERSIONCOMPARISON-05

- **TC:** TC-CVVERSIONCOMPARISON-069 · **Requirement:** REQ-CVVERSIONCOMPARISON-28
- **Bước tái hiện:** `/cv` → Actions của một CV → "Mark as a new version of…" → (bàn phím) `Esc`.
- **Mong đợi:** khi mở, focus nằm ở combobox "Previous version"; sau `Esc`, focus trở về nút Actions của hàng (design §7 row 12).
- **Thực tế:** `DocumentLineageModal` không đặt `autoFocus` cho Select, nên antd Modal giữ focus ở khung dialog; focus khi đóng được trả về menu item của dropdown đã đóng chứ không phải nút Actions. Đã quan sát trên trình duyệt (14.10.2026, desktop / tablet / mobile): ngay sau khi mở, combobox "Previous version" không có focus.

## Đã sửa

| Bug | TC | Tóm tắt |
|---|---|---|
| BUG-CVVERSIONCOMPARISON-06 | TC-CVVERSIONCOMPARISON-064 | Double-click Save tạo 2 `PATCH /documents/:id/parent` |

### BUG-CVVERSIONCOMPARISON-06

- **TC:** TC-CVVERSIONCOMPARISON-064 · **Requirement:** REQ-CVVERSIONCOMPARISON-24
- **Bước tái hiện:** modal lineage → chọn bản trước → double-click Save.
- **Mong đợi:** đúng 1 PATCH.
- **Thực tế (lúc phát hiện):** 2 PATCH — `okButtonProps.disabled` dựa vào `mutation.isPending`, hai lần bấm nằm trong cùng một tick trước khi React re-render.
- **Sửa:** chốt bằng `useRef` (`lineageInFlight` trong `useCvLibrary`). Gom từ vòng 3 của `docs/specs/cv-version-comparison/e2e.md` (bug thật duy nhất của suite cũ); các vòng 1, 2, 4 là lỗi test / hạ tầng, không ghi thành bug.
