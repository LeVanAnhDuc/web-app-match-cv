# Quyết định kiến trúc (ADR)

> **Trả lời:** Sáu tháng sau — tại sao lại làm thế này?
> **Cập nhật khi:** chốt một quyết định kỹ thuật. Ghi **ngay trong phiên đó**.

## Mục lục

<!-- BEGIN:auto — bảng dưới do .claude/scripts/docs-regen.sh sinh từ các file ADR. Đừng sửa tay. -->
| ID | Tiêu đề | Ngày | Trạng thái |
| --- | --- | --- | --- |
| [ADR-0001](0001-monorepo-nhieu-git-repo-doc-lap.md) | Tách sản phẩm thành nhiều git repo độc lập | 2026-07-14 | superseded by ADR-0018 |
| [ADR-0002](0002-be-nestjs-postgres-prisma.md) | Backend dùng NestJS + PostgreSQL + Prisma | 2026-07-14 | accepted |
| [ADR-0003](0003-fe-tanstack-start-antd-tailwind.md) | Frontend dùng TanStack Start + Ant Design + Tailwind | 2026-07-14 | accepted |
| [ADR-0004](0004-matching-hybrid-llm-khong-cham-diem.md) | Matching hybrid, và LLM không tham gia chấm điểm | 2026-07-14 (làm rõ 2026-08-08) | accepted |
| [ADR-0005](0005-ai-qua-openrouter-sdk-openai.md) | Gọi AI qua OpenRouter bằng SDK `openai` | 2026-07-24 (thay quyết định Gemini ngày 2026-07-14) | accepted |
| [ADR-0006](0006-defer-auth-mock-user.md) | Hoãn auth, chạy bằng mock user, schema SSO-ready | 2026-07-14 | accepted |
| [ADR-0007](0007-match-cv-so-huu-bang-user.md) | Match CV sở hữu bảng `User` riêng; IdP chỉ cấp claim | 2026-08-06 | accepted |
| [ADR-0008](0008-mock-user-la-user-that.md) | Mock user là một `User` thật trong DB, có cờ `isMock` | 2026-08-06 | accepted |
| [ADR-0009](0009-byo-token-luu-server-ma-hoa.md) | Token AI của user lưu server-side, mã hoá AES-256-GCM | 2026-08-06 | accepted |
| [ADR-0010](0010-provider-whitelist-chat-va-embed.md) | Chỉ nhận provider có **cả** chat lẫn embeddings | 2026-08-06 (xác nhận 2026-08-08) | accepted |
| [ADR-0011](0011-multi-provider-n-request-doc-lap.md) | Multi-provider = N request độc lập + hiện dần | 2026-08-06 | accepted |
| [ADR-0012](0012-bo-job-board.md) | Bỏ job-board: không đăng job, không luồng ứng tuyển | 2026-08-08 | accepted |
| [ADR-0013](0013-noi-dung-ai-sinh-grounded-user-duyet.md) | Nội dung do AI sinh phải neo vào CV gốc và do user duyệt | 2026-08-08 | accepted |
| [ADR-0014](0014-keyword-tieng-viet-cap-am-tiet.md) | Keyword tiếng Việt chạy ở cấp âm tiết, không tách từ ghép | 2026-08-08 | accepted |
| [ADR-0015](0015-lineage-bang-parentid.md) | Lineage giữa các phiên bản CV bằng `parentId` self-FK | 2026-08-08 | accepted |
| [ADR-0016](0016-nhat-ky-tiet-lo-la-bang-rieng.md) | Nhật ký tiết lộ dữ liệu là bảng riêng, ghi trước call AI, fail-closed | 2026-08-08 | accepted |
| [ADR-0017](0017-semantic-khong-pgvector-o-mvp.md) | Semantic tính cosine trong app, không bật pgvector ở MVP | 2026-07-14 (ghi lại thành ADR riêng 2026-09-03; trước đó là mục "#5b" trong bảng tóm tắt) | accepted |
| [ADR-0018](0018-mot-git-repo-cho-ca-san-pham.md) | Cả sản phẩm là một git repo; `.claude/` là ngoại lệ duy nhất | 2026-09-03 | accepted |
| [ADR-0019](0019-preview-tai-lieu-chay-client-side.md) | Xem trước tài liệu render client-side, không qua dịch vụ ngoài | 2026-08-08 (ghi lại thành ADR 2026-09-03; trước đó chỉ nằm trong `.claude/techstack/frontend.md`) | accepted |
| [ADR-0020](0020-pin-prisma-6.md) | Pin Prisma ở 6.x, chưa lên 7 | 2026-08-08 (ghi lại thành ADR 2026-09-03; trước đó chỉ nằm trong `.claude/techstack/backend.md`) | accepted |
<!-- END:auto -->

Trạng thái: `accepted` · `superseded by ADR-00xx` · `deprecated`

## Cách thêm một ADR

1. Lấy số kế tiếp, tạo `NNNN-<slug-tieng-anh>.md` từ [`_template.md`](_template.md).
   Ví dụ: `0003-dung-prisma-thay-typeorm.md`.
2. Điền. Giữ trong khoảng 15–40 dòng.
3. Thêm một dòng vào bảng trên.

## Ba quy tắc

- **Một quyết định, một file.** File thứ hai bàn cùng chuyện nghĩa là quyết định đầu chưa dứt.
- **Append-only.** ADR đã `accepted` thì **không sửa nội dung**. Đổi ý thì viết ADR mới, ghi `supersedes ADR-0007`, và đổi ADR cũ sang `superseded by`.
- **Ghi ngay khi chốt**, không để cuối phiên. Ngữ cảnh của một phiên dài có thể bị nén trước khi phiên kết thúc, và lúc đó lý do đã mất.

## Khi nào cần ADR

Cần: chọn thư viện/framework/datastore · đổi ranh giới module · chọn cách xử lý một vấn đề mà có ≥ 2 phương án hợp lý · chấp nhận một hạn chế lâu dài.

Không cần: sửa bug · thêm chức năng theo đúng khuôn có sẵn · quyết định có thể đảo trong 10 phút.
