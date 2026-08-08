# Tính năng chưa hoàn thiện (UI có, API chưa có — hoặc ngược lại)

> Cập nhật 2026-08-08 sau đợt đồng bộ doc ↔ code.
> Nơi ghi những mảnh **dở dang giữa 2 tầng**: một bên đã có, bên kia chưa. Khác `project-goals.md` §10 Roadmap — roadmap là feature **chưa bắt đầu**, file này là feature **đã bắt đầu nhưng chưa đóng**.

## Bảng tổng quan

| # | Mảnh dở | BE | FE | Thiếu gì | Thuộc |
|---|---|---|---|---|---|
| 1 | **Trang Match history** | ✅ `GET /match` (list newest-first), `GET /match/:id` | 🟡 chỉ có widget `RecentMatches` trên Home | Route `/history` riêng + link ở `views/AppShell/components/Sidebar` (`NAV_ITEMS`); filter theo CV/JD; sort theo điểm/ngày; `DELETE /match/:id` (BE **chưa có**) | `project-goals.md` §6.1 |
| 2 | **`Document.parsedContent` (jsonb)** | 🟡 cột có trong schema, **luôn ghi `null`** | ⬜ không đọc tới | Chuẩn hoá schema section CV (skills/experience/education) & JD (requirements/nice-to-have) + parser điền vào. **KHÔNG** kèm UI sửa tay — step Review đã chốt read-only (§6). Đang chặn: skill-level overlap của Goal 2; breakdown per-section; diff theo section của Goal 7 | `project-goals.md` §12 Open Questions |
| 3 | **`User.isMock` + profile mirror** | ⬜ cột **chưa có** trong `schema.prisma` (`erd.md` đánh 📝) | — | Thêm `isMock`, `email`, `fullName`, `avatar`, `phone`, `updatedAt` + migration. Đang chặn: clean data `DELETE FROM users WHERE is_mock = true` (ADR #8) | `project-goals.md` §3, ADR #7/#8 |
| 4 | **So sánh 2 lần match của cùng CV** | ⬜ chưa có | ⬜ chưa có | Sau khi sửa CV theo gợi ý, xem delta điểm + gap nào đã đóng. Là **vòng lặp giá trị** của Goal 7 (§6.3) — nếu không có, CV rewrite không đo được hiệu quả | tiền đề cho Roadmap #4 |
| 5 | **Skill-level overlap** *(cải tiến tuỳ chọn)* | 🟡 `keywordScore` chạy ở cấp token | ⬜ breakdown chỉ hiện 1 số % | Trích skill từ CV + requirement từ JD (cần #2) → normalize alias (`React`/`ReactJS`/`React.js`) → so ở cấp skill → breakdown liệt kê **khớp cái gì / thiếu cái gì**. **Không chặn Goal nào** — Goal 2 đã chốt ✅ ở cấp token (2026-08-08); phần "thiếu skill nào" hiện do LLM trả lời | cải tiến của `project-goals.md` Goal 2 |

## Ghi chú

- **#1 nên làm trước** — BE đã sẵn, chỉ thiếu FE + 1 endpoint `DELETE`; rẻ nhất trong bảng.
- **#2 và #4 là tiền đề của Goal 7** (Roadmap #4 CV rewrite). Làm Goal 7 mà bỏ qua #4 thì user không có cách nào biết bản CV mới có tốt hơn không.
- **#3 chỉ thực sự cần khi** (a) cần clean data theo cờ, hoặc (b) tới Roadmap #6 Auth/SSO. Trước đó không chặn gì.
- **#5 là nice-to-have, không phải nợ** — quyết định 2026-08-08: LLM đã gánh phần "giải thích thiếu gì", nên skill-level overlap chỉ nâng tính minh bạch của con số keyword. Cần #2 xong trước. Ưu tiên thấp nhất bảng.
- **Step Review là read-only** (§6 chốt 2026-08-08) — mọi mục ở đây **KHÔNG** kèm UI sửa tay nội dung CV/JD. Parse sai thì nạp lại tài liệu.
- Mục nào đóng xong → **xoá khỏi bảng** và cập nhật `project-goals.md` §6 tương ứng, cùng PR.
