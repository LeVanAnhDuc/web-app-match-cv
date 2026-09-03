# ADR-0001 · Tách sản phẩm thành nhiều git repo độc lập

> **Ngày:** 2026-07-14
> **Trạng thái:** superseded by ADR-0018
> **Liên quan:** —

## 1. Bối cảnh

Dự án khởi động cùng lúc với hai sản phẩm khác trong cùng workspace (Ducker ID,
Shorten Link). Cả ba muốn dùng chung một cách làm việc, và cách làm việc đó được nhân
bản bằng cách nhân bản cấu trúc thư mục.

## 2. Quyết định

`docs/`, `.claude/`, `server/`, `client/` mỗi thư mục là **một git repo riêng**, PR
riêng, commit riêng.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Một repo duy nhất | Không ghi lại lý do ở thời điểm quyết định |

## 4. Hệ quả

**Được:**
- Nhân bản methodology sang sản phẩm khác trong hệ sinh thái bằng cách sao chép repo.

**Mất / phải chấp nhận:**
- Một feature cross-stack thành 2–4 PR phải merge theo thứ tự.
- Không có một `git log` nào kể được toàn bộ câu chuyện của một feature.

**Điều kiện xem lại quyết định này:** khi chi phí đồng bộ nhiều PR vượt lợi ích của
việc tách. Đã xảy ra — xem [ADR-0018](0018-mot-git-repo-cho-ca-san-pham.md).
