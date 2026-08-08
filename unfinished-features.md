# Tính năng chưa hoàn thiện (UI có, API chưa có — hoặc ngược lại)

> Cập nhật 2026-08-08 sau đợt đồng bộ doc ↔ code, rà lại sau brainstorm Goal 8/9/10.
> Nơi ghi những mảnh **dở dang giữa 2 tầng**: một bên đã có, bên kia chưa. Khác `project-goals.md` §10 Roadmap — roadmap là feature **chưa bắt đầu**, file này là feature **đã bắt đầu nhưng chưa đóng**.

## Bảng tổng quan

| # | Mảnh dở | BE | FE | Thiếu gì | Thuộc |
|---|---|---|---|---|---|
| 1 | **Trang Match history** | ✅ `GET /match` (list newest-first), `GET /match/:id` | 🟡 chỉ có widget `RecentMatches` trên Home | Route `/history` riêng + link ở `views/AppShell/components/Sidebar` (`NAV_ITEMS`); filter theo CV/JD; sort theo điểm/ngày; `DELETE /match/:id` (BE **chưa có**) | `project-goals.md` §6.1 |
| 2 | **`Document.parsedContent` (jsonb)** | 🟡 cột có trong schema, **luôn ghi `null`** | ⬜ không đọc tới | Chuẩn hoá schema section CV (skills/experience/education) & JD (requirements/nice-to-have) + parser điền vào. **KHÔNG** kèm UI sửa tay — step Review đã chốt read-only (§6). Đang chặn: skill-level overlap của Goal 2; breakdown per-section; diff theo section của Goal 7 | `project-goals.md` §12 Open Questions |
| 3 | **`User.isMock` + profile mirror** | ⬜ cột **chưa có** trong `schema.prisma` (`erd.md` đánh 📝) | — | Thêm `isMock`, `email`, `fullName`, `avatar`, `phone`, `updatedAt` + migration. Đang chặn: clean data `DELETE FROM users WHERE is_mock = true` (ADR #8) | `project-goals.md` §3, ADR #7/#8 |
| 4 | **Skill-level overlap** *(cải tiến tuỳ chọn)* | 🟡 `keywordScore` chạy ở cấp token | ⬜ breakdown chỉ hiện 1 số % | Trích skill từ CV + requirement từ JD (cần #2) → so ở cấp skill → breakdown liệt kê **khớp cái gì / thiếu cái gì**. Phần **normalize alias** (`React`/`ReactJS`) đã chuyển sang **Goal 8** (Roadmap #3) nên sẽ có sẵn; phần trích skill vẫn treo ở đây. **Không chặn Goal nào** — Goal 2 chốt ✅ ở cấp token | cải tiến của `project-goals.md` Goal 2 |

## Ghi chú

- **#1 nên làm trước** — BE đã sẵn, chỉ thiếu FE + 1 endpoint `DELETE`; rẻ nhất trong bảng.
- **#2 là tiền đề của Goal 7** (Roadmap #6 CV rewrite) — diff theo section cần `parsedContent` chuẩn hoá.
- **#3 chỉ thực sự cần khi** (a) cần clean data theo cờ, hoặc (b) tới Roadmap #10 Auth/SSO. Trước đó không chặn gì.
- **#4 là nice-to-have, không phải nợ** — LLM đã gánh phần "giải thích thiếu gì", nên skill-level overlap chỉ nâng tính minh bạch của con số keyword. Cần #2 xong trước. Ưu tiên thấp nhất bảng.
- **Mục "So sánh 2 lần match" đã rời bảng này (2026-08-08)** — thăng cấp thành **Goal 9** (`project-goals.md` §6.6, Roadmap #7). Nó không còn là mảnh dở dang giữa 2 tầng mà là một năng lực sản phẩm có `parentId` lineage riêng.
- **Step Review là read-only** (§6 chốt 2026-08-08) — mọi mục ở đây **KHÔNG** kèm UI sửa tay nội dung CV/JD. Parse sai thì nạp lại tài liệu.
- Mục nào đóng xong → **xoá khỏi bảng** và cập nhật `project-goals.md` §6 tương ứng, cùng PR.
