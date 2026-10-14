# HOMEDASHBOARDLIBRARY — Trang chủ (hero, thẻ thống kê, kết quả gần đây) và lịch sử match

## API lịch sử — `GET /match`, `GET /match/:id`

- **REQ-HOMEDASHBOARDLIBRARY-01** `GET /match` trả mảng `{id, cvTitle, jdTitle, overallScore, createdAt}` chỉ của user hiện tại, mới nhất trước; `cvTitle` / `jdTitle` là title **hiện tại** của tài liệu (đổi tên tài liệu → lịch sử hiện tên mới).
- **REQ-HOMEDASHBOARDLIBRARY-02** `GET /match` chỉ dành cho user đã đăng nhập: không session hoặc session khách → 401 `{code: "SIGN_IN_REQUIRED"}`, message `auth.errors.signInRequired` theo ngôn ngữ của request.
- **REQ-HOMEDASHBOARDLIBRARY-03** Kết quả của user khác không bao giờ xuất hiện trong `GET /match`; `GET /match/:id` của user khác hoặc không tồn tại → cùng một 404 `matching.errors.matchNotFound` (không phân biệt được hai trường hợp); `:id` không phải UUID → 400.
- **REQ-HOMEDASHBOARDLIBRARY-04** `GET /match/:id` cho phép cả khách lẫn user đọc kết quả của chính mình và trả lại báo cáo y như lúc chấm (điểm overall/semantic/keyword, report), không chạy lại match.
- **REQ-HOMEDASHBOARDLIBRARY-05** Sau khi khách đăng nhập (claim), các kết quả khách đã chạy xuất hiện trong `GET /match` của tài khoản.

## Trang chủ `/` — khách / chưa đăng nhập

- **REQ-HOMEDASHBOARDLIBRARY-06** Trong lúc xác định trạng thái đăng nhập (`GET /auth/me` chưa trả) trang chủ hiện khối trống `data-testid="home-loading"`, không hiện hero khách hay dashboard user.
- **REQ-HOMEDASHBOARDLIBRARY-07** Người chưa đăng nhập và khách thấy hero khách: eyebrow `home.guest.eyebrow`, h1 `home.guest.title`, `home.guest.subtitle`, nút `home.guest.cta` → `/wizard`, nút `home.guest.signIn` → `/auth/login?returnTo=…`, ghi chú `home.guest.note` với `{{limit}}` = `guestQuota.limit` (mặc định 5), kèm khối quyền lợi tài khoản (`home.perks.eyebrow`, `home.perks.title`, 4 mục documents / history / rewrite / keys). Không có thẻ thống kê, bảng recent, và không gọi `GET /documents` hay `GET /match`.

## Trang chủ `/` — user đã đăng nhập

- **REQ-HOMEDASHBOARDLIBRARY-08** Hero CTA: h1 `home.hero.title`, `home.hero.subtitle`, nút primary `home.hero.cta` → điều hướng client-side tới `/wizard`.
- **REQ-HOMEDASHBOARDLIBRARY-09** 4 thẻ thống kê (`home-stat-saved-cvs`, `home-stat-saved-jds`, `home-stat-total-matches`, `home-stat-highest`) với nhãn `home.stat.savedCvs` / `savedJds` / `totalMatches` / `highest`: số CV đã lưu, số JD đã lưu (tài liệu chưa lưu không tính), số kết quả match, điểm cao nhất (%) kèm dòng phụ `home.stat.avg` (trung bình làm tròn).
- **REQ-HOMEDASHBOARDLIBRARY-10** Chưa có dữ liệu: ba thẻ đếm hiện `0`; "Highest score" hiện `—` (không phải 0) và không có dòng avg. Thẻ hiện skeleton khi query tương ứng đang tải.
- **REQ-HOMEDASHBOARDLIBRARY-11** Bảng `home.recent.title` hiện tối đa 5 kết quả mới nhất, mới nhất trên cùng, cột `home.cols.cv` · `jd` · `score` · `date`; score là `NN%` tô màu theo band `≥75` success, `50–74` warning, `<50` error (biên 49 / 50 / 74 / 75); ngày format theo locale UI (không ISO); hiện title, không hiện id.
- **REQ-HOMEDASHBOARDLIBRARY-12** Có hơn 5 kết quả → góc thẻ hiện chữ `home.recent.viewAll` dạng không tương tác (không phải link / nút); đúng 5 → không hiện.
- **REQ-HOMEDASHBOARDLIBRARY-13** Chưa có kết quả nào → empty state `home.recent.empty` + nút `home.recent.emptyCta` → `/wizard`.
- **REQ-HOMEDASHBOARDLIBRARY-14** Bấm một dòng (chuột, Enter hoặc Space) → `/wizard` ở bước kết quả hiển thị đúng báo cáo của match đó (đọc `GET /match/:id`), không chạy lại match. Mỗi dòng có `role="button"`, focus được bằng bàn phím, accessible name `<cvTitle> × <jdTitle>`.
- **REQ-HOMEDASHBOARDLIBRARY-15** Trang chủ chỉ đọc: tải trang không gây call AI nào; user chỉ gọi `GET /auth/me`, `GET /documents?kind=CV&saved=true`, `GET /documents?kind=JD&saved=true`, `GET /match`.
- **REQ-HOMEDASHBOARDLIBRARY-16** Responsive: thẻ thống kê 1 cột (<640px) · 2 cột (640–1023px) · 4 cột (≥1024px); title dài không làm body trang cuộn ngang ở mọi viewport (bảng cuộn trong thẻ).
- **REQ-HOMEDASHBOARDLIBRARY-17** i18n: hero, thẻ, bảng, empty state và khối khách hiển thị đủ `en` và `vi`, không hiện raw key.
- **REQ-HOMEDASHBOARDLIBRARY-18** Thời gian lưu UTC: `createdAt` của `GET /match` là ISO 8601 có hậu tố `Z` và đúng thời điểm đã lưu; chỉ đổi múi giờ khi hiển thị.
- **REQ-HOMEDASHBOARDLIBRARY-19** Thống kê và bảng recent chỉ tính kết quả `succeeded`: kết quả `failed` (provider lỗi, `overallScore=0`) không được tính vào "Total matches", không kéo highest/avg và không hiện thành dòng `0%`. Một lần chạy nhiều provider vẫn đếm theo từng kết quả.
- **REQ-HOMEDASHBOARDLIBRARY-20** `GET /documents` hoặc `GET /match` lỗi (5xx / mạng) → trang chủ hiện trạng thái lỗi (`role="alert"`) có thể thử lại, không che thành số `0` hay empty state "No matches yet".
