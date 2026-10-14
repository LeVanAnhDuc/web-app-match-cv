# Nguồn requirement của Match CV

**Requirement của module lấy ở đâu.** `/write-tests` đọc file này ở bước 1 và chỉ đọc các nơi liệt kê dưới đây, cộng với
những gì user nói trong chat. Không dùng Jira/Confluence.

Đường dẫn tính từ thư mục gốc repo test. Danh sách này được user xác nhận lúc scaffold; khi user chỉ thêm nơi khác, hoặc
một nơi bị bỏ/đóng băng, sửa bảng này trong cùng lượt.

## Tài liệu

- `../docs/README.md` — bản đồ docs + quy ước ID (US / FR / NFR / ADR); đọc đầu tiên
- `../docs/01-product/` — overview, journeys (`US-*`), glossary
- `../docs/02-requirements/` — scope (`FR-*`), nfr (`NFR-*`)
- `../docs/03-design/` — architecture, invariants
- `../docs/decisions/` — ADR 0001–0023
- `../docs/specs/<feature>/` — design / plan của từng feature
- `../docs/design-system/match-cv/ux-copy.md` — câu chữ UI EN / VI
- `../docs/erd.md` — data model
- `../docs/04-state/backlog.md` — đang làm, tiếp theo, đang nợ
- `../README.md` — mục Features

## Code

- `../client/src` — FE, kèm `../client/src/locales`, `../client/src/i18n`
- `../server/src` — BE, kèm `../server/src/i18n`
- `../server/prisma/schema.prisma` — schema DB
- Swagger `/api/v1/docs` trên API dev — hợp đồng endpoint

## Không đọc như nguồn đúng

- `../docs/ui-designs/`, `../docs/project-goals.md`, `../docs/unfinished-features.md` — đóng băng 2026-09-03 theo `../docs/README.md`

## Thứ tự thẩm quyền

User (chat) > tài liệu trên > code. Code cho biết app *đang* làm gì, không cho biết *nên* làm gì.
