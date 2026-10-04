# Đang làm · Việc tiếp theo · Nợ

> **Trả lời:** Đang làm gì, tiếp theo làm gì, và đang nợ những gì?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-10-04 · commit —
> **Cập nhật khi:** bắt đầu/kết thúc một việc · brainstorm ra việc mới · cố ý đi đường tắt

<!-- CÁCH ĐIỀN
Mục "Đang làm" là chỗ một phiên làm việc MỚI đọc đầu tiên. Cập nhật nó TRƯỚC KHI
DỪNG phiên, không phải sau.
Mục "Nợ kỹ thuật" chỉ ghi thứ CỐ Ý làm tạm, ghi NGAY LÚC ĐÓ. Bug không thuộc đây.
KHÔNG chứa: tính năng ngoài phạm vi (-> 01-product/overview.md §Non-Goals).
-->

## Đang làm

Không có việc nào đang dở.

**Đăng nhập Ducker ID + chế độ khách — xong, đang review/merge** (2026-10-04, branch
`feat/ducker-id-sign-in`, [`specs/ducker-id-sign-in/`](../specs/ducker-id-sign-in/design.md)).
FR-18 và FR-21 → `xong`, US-09; [ADR-0022](../decisions/0022-dang-nhap-bff-session-rieng.md) và
[ADR-0023](../decisions/0023-che-do-khach-user-tam-24h.md) thay ADR-0006/0008. Mock user bị xoá
khỏi DB và `STUB_USER_ID` không còn. Đóng nợ #2 và #8; sáu chỗ cố ý hoãn ghi thành nợ #9–#14
dưới đây. Việc còn lại là merge, rồi đăng ký app trong Ducker ID cho môi trường thật
(README, mục setup).

## Việc tiếp theo

FR-18 + FR-21 đã xong và rời bảng này; FR-16 / FR-17 dẫn đầu.

| Việc | Liên quan | Ưu tiên | Vì sao ưu tiên đó |
| --- | --- | --- | --- |
| Xoá sạch dữ liệu user, xác nhận hai bước | FR-16 · US-08 | cao | Nửa còn lại của thứ FR-15 vừa mở ra: đã cho tải bản sao thì phải cho rút lại |
| Nhật ký tiết lộ dữ liệu `DataDisclosure`, ghi trước call AI, fail-closed | FR-17 · US-08 | cao | Ràng buộc cứng của [ADR-0016](../decisions/0016-nhat-ky-tiet-lo-la-bang-rieng.md); càng nhiều provider càng khó thêm về sau |
| Trang lịch sử match riêng: `/history` + link sidebar, lọc theo CV/JD, sắp xếp theo điểm/ngày, `DELETE /match/:id` | FR-08 · US-07 | cao | API đã có sẵn, chỉ thiếu FE + một endpoint. Rẻ nhất trong bảng |
| Chuẩn hoá thang điểm keyword giữa VI và EN | Nợ #1 dưới | cao | Đang làm sai con số user nhìn thấy — xem mục Nợ |
| Batch ranking nhiều CV cho một JD | FR-19 | thấp | Đây mới là lúc cần pgvector + hàng đợi nền |
| `Document.parsedContent` chuẩn hoá theo section + skill-level overlap | Nợ #3, #4 | thấp | LLM đã gánh phần "thiếu gì"; đây chỉ nâng minh bạch của con số keyword |

## Nợ kỹ thuật — cố ý làm tạm

| Chỗ nào | Đã đánh đổi gì | Vì sao chấp nhận | Khi nào buộc phải trả |
| --- | --- | --- | --- |
| **#1** `server/src/modules/matching/tokenizer.ts` | `keywordScore` của tiếng Việt và tiếng Anh **không cùng thang**: hai tài liệu VI bất kỳ đã có sàn trùng lặp ~30–43%, tiếng Anh ~5% | Hệ quả trực tiếp của [ADR-0014](../decisions/0014-keyword-tieng-viet-cap-am-tiet.md) — chấm ở cấp âm tiết. ADR đúng về **tín hiệu**, nhưng không nói gì về **sàn nhiễu** | Ngay. Bằng chứng đo được (2026-08-11): cùng JD-03, CV tiếng Việt **43%** còn CV tiếng Anh **của cùng một người** chỉ **5%**; trong 55 token trùng của cặp 43% chỉ 3 token là kỹ thuật. Nghĩa là **43% sai nghề > 33% đúng nghề**. Cách trả: trừ baseline theo ngôn ngữ, hoặc đổi sang IDF/TF-IDF thay vì đếm overlap thuần — hoặc tối thiểu là nói rõ giới hạn trên UI. Tái hiện: `pnpm seed:mock` rồi match CV-01↔JD-03 và CV-02↔JD-03 |
| ~~**#2**~~ **ĐÃ TRẢ 2026-10-04** `server/prisma/schema.prisma` · `User` | Thiếu `isMock`, `email`, `fullName`, `avatar`, `phone`, `updatedAt` — `erd.md` đánh 📝 cho các field này | Chưa có auth nên chưa ai đọc tới. Hiện xoá dữ liệu mock theo id hằng số thay vì `DELETE FROM users WHERE is_mock = true` | **Đã đóng bởi FR-18:** thêm các cột mirror (`email`, `fullName`, `avatar`, `updatedAt`, cùng `externalSub`, `isGuest`, `guestExpiresAt`); `isMock` **bỏ hẳn** vì mock user đã bị xoá khỏi DB — [ADR-0023](../decisions/0023-che-do-khach-user-tam-24h.md); `phone` bỏ vì Ducker ID không có claim đó. Giữ dòng để ID #2 không bị tái dùng |
| **#3** `Document.parsedContent` (jsonb) | Cột có trong schema nhưng **luôn ghi `null`**; FE không đọc | Cả FR-12 lẫn FR-14 đã ship mà không cần nó: rewrite neo vào **đoạn nguyên văn** (thứ máy kiểm được), so sánh phiên bản cần `parentId`. Step Review là read-only nên cũng không có UI sửa tay | Khi làm skill-level overlap (#4). Không chặn gì khác |
| **#4** `keywordScore` chạy ở cấp token, không phải cấp skill | Breakdown chỉ hiện một số %, không nói **khớp cái gì / thiếu cái gì** ở cấp kỹ năng | Nice-to-have, không phải nợ thật — LLM đã trả lời "thiếu gì". Cần #3 xong trước | Không có mốc bắt buộc. Ưu tiên thấp nhất |
| **#5** Gate B (MCP walk) của E2E chưa chạy cho `ai-credentials`, `cv-rewrite-assistant`, `cv-version-comparison`, `cover-letter-generator`, `multi-provider-compare` | Chỉ có gate A (suite Playwright committed) xanh | Quy trình dual-gate đã bỏ khi chuyển sang flow mới 2026-09-03 | Không còn là nợ theo quy trình mới. Giữ lại đây một kỳ để ai đọc `docs/specs/*/e2e.md` không tưởng là đã walk |
| **#6** `client/src/routes/__root.tsx` — không có preload cho woff2 | Ba webfont tự host không được preload, nên chúng chỉ được phát hiện sau khi CSS parse xong ⇒ nguy cơ nhấp nháy chữ khi SSR hydrate | Vite content-hash tên file woff2 (quan sát được ví dụ `inter-latin-400-normal-C38fXH4l.woff2` dưới `/assets/`), nên đường dẫn tĩnh `/fonts/inter-latin-400.woff2` không tồn tại. Một preload trỏ sai còn tệ hơn không preload — trình duyệt tải một file rồi bỏ đi. `font-display: swap` đang gánh phần này | Khi đo được nhấp nháy thật trên app đang chạy, hoặc khi thêm một plugin/manifest cho phép lấy tên file đã hash lúc build |
| **#7** Hit-area của control trên mobile dưới 44px ở nhiều trang | Đo trên app thật ở 390px: `Open menu` (hamburger) **32×32**, `Start matching` **129×32**, `Add credential` **152×32**; `Back`/`Next`/`Download my data`/`Match now` **40px**. NFR-A11Y-03 đòi **≥44×44** | Không phải nợ do feature này sinh ra — nó có trước, và phạm vi a11y của `ui-redesign` là **tương phản ở tầng token** (design.md §6), không phải hit-area. Sửa hết là đụng ~7 component trên 6 trang và cần một quyết định riêng: nâng toàn cục bằng `ConfigProvider.componentSize` hay sửa từng nút | Khi làm một feature a11y riêng. **Ba nút header step 4 đã sửa** trong PR này (324×44 ở mobile) vì design.md §7 tự khẳng định chúng đạt NFR-A11Y-03. Gốc của cả loạt: `MASTER.md` §4 từng ghi ngưỡng **40px** trong khi NFR ghi **44px** — đã gộp về 44px 2026-09-07 |
| ~~**#8**~~ **ĐÃ TRẢ 2026-10-04** `client/src/views/Wizard/components/ResultActionBar/index.tsx` — nút `Save report` **không có `onClick`** | Một nút `type="primary" size="large"` bấm vào không xảy ra gì | Đã inert từ trước feature này (trên `main` nó nằm trong `StepResult` và cũng không có handler), nên **không phải regression**. Nhưng Task 8 ghim thanh hành động ở cấp shell nên nó giờ **luôn trên màn**, khiến một nút primary vô tác dụng nổi bật hơn nhiều. Nối dây nó cần một quyết định sản phẩm trước: "save report" là gì khi `MatchResult` **đã** được lưu tự động? | **Đã đóng:** nút `Save report` bị gỡ khỏi UI (kết quả đã tự lưu khi chạy; với khách thì có `KeepResultCallout` mời đăng nhập để giữ). Giữ dòng để ID #8 không bị tái dùng |
| **#9** `server/src/modules/auth` — dọn khách hết hạn là **lazy purge** | Không có scheduler: khách hết hạn chỉ bị xoá khi có request chạm tới, nên row và file của khách bỏ đi có thể nằm lại DB lâu hơn 24 giờ | Hạ tầng chưa có tiến trình nền và overview §4 đã loại retention tự động. Chỉ ảnh hưởng dung lượng, không lộ dữ liệu: khách hết hạn không còn đăng nhập được vào session | Khi có scheduler, hoặc khi số row khách vượt mức một câu lệnh purge xoá nhanh được |
| **#10** `AuthGuard` + `@AllowGuest({ createGuest })` | Guard tạo row khách **trước** khi body được validate: một `POST /documents` ẩn danh sai body vẫn sinh ra một khách (bị purge sau 24 giờ) | Chuyển tạo-khách xuống sau validation phải tách guard khỏi pipe, phức tạp hơn giá trị. Quota khách (NFR-COST-04) trừ **trước call AI**, không phải lúc tạo row, nên **không** giới hạn việc tạo row. Phanh thật là throttler global (NFR-SEC-07, 100 req/60s) và lazy purge 24 giờ; cái giá chỉ là row trong DB, không tốn tiền AI | Khi thấy row khách rác đáng kể, hoặc khi dựng scheduler (#9) |
| **#11** `server/src/main.ts` — không đặt `trust proxy` | Sau reverse proxy mọi khách cùng một IP nên **dùng chung một bucket quota** | Local không có proxy; đặt `trust proxy` sai còn tệ hơn vì client giả `X-Forwarded-For` được | **Bắt buộc trước khi deploy sau proxy** |
| **#12** `mcv_oauth` / `mcv_session` — login CSRF qua cookie same-site | Ứng dụng khác cùng site (app khác trên `localhost` khi dev, subdomain anh em ở prod) có thể gieo cookie để đăng nhập nạn nhân vào tài khoản của kẻ tấn công. Claim đã bị chặn (guest id niêm trong `mcv_oauth`), nhưng việc đăng nhập thì chưa | Chỉ khai thác được khi có app không tin cậy cùng site; dev local thì không có | Khi chạy qua https: dùng tiền tố `__Host-` cho cookie |
| **#13** `SESSION_SECRET` | Một secret vừa làm khoá AES cho cookie `mcv_oauth` vừa làm khoá HMAC cho IP khách | Hai chỗ dùng (khoá AES cho `mcv_oauth`, HMAC cho IP khách) không rò sang nhau trong vận hành bình thường nên một secret chấp nhận được cho tới khi cần xoay khoá; gọn cho MVP, một biến env | Khi có lý do xoay vòng khoá: dẫn xuất khoá riêng theo mục đích bằng HKDF |
| **#14** `OidcClientService` — cache discovery và JWKS | Discovery cache suốt vòng đời process; JWKS refetch khi gặp `kid` lạ nhưng **không có cooldown**, nên token `kid` bậy lặp lại làm gọi IdP liên tục | Ducker ID là IdP của chính mình, hiếm xoay khoá; `/auth/login` và `/auth/callback` có throttle riêng chặt hơn (NFR-SEC-13, 20 req/60s) nên token `kid` bậy bị hãm | Khi IdP đổi issuer/khoá khi đang chạy, hoặc khi deploy public: thêm TTL cho discovery và cooldown cho refetch |

## Câu hỏi còn treo

| Câu hỏi | Chốt ở đâu |
| --- | --- |
| Cấu trúc `parsedContent` chuẩn hoá ra sao (section CV / JD)? | design của feature dùng tới nó |
| Stopword tiếng Việt lấy từ danh sách công khai nào, hay tự soạn theo ngữ cảnh CV/JD? | design của feature |
| `DataDisclosure` có thêm `credentialId` không (audit *"gửi bằng khoá cá nhân nào"*)? | design của FR-17 |
| Deploy target — Docker Compose local? cloud nào? | chưa có mốc. [ADR-0009](../decisions/0009-byo-token-luu-server-ma-hoa.md) từng chặn deploy public cho tới khi FR-18 xong (đã xong); deploy sau proxy còn nợ #11 |
