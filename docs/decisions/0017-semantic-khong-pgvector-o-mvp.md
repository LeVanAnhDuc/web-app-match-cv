# ADR-0017 · Semantic tính cosine trong app, không bật pgvector ở MVP

> **Ngày:** 2026-07-14 (ghi lại thành ADR riêng 2026-09-03; trước đó là mục "#5b" trong bảng tóm tắt)
> **Trạng thái:** accepted
> **Liên quan:** FR-04 · FR-19 · ADR-0002

## 1. Bối cảnh

[ADR-0002](0002-be-nestjs-postgres-prisma.md) chọn PostgreSQL một phần vì có
`pgvector`. Nhưng ở MVP, một lần chấm chỉ so **một CV với một JD** — nghĩa là đúng hai
vector.

## 2. Quyết định

Không bật `pgvector` ở MVP. Hai vector embedding lấy về rồi tính cosine **ngay trong
app**. `pgvector` chỉ cần khi phải xếp hạng nhiều CV cho một JD (FR-19).

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Bật `pgvector` ngay từ đầu | Thêm extension, thêm cột, thêm index để phục vụ một phép tính trên đúng hai vector |
| Vector DB riêng | Cùng lý do, cộng thêm một hạ tầng phải chạy |

## 4. Hệ quả

**Được:**

- Không có extension nào phải cài trên PostgreSQL local; setup dev ngắn hơn.
- Embedding không cần lưu, nên không có bản sao vector của PII nằm lại trong DB.

**Mất / phải chấp nhận:**

- Không tái dùng được embedding giữa các lần chấm: cùng một CV chấm với hai JD là hai
  lần embed, tức hai lần tốn tiền.
- FR-19 sẽ phải thêm cột vector + index + migration cho dữ liệu đã có.

**Điều kiện xem lại quyết định này:** khi bắt đầu FR-19 (batch ranking).
