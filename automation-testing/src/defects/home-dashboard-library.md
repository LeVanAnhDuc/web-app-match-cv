# HOMEDASHBOARDLIBRARY — Bug log

## Đang mở

_(không có)_

## Đã sửa

### BUG-HOMEDASHBOARDLIBRARY-01

- **TC:** TC-HOMEDASHBOARDLIBRARY-034 · **Requirement:** REQ-HOMEDASHBOARDLIBRARY-19
- **Bước tái hiện:** user có 2 kết quả `succeeded` (80, 70) và 1 kết quả `status=failed, overallScore=0` (provider lỗi,
  `matching.service.ts` lưu kết quả lỗi theo NFR-REL-04) → mở `/`.
- **Mong đợi:** Total matches `2`, Highest `80%`, avg `75`; bảng recent chỉ 2 dòng (decisions Q1).
- **Thực tế:** `GET /match` không lọc `status` và `MatchSummaryDto` không có `status`, nên Total matches `3`, avg `50`, và
  bảng có dòng `0%` tô đỏ như một lần chấm thật.
- **Đã sửa:** root cause — `MatchingService.list()` lọc `findMany` chỉ theo `userId`, nên dòng `failed` mà orchestrator
  lưu khi provider lỗi lọt vào `GET /match`. Fix — `list()` lọc thêm `status: succeeded` (DTO giữ nguyên theo REQ-01;
  kết quả lỗi vẫn đọc được qua `GET /match/:id`, `GET /match/runs/:id`) (commit: 8f3172d).

### BUG-HOMEDASHBOARDLIBRARY-02

- **TC:** TC-HOMEDASHBOARDLIBRARY-036, TC-HOMEDASHBOARDLIBRARY-037 · **Requirement:** REQ-HOMEDASHBOARDLIBRARY-20
- **Bước tái hiện:** user đã có dữ liệu; `GET /match` (hoặc `GET /documents`) trả 500 → mở `/`.
- **Mong đợi:** trạng thái lỗi (`role="alert"`) có thể thử lại, như HDL §6, §8 #10 và NFR-REL-03 (decisions Q2).
- **Thực tế:** `StatCards` dùng `data?.length ?? 0`, `RecentMatches` không đọc `isError`: sau khi React Query hết
  lượt thử lại, thẻ hiện `0`, Highest `—` và bảng hiện empty state "No matches yet" như thể user chưa có gì.
- **Đã sửa:** root cause — `StatCards` / `RecentMatches` chỉ đọc `data` / `isLoading`, query lỗi rơi về giá trị mặc
  định `0` / `[]`. Fix — thẻ có query lỗi hiện `—`; mỗi lỗi có một `Alert role="alert"` kèm nút Try again refetch đúng
  query lỗi (`home.error.documents` trên lưới thẻ, `home.error.matches` thay bảng recent) (commit: 4a1dd12).

## Bug cũ không chuyển sang đây

- Crash xem trước PDF khi đổi ngôn ngữ ("Cannot perform Construct on a detached ArrayBuffer", đã sửa ở commit `922722e`,
  ghi trong `docs/specs/home-dashboard-library/e2e.md`): thuộc màn thư viện `/cv`, nay là module `documents`
  (REQ-DOCUMENTS-28) — theo dõi ở `defects/documents.md` nếu tái phát.
