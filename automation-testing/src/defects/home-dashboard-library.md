# HOMEDASHBOARDLIBRARY — Bug log

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-HOMEDASHBOARDLIBRARY-01](#bug-homedashboardlibrary-01) | Trung bình | TC-HOMEDASHBOARDLIBRARY-034 | Kết quả `failed` bị tính vào thống kê và hiện dòng `0%` |
| [BUG-HOMEDASHBOARDLIBRARY-02](#bug-homedashboardlibrary-02) | Trung bình | TC-HOMEDASHBOARDLIBRARY-036, TC-HOMEDASHBOARDLIBRARY-037 | Lỗi tải dữ liệu bị che thành `0` / "No matches yet" |

### BUG-HOMEDASHBOARDLIBRARY-01

- **TC:** TC-HOMEDASHBOARDLIBRARY-034 · **Requirement:** REQ-HOMEDASHBOARDLIBRARY-19
- **Bước tái hiện:** user có 2 kết quả `succeeded` (80, 70) và 1 kết quả `status=failed, overallScore=0` (provider lỗi,
  `matching.service.ts` lưu kết quả lỗi theo NFR-REL-04) → mở `/`.
- **Mong đợi:** Total matches `2`, Highest `80%`, avg `75`; bảng recent chỉ 2 dòng (decisions Q1).
- **Thực tế:** `GET /match` không lọc `status` và `MatchSummaryDto` không có `status`, nên Total matches `3`, avg `50`, và
  bảng có dòng `0%` tô đỏ như một lần chấm thật.

### BUG-HOMEDASHBOARDLIBRARY-02

- **TC:** TC-HOMEDASHBOARDLIBRARY-036, TC-HOMEDASHBOARDLIBRARY-037 · **Requirement:** REQ-HOMEDASHBOARDLIBRARY-20
- **Bước tái hiện:** user đã có dữ liệu; `GET /match` (hoặc `GET /documents`) trả 500 → mở `/`.
- **Mong đợi:** trạng thái lỗi (`role="alert"`) có thể thử lại, như HDL §6, §8 #10 và NFR-REL-03 (decisions Q2).
- **Thực tế:** `StatCards` dùng `data?.length ?? 0`, `RecentMatches` không đọc `isError`: sau khi React Query hết
  lượt thử lại, thẻ hiện `0`, Highest `—` và bảng hiện empty state "No matches yet" như thể user chưa có gì.

## Đã sửa

_(chưa có)_

## Bug cũ không chuyển sang đây

- Crash xem trước PDF khi đổi ngôn ngữ ("Cannot perform Construct on a detached ArrayBuffer", đã sửa ở commit `922722e`,
  ghi trong `docs/specs/home-dashboard-library/e2e.md`): thuộc màn thư viện `/cv`, nay là module `documents`
  (REQ-DOCUMENTS-28) — theo dõi ở `defects/documents.md` nếu tái phát.
