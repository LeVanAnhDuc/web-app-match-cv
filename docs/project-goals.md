# ⚠️ File này đã được tách ra — 2026-09-03

`project-goals.md` **không còn là nguồn đúng**. Nội dung của nó đã chuyển vào bộ tài
liệu hai tầng; stub này chỉ còn tồn tại để ~20 liên kết trong `docs/specs/` không gãy.
**Đừng đọc từ đây, đừng ghi vào đây.**

| Mục cũ | Giờ ở đâu |
| --- | --- |
| §1 Identity & Vision · §3 Target Users · §5 Non-Goals · §11 Out of Scope | [`01-product/overview.md`](01-product/overview.md) |
| §2 Domain Model (tên gọi) | [`01-product/glossary.md`](01-product/glossary.md) |
| §6 Functional Scope · §10 Roadmap | [`02-requirements/scope.md`](02-requirements/scope.md) (ID `FR-xx`) |
| §4 Goals — dưới dạng luồng người dùng | [`01-product/journeys.md`](01-product/journeys.md) (ID `US-xx`) |
| §7 Non-Functional Requirements | [`02-requirements/nfr.md`](02-requirements/nfr.md) (ID `NFR-xxx-xx`) |
| §9 Tech Stack | [`03-design/architecture.md`](03-design/architecture.md) §5 |
| §8 Key Architectural Decisions | [`decisions/`](decisions/README.md) — mỗi dòng thành một ADR |
| §12 Open Questions | [`04-state/backlog.md`](04-state/backlog.md) §Câu hỏi còn treo |
| §13 Changelog | lịch sử git |

Bảng ánh xạ số ADR cũ → mới: `#1`…`#16` giữ nguyên số (ADR-0001…ADR-0016); `#5b` →
[ADR-0017](decisions/0017-semantic-khong-pgvector-o-mvp.md). ADR-0001 đã bị
[ADR-0018](decisions/0018-mot-git-repo-cho-ca-san-pham.md) thay thế.

Tài liệu trong `docs/specs/` có ghi ngày là **hồ sơ lịch sử** — chúng vẫn trỏ tới
`project-goals.md` §x và giữ nguyên như đã viết.
