# HOMEDASHBOARDLIBRARY — Test cases

Requirement: `docs/requirements/home-dashboard-library.md` · Quyết định: `docs/decisions/home-dashboard-library.md`.
Mỗi test tự tạo user / khách qua fixture `homeData` (`utils/sessions.ts`) và seed tài liệu + kết quả thẳng DB (Q3), nên
không phụ thuộc user e2e dùng chung. UI spec chạy ở desktop / tablet / mobile.

## API — lịch sử match

### TC-HOMEDASHBOARDLIBRARY-001 — GET /match trả lịch sử của chính user, mới nhất trước, đủ trường

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-01
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user A có CV + JD và 3 kết quả seed ở 3 thời điểm khác nhau
- **Bước:** `GET /match` bằng phiên của A
- **Mong đợi:** 200, đúng 3 phần tử theo `createdAt` giảm dần; mỗi phần tử có đúng các khoá `id, cvTitle, jdTitle,
  overallScore, createdAt`, title là title tài liệu, điểm là `overallScore` đã seed
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-002 — đổi tên tài liệu thì lịch sử hiện tên mới

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-01
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có 1 kết quả match trên CV "old" và JD
- **Bước:** `PATCH /documents/:cvId { title: "<mới>" }` → `GET /match`
- **Mong đợi:** `cvTitle` của kết quả là title mới, `jdTitle` không đổi
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-003 — user chưa chạy match nào nhận mảng rỗng

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-01
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user mới, không có kết quả
- **Bước:** `GET /match`
- **Mong đợi:** 200 `[]`
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-004 — GET /match không có phiên trả 401 SIGN_IN_REQUIRED

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-02
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Bước:** `GET /match` không cookie
- **Mong đợi:** 401 `{ code: "SIGN_IN_REQUIRED", message: auth.errors.signInRequired (en) }`
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-005 — GET /match bằng phiên khách trả 401, kể cả khi khách đã có kết quả

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-02
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** khách có 1 kết quả seed
- **Bước:** `GET /match` bằng cookie khách
- **Mong đợi:** 401 `SIGN_IN_REQUIRED`, body không chứa dữ liệu kết quả
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-006 — thông báo 401 của GET /match theo tiếng Việt

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-02
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /match` không cookie, `Accept-Language: vi`
- **Mong đợi:** 401, message = `auth.errors.signInRequired` (vi)
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-007 — kết quả của user khác không bao giờ xuất hiện trong GET /match

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user A có 1 kết quả, user B có 2 kết quả
- **Bước:** `GET /match` bằng phiên A
- **Mong đợi:** chỉ đúng 1 id của A, không id nào của B
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-008 — GET /match/:id của user khác và id không tồn tại trả cùng một 404

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user B có 1 kết quả
- **Bước:** A gọi `GET /match/<id của B>` và `GET /match/<uuid ngẫu nhiên>`
- **Mong đợi:** cả hai 404, message `matching.errors.matchNotFound`, hai body giống hệt nhau (không lộ tồn tại)
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-009 — GET /match/:id với id không phải UUID trả 400

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-03
- **Layer:** api · **Priority:** P2
- **Bước:** user gọi `GET /match/not-a-uuid`, `GET /match/123`
- **Mong đợi:** 400
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-010 — thông báo 404 của GET /match/:id theo tiếng Việt

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-03
- **Layer:** api · **Priority:** P2
- **Bước:** `GET /match/<uuid ngẫu nhiên>` với `Accept-Language: vi`
- **Mong đợi:** 404, message = `matching.errors.matchNotFound` (vi)
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-011 — user đọc lại kết quả của mình đúng như lúc chấm

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-04
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** kết quả seed điểm 73 / 88 / 50 và report có strengths / gaps / suggestions riêng
- **Bước:** `GET /match/:id` hai lần
- **Mong đợi:** 200, `id`, `cvDocumentId`, `jdDocumentId`, ba điểm và `report` trùng giá trị đã seed; lần hai trả y hệt
  lần một; số `MatchResult` của user không tăng (không chạy lại match)
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-012 — khách đọc lại kết quả của chính mình

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-04
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** khách có 1 kết quả seed
- **Bước:** `GET /match/:id` bằng cookie khách
- **Mong đợi:** 200, điểm và report trùng giá trị đã seed
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-013 — khách không đọc được kết quả của khách khác, người chưa đăng nhập bị 401

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-03, REQ-HOMEDASHBOARDLIBRARY-04
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** khách G1 có 1 kết quả; khách G2 khác
- **Bước:** G2 gọi `GET /match/<id của G1>`; không cookie gọi cùng URL
- **Mong đợi:** G2 → 404 `matching.errors.matchNotFound`; không cookie → 401 `SIGN_IN_REQUIRED`
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-014 — createdAt là ISO UTC có hậu tố Z, đúng thời điểm đã lưu

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-18
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** kết quả seed `createdAt = 2026-01-15T23:30:00.000Z` (sát nửa đêm UTC, lệch ngày ở múi +7)
- **Bước:** `GET /match`
- **Mong đợi:** `createdAt` khớp `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$` và bằng đúng
  `2026-01-15T23:30:00.000Z`
- **Automated:** `tests/api/home-dashboard-library/match-history.api.ts`

### TC-HOMEDASHBOARDLIBRARY-015 — kết quả khách chạy xuất hiện trong lịch sử sau khi đăng nhập

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-05
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** khách có 1 kết quả; đăng nhập qua Ducker ID
- **Bước:** đăng nhập (claim) → `GET /match`
- **Mong đợi:** kết quả của khách nằm trong lịch sử của tài khoản
- **Automated:** manual — claim chỉ chạy trong `/auth/callback`; theo D5 chỉ module `auth` có fake IdP + server riêng,
  claim được phủ ở `auth` / `guest-mode` (decisions Q7)

## E2E — trang chủ khách / chưa đăng nhập

### TC-HOMEDASHBOARDLIBRARY-020 — người chưa đăng nhập thấy hero khách và quyền lợi tài khoản, không tải dữ liệu riêng

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-07, REQ-HOMEDASHBOARDLIBRARY-15
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** không cookie
- **Bước:** mở `/`
- **Mong đợi:** eyebrow, h1 `home.guest.title`, subtitle, nút `home.guest.cta`, nút `home.guest.signIn`, ghi chú
  `home.guest.note` với limit 5; khối `home.perks.*` có 4 mục; không có thẻ thống kê, không có `home.recent.title`
- **Kiểm chứng thêm:** không request `GET /documents` / `GET /match`, không request AI
- **Automated:** `tests/e2e/home-dashboard-library/guest-home.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-021 — khách thấy ghi chú hạn mức lấy từ guestQuota

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-07
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** phiên khách
- **Bước:** mở `/`
- **Mong đợi:** hero khách (không phải dashboard); ghi chú `home.guest.note` với `{{limit}}` = `guestQuota.limit` mà
  `GET /auth/me` trả; không request `GET /match`
- **Automated:** `tests/e2e/home-dashboard-library/guest-home.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-022 — nút "Start matching →" của khách mở trình ghép

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-07
- **Layer:** e2e · **Priority:** P1
- **Bước:** không cookie, mở `/` → bấm `home.guest.cta`
- **Mong đợi:** URL `/wizard`
- **Automated:** `tests/e2e/home-dashboard-library/guest-home.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-023 — nút Sign in của khách trỏ tới /auth/login kèm returnTo

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-07
- **Layer:** e2e · **Priority:** P1
- **Bước:** không cookie, mở `/` → đọc `href` của `home.guest.signIn` (không bấm: không chạm OIDC thật, D1)
- **Mong đợi:** `href` trỏ tới `<api>/auth/login` có tham số `returnTo`
- **Automated:** `tests/e2e/home-dashboard-library/guest-home.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-024 — trong lúc chờ /auth/me trang chủ chỉ hiện khối loading

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-06
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user đã đăng nhập; `GET /auth/me` bị làm chậm 2,5 s (request thật, Q6)
- **Bước:** mở `/`
- **Mong đợi:** `home-loading` hiện, chưa có hero khách lẫn hero user; khi `/auth/me` trả → `home-loading` biến mất,
  hero user hiện
- **Automated:** `tests/e2e/home-dashboard-library/guest-home.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-025 — trang chủ khách hiển thị tiếng Việt

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-17
- **Layer:** e2e · **Priority:** P2
- **Bước:** không cookie, mở `/` → đổi ngôn ngữ sang `vi` (`window.__i18n`, D4)
- **Mong đợi:** h1, nút CTA, nút sign in, ghi chú (limit 5), tiêu đề khối quyền lợi theo `vi`; không còn chuỗi `home.`
- **Automated:** `tests/e2e/home-dashboard-library/guest-home.e2e.ts`

## E2E — dashboard user

### TC-HOMEDASHBOARDLIBRARY-030 — nút "Start matching now" mở trình ghép không tải lại trang

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-08
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user mới
- **Bước:** mở `/` → bấm `home.hero.cta`
- **Mong đợi:** h1 `home.hero.title`, subtitle hiện; sau khi bấm URL `/wizard` và document không tải lại (dấu đặt trên
  `window` trước khi bấm vẫn còn)
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-031 — thẻ thống kê đếm đúng CV, JD đã lưu, số kết quả, điểm cao nhất và trung bình

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-09
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 2 CV đã lưu + 1 CV chưa lưu, 1 JD đã lưu, 3 kết quả điểm 40 / 81 / 60
- **Bước:** mở `/`
- **Mong đợi:** CV `2`, JD `1`, Total matches `3`, Highest `81%` (meter `aria-valuenow=81`), dòng phụ
  `home.stat.avg` với value `60` (round(181/3)); nhãn 4 thẻ theo `home.stat.*`
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-032 — user chưa có dữ liệu thấy số 0, điểm "—" và empty state

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-10, REQ-HOMEDASHBOARDLIBRARY-13
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user mới, không tài liệu, không kết quả
- **Bước:** mở `/`
- **Mong đợi:** ba thẻ đếm `0`; Highest `—`, không meter, không dòng avg; bảng hiện `home.recent.empty` + nút
  `home.recent.emptyCta`; không có `home.recent.viewAll`
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-033 — thẻ thống kê hiện skeleton khi lịch sử đang tải

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-10
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user có 1 kết quả; `GET /match` bị làm chậm 2,5 s (request thật, Q6)
- **Bước:** mở `/`
- **Mong đợi:** trong lúc chờ, thẻ Total matches và Highest chưa có nhãn / số mà hiện khung skeleton; khi `GET /match`
  trả → hiện `1` và điểm
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-034 — kết quả provider lỗi không được tính vào thống kê và bảng

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-19
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 2 kết quả `succeeded` (80, 70) và 1 kết quả `failed` (0, mới nhất)
- **Bước:** mở `/`
- **Mong đợi:** Total matches `2`, Highest `80%`, avg `75`; bảng chỉ 2 dòng, không có dòng `0%`
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-035 — tải trang chủ chỉ gọi các endpoint đọc, không gọi AI

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-15
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 kết quả
- **Bước:** ghi lại mọi request tới API → mở `/` → chờ bảng recent hiện
- **Mong đợi:** chỉ `GET` tới `/auth/me`, `/documents?kind=CV&saved=true`, `/documents?kind=JD&saved=true`, `/match`;
  không request nào tới `POST /match`, `/cover-letters`, `/cv-rewrite`, `/ai-credentials/*/test`
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-036 — GET /match lỗi thì trang chủ báo lỗi thay vì "No matches yet"

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-20
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 kết quả; `GET /match` trả 500 (stub, Q2)
- **Bước:** mở `/`
- **Mong đợi:** trạng thái lỗi `role="alert"` trên trang; không hiện `home.recent.empty`; Total matches không hiện `0`
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-037 — GET /documents lỗi thì thẻ thống kê báo lỗi thay vì số 0

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-20
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 2 CV đã lưu; `GET /documents` trả 500 (stub, Q2)
- **Bước:** mở `/`
- **Mong đợi:** trạng thái lỗi `role="alert"` trên trang; thẻ CV không hiện `0`
- **Automated:** `tests/e2e/home-dashboard-library/dashboard.e2e.ts`

## E2E — bảng kết quả gần đây

### TC-HOMEDASHBOARDLIBRARY-040 — bảng recent hiện kết quả mới nhất trước với title, điểm và ngày theo locale

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-11
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 3 kết quả trên 3 cặp CV/JD khác nhau, `createdAt` cách nhau 1 ngày
- **Bước:** mở `/`
- **Mong đợi:** tiêu đề `home.recent.title`, header cột `home.cols.*`; 3 dòng theo thứ tự mới nhất trước, mỗi dòng có
  cvTitle, jdTitle, `NN%`, ngày `Intl.DateTimeFormat("en")`; không dòng nào chứa id hay chuỗi ISO
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-041 — màu điểm theo band ở biên 49 / 50 / 74 / 75

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 4 kết quả điểm 49, 50, 74, 75
- **Bước:** mở `/`
- **Mong đợi:** 49 → error, 50 → warning, 74 → warning, 75 → success
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-042 — đúng 5 kết quả thì hiện 5 dòng và không có "View all"

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-12, REQ-HOMEDASHBOARDLIBRARY-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 5 kết quả
- **Bước:** mở `/`
- **Mong đợi:** 5 dòng; không có `home.recent.viewAll`
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-043 — 6 kết quả thì chỉ 5 dòng mới nhất và "View all" không bấm được

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-12, REQ-HOMEDASHBOARDLIBRARY-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 6 kết quả, kết quả cũ nhất có CV title riêng
- **Bước:** mở `/`
- **Mong đợi:** 5 dòng, không có dòng cũ nhất; Total matches `6`; `home.recent.viewAll` hiện nhưng không phải link /
  nút
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-044 — nút "Match now" của empty state mở trình ghép

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-13
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user mới, không kết quả
- **Bước:** mở `/` → bấm `home.recent.emptyCta`
- **Mong đợi:** URL `/wizard`
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-045 — bấm một dòng mở đúng báo cáo của kết quả đó mà không chạy lại match

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-14
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có 2 kết quả, mỗi kết quả có strength riêng trong report
- **Bước:** mở `/` → bấm dòng của kết quả cũ hơn
- **Mong đợi:** URL `/wizard`, báo cáo hiện strength của đúng kết quả đó (không phải kết quả kia); có
  `GET /match/<id>`; không có `POST /match`, `POST /match/runs`
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-046 — dòng kết quả mở được bằng bàn phím Enter và Space

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-14
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 kết quả
- **Bước:** mở `/` → focus dòng → Enter; quay lại `/` → focus dòng → Space
- **Mong đợi:** dòng là `role="button"` tên `<cvTitle> × <jdTitle>`, nhận focus; mỗi phím mở báo cáo của kết quả đó ở
  `/wizard`
- **Automated:** `tests/e2e/home-dashboard-library/recent-matches.e2e.ts`

## E2E — ngôn ngữ và bố cục

### TC-HOMEDASHBOARDLIBRARY-050 — dashboard user hiển thị tiếng Việt

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-17, REQ-HOMEDASHBOARDLIBRARY-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 kết quả
- **Bước:** mở `/` → đổi ngôn ngữ sang `vi` (`window.__i18n`, D4)
- **Mong đợi:** h1, CTA, nhãn 4 thẻ, avg, tiêu đề + header cột bảng theo `vi`; ngày theo `Intl.DateTimeFormat("vi")`;
  không còn chuỗi `home.`
- **Automated:** `tests/e2e/home-dashboard-library/layout-i18n.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-051 — empty state tiếng Việt

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-17, REQ-HOMEDASHBOARDLIBRARY-13
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user mới
- **Bước:** mở `/` → đổi sang `vi`
- **Mong đợi:** `home.recent.empty` và `home.recent.emptyCta` theo `vi`
- **Automated:** `tests/e2e/home-dashboard-library/layout-i18n.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-052 — thẻ thống kê xếp 1 / 2 / 4 cột theo bề rộng màn hình

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user mới; chạy ở desktop (1280), tablet (820), mobile (390)
- **Bước:** mở `/` → đo vị trí 4 thẻ
- **Mong đợi:** số thẻ trên hàng đầu = 4 (≥1024) / 2 (640–1023) / 1 (<640)
- **Automated:** `tests/e2e/home-dashboard-library/layout-i18n.e2e.ts`

### TC-HOMEDASHBOARDLIBRARY-053 — title dài không làm trang cuộn ngang

- **Requirement:** REQ-HOMEDASHBOARDLIBRARY-16
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user có 1 kết quả với CV / JD title 200 ký tự không khoảng trắng
- **Bước:** mở `/` ở từng viewport; thêm lượt 375 px
- **Mong đợi:** `scrollWidth` của trang ≤ bề rộng viewport; dòng kết quả vẫn hiện
- **Automated:** `tests/e2e/home-dashboard-library/layout-i18n.e2e.ts`
