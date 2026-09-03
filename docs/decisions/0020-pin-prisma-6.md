# ADR-0020 · Pin Prisma ở 6.x, chưa lên 7

> **Ngày:** 2026-08-08 (ghi lại thành ADR 2026-09-03; trước đó chỉ nằm trong `.claude/techstack/backend.md`)
> **Trạng thái:** accepted
> **Liên quan:** ADR-0002 · ADR-0017

## 1. Bối cảnh

[ADR-0002](0002-be-nestjs-postgres-prisma.md) chọn Prisma làm ORM. Prisma 7 phát hành
với breaking change ở tầng cấu hình: bỏ khối `generator`/`datasource` quen thuộc để
chuyển sang `prisma.config.ts`, và bắt buộc **driver adapter** thay cho engine mặc định.

Không có tính năng nào của v7 mà dự án đang cần.

## 2. Quyết định

Pin **Prisma 6.19.3**. Không nâng lên 7 cho tới khi có lý do cụ thể.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Nâng lên 7 ngay | Phải viết lại cấu hình + thêm driver adapter, đổi lấy đúng con số version. Không tính năng nào đang cần |
| Để dải version mở (`^6`) | Minor của Prisma kéo theo engine binary mới; pin cứng để `yarn install` ở hai máy ra cùng một thứ |

## 4. Hệ quả

**Được:**

- Cấu hình Prisma giữ nguyên dạng đã quen; không có tầng driver adapter phải hiểu thêm.
- `yarn install` tái lập được.

**Mất / phải chấp nhận:**

- Ở lại phía sau nhánh được hỗ trợ; càng để lâu, lần nâng cấp càng đắt.
- Khi bật `pgvector` cho FR-19 ([ADR-0017](0017-semantic-khong-pgvector-o-mvp.md)) sẽ
  phải dùng raw query hoặc `Unsupported("vector")` — v7 có thể xử lý việc này gọn hơn,
  và đó là lúc nên đọc lại quyết định này.

**Điều kiện xem lại quyết định này:** khi bắt đầu FR-19, hoặc khi 6.x hết được hỗ trợ,
hoặc khi cần một tính năng chỉ v7 có.
