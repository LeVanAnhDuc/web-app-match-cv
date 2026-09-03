# ADR-0002 · Backend dùng NestJS + PostgreSQL + Prisma

> **Ngày:** 2026-07-14
> **Trạng thái:** accepted
> **Liên quan:** FR-01 · FR-04 · ADR-0017

## 1. Bối cảnh

Dữ liệu của sản phẩm là quan hệ chặt (`User` → `Document` → `MatchResult`), và engine
matching cần lưu vector embedding cạnh dữ liệu quan hệ đó.

## 2. Quyết định

Backend là **NestJS** (TypeScript) trên **PostgreSQL**, truy cập qua **Prisma**.
PostgreSQL được chọn một phần vì có `pgvector` native khi cần vector — dù MVP chưa bật
(xem [ADR-0017](0017-semantic-khong-pgvector-o-mvp.md)).

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Datastore document (Mongo…) | Quan hệ giữa `Document` ↔ `MatchResult` ↔ `User` chặt, và cần FK toàn vẹn |
| Vector DB riêng | Không ghi lại lý do chi tiết ở thời điểm quyết định |

## 4. Hệ quả

**Được:**
- Một datastore cho cả dữ liệu quan hệ lẫn (về sau) vector.
- Prisma sinh type từ schema nên hợp đồng dữ liệu kiểm được lúc compile.

**Mất / phải chấp nhận:**
- Phải chạy PostgreSQL local, không có Docker trong repo.
- Migration là tài sản chỉ-tiến, sửa file đã chạy là hỏng (invariant #6).

**Điều kiện xem lại quyết định này:** nếu batch ranking (FR-19) đòi hạ tầng vector mà
`pgvector` không đáp ứng.
