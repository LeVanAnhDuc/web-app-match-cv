# Đang làm · Việc tiếp theo · Nợ

> **Trả lời:** Đang làm gì, tiếp theo làm gì, và đang nợ những gì?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** bắt đầu/kết thúc một việc · brainstorm ra việc mới · cố ý đi đường tắt

<!-- CÁCH ĐIỀN
Mục "Đang làm" là chỗ một phiên làm việc MỚI đọc đầu tiên. Cập nhật nó TRƯỚC KHI
DỪNG phiên, không phải sau.
Mục "Nợ kỹ thuật" chỉ ghi thứ CỐ Ý làm tạm, ghi NGAY LÚC ĐÓ. Bug không thuộc đây.
KHÔNG chứa: tính năng ngoài phạm vi (-> 01-product/overview.md §Non-Goals).
-->

## Đang làm

Không có việc nào đang dở.

**Thiết kế lại toàn bộ UI — xong 2026-09-07** (branch `worktree-ui-redesign`,
[`specs/ui-redesign/`](../specs/ui-redesign/design.md)). Bootstrap lại token theo
[ADR-0021](../decisions/0021-token-zinc-cyan-ba-typeface.md): zinc + cyan, ba typeface tự
host, signature element đổi sang `readout`. Feature **chỉ ở tầng trình bày** — không FR mới,
không US mới, không đổi endpoint nào, nên `scope.md` và `journeys.md` không đổi.

Verify đã chạy trên app thật (Task 13): 4 bề rộng × 2 theme đều không tràn ngang và
`Quay lại`/`Tiếp tục` luôn trong viewport; **0 cảnh báo hydration trên bản build**
(cảnh báo thấy ở dev là artifact của Vite, không phải thứ người dùng gặp); subset
vietnamese của Inter tải đúng khi có chữ có dấu, không rơi fallback.

Ba thứ tìm ra khi nhìn app thật và đã sửa trong cùng PR: nhãn thang của `Readout`
dùng `text-faint` (3.67:1 ở dark — Task 11 sót); ba nút header step 4 cao 32px thay vì
full-width 44px như design.md §7 khẳng định; và `MASTER.md` §4 ghi ngưỡng hit-area
**40px** lệch với NFR-A11Y-03 (**44px**) — chính chỗ lệch đó là gốc của hai lỗi trên.
Phần hit-area còn lại của app là nợ **#7**.

Chuyển dự án sang bộ tài liệu hai tầng của `scaffold-webapp-project` (2026-09-03): xong.

## Việc tiếp theo

| Việc | Liên quan | Ưu tiên | Vì sao ưu tiên đó |
| --- | --- | --- | --- |
| Trang lịch sử match riêng: `/history` + link sidebar, lọc theo CV/JD, sắp xếp theo điểm/ngày, `DELETE /match/:id` | FR-08 · US-07 | cao | API đã có sẵn, chỉ thiếu FE + một endpoint. Rẻ nhất trong bảng |
| Xoá sạch dữ liệu user, xác nhận hai bước | FR-16 · US-08 | cao | Nửa còn lại của thứ FR-15 vừa mở ra: đã cho tải bản sao thì phải cho rút lại |
| Nhật ký tiết lộ dữ liệu `DataDisclosure`, ghi trước call AI, fail-closed | FR-17 · US-08 | cao | Ràng buộc cứng của [ADR-0016](../decisions/0016-nhat-ky-tiet-lo-la-bang-rieng.md); càng nhiều provider càng khó thêm về sau |
| Chuẩn hoá thang điểm keyword giữa VI và EN | Nợ #1 dưới | cao | Đang làm sai con số user nhìn thấy — xem mục Nợ |
| Auth / SSO qua Ducker ID; kèm cột `isMock` + profile mirror | FR-18 | trung bình | Mở khoá precondition của [ADR-0009](../decisions/0009-byo-token-luu-server-ma-hoa.md); trước đó app không được deploy public |
| Batch ranking nhiều CV cho một JD | FR-19 | thấp | Đây mới là lúc cần pgvector + hàng đợi nền |
| `Document.parsedContent` chuẩn hoá theo section + skill-level overlap | Nợ #3, #4 | thấp | LLM đã gánh phần "thiếu gì"; đây chỉ nâng minh bạch của con số keyword |

## Nợ kỹ thuật — cố ý làm tạm

| Chỗ nào | Đã đánh đổi gì | Vì sao chấp nhận | Khi nào buộc phải trả |
| --- | --- | --- | --- |
| **#1** `server/src/modules/matching/tokenizer.ts` | `keywordScore` của tiếng Việt và tiếng Anh **không cùng thang**: hai tài liệu VI bất kỳ đã có sàn trùng lặp ~30–43%, tiếng Anh ~5% | Hệ quả trực tiếp của [ADR-0014](../decisions/0014-keyword-tieng-viet-cap-am-tiet.md) — chấm ở cấp âm tiết. ADR đúng về **tín hiệu**, nhưng không nói gì về **sàn nhiễu** | Ngay. Bằng chứng đo được (2026-08-11): cùng JD-03, CV tiếng Việt **43%** còn CV tiếng Anh **của cùng một người** chỉ **5%**; trong 55 token trùng của cặp 43% chỉ 3 token là kỹ thuật. Nghĩa là **43% sai nghề > 33% đúng nghề**. Cách trả: trừ baseline theo ngôn ngữ, hoặc đổi sang IDF/TF-IDF thay vì đếm overlap thuần — hoặc tối thiểu là nói rõ giới hạn trên UI. Tái hiện: `yarn seed:mock` rồi match CV-01↔JD-03 và CV-02↔JD-03 |
| **#2** `server/prisma/schema.prisma` · `User` | Thiếu `isMock`, `email`, `fullName`, `avatar`, `phone`, `updatedAt` — `erd.md` đánh 📝 cho các field này | Chưa có auth nên chưa ai đọc tới. Hiện xoá dữ liệu mock theo id hằng số thay vì `DELETE FROM users WHERE is_mock = true` | Khi làm FR-18, hoặc sớm hơn nếu cần clean data theo cờ ([ADR-0007](../decisions/0007-match-cv-so-huu-bang-user.md) · [ADR-0008](../decisions/0008-mock-user-la-user-that.md)) |
| **#3** `Document.parsedContent` (jsonb) | Cột có trong schema nhưng **luôn ghi `null`**; FE không đọc | Cả FR-12 lẫn FR-14 đã ship mà không cần nó: rewrite neo vào **đoạn nguyên văn** (thứ máy kiểm được), so sánh phiên bản cần `parentId`. Step Review là read-only nên cũng không có UI sửa tay | Khi làm skill-level overlap (#4). Không chặn gì khác |
| **#4** `keywordScore` chạy ở cấp token, không phải cấp skill | Breakdown chỉ hiện một số %, không nói **khớp cái gì / thiếu cái gì** ở cấp kỹ năng | Nice-to-have, không phải nợ thật — LLM đã trả lời "thiếu gì". Cần #3 xong trước | Không có mốc bắt buộc. Ưu tiên thấp nhất |
| **#5** Gate B (MCP walk) của E2E chưa chạy cho `ai-credentials`, `cv-rewrite-assistant`, `cv-version-comparison`, `cover-letter-generator`, `multi-provider-compare` | Chỉ có gate A (suite Playwright committed) xanh | Quy trình dual-gate đã bỏ khi chuyển sang flow mới 2026-09-03 | Không còn là nợ theo quy trình mới. Giữ lại đây một kỳ để ai đọc `docs/specs/*/e2e.md` không tưởng là đã walk |
| **#6** `client/src/routes/__root.tsx` — không có preload cho woff2 | Ba webfont tự host không được preload, nên chúng chỉ được phát hiện sau khi CSS parse xong ⇒ nguy cơ nhấp nháy chữ khi SSR hydrate | Vite content-hash tên file woff2 (quan sát được ví dụ `inter-latin-400-normal-C38fXH4l.woff2` dưới `/assets/`), nên đường dẫn tĩnh `/fonts/inter-latin-400.woff2` không tồn tại. Một preload trỏ sai còn tệ hơn không preload — trình duyệt tải một file rồi bỏ đi. `font-display: swap` đang gánh phần này | Khi đo được nhấp nháy thật trên app đang chạy, hoặc khi thêm một plugin/manifest cho phép lấy tên file đã hash lúc build |
| **#7** Hit-area của control trên mobile dưới 44px ở nhiều trang | Đo trên app thật ở 390px: `Open menu` (hamburger) **32×32**, `Start matching` **129×32**, `Add credential` **152×32**; `Back`/`Next`/`Download my data`/`Match now` **40px**. NFR-A11Y-03 đòi **≥44×44** | Không phải nợ do feature này sinh ra — nó có trước, và phạm vi a11y của `ui-redesign` là **tương phản ở tầng token** (design.md §6), không phải hit-area. Sửa hết là đụng ~7 component trên 6 trang và cần một quyết định riêng: nâng toàn cục bằng `ConfigProvider.componentSize` hay sửa từng nút | Khi làm một feature a11y riêng. **Ba nút header step 4 đã sửa** trong PR này (324×44 ở mobile) vì design.md §7 tự khẳng định chúng đạt NFR-A11Y-03. Gốc của cả loạt: `MASTER.md` §4 từng ghi ngưỡng **40px** trong khi NFR ghi **44px** — đã gộp về 44px 2026-09-07 |
| **#8** `client/src/views/Wizard/components/ResultActionBar/index.tsx` — nút `Save report` **không có `onClick`** | Một nút `type="primary" size="large"` bấm vào không xảy ra gì | Đã inert từ trước feature này (trên `main` nó nằm trong `StepResult` và cũng không có handler), nên **không phải regression**. Nhưng Task 8 ghim thanh hành động ở cấp shell nên nó giờ **luôn trên màn**, khiến một nút primary vô tác dụng nổi bật hơn nhiều. Nối dây nó cần một quyết định sản phẩm trước: "save report" là gì khi `MatchResult` **đã** được lưu tự động? | Ngay khi chốt được nghĩa của nó — hoặc bỏ nút, hoặc đổi thành export/tải báo cáo. Đã ghi ở `README.md` §Not built yet 2026-09-07 |

## Câu hỏi còn treo

| Câu hỏi | Chốt ở đâu |
| --- | --- |
| Cấu trúc `parsedContent` chuẩn hoá ra sao (section CV / JD)? | design của feature dùng tới nó |
| Stopword tiếng Việt lấy từ danh sách công khai nào, hay tự soạn theo ngữ cảnh CV/JD? | design của feature |
| `DataDisclosure` có thêm `credentialId` không (audit *"gửi bằng khoá cá nhân nào"*)? | design của FR-17 |
| Deploy target — Docker Compose local? cloud nào? | chưa có mốc. [ADR-0009](../decisions/0009-byo-token-luu-server-ma-hoa.md) chặn deploy public cho tới khi FR-18 xong |
