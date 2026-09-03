# ADR-0003 · Frontend dùng TanStack Start + Ant Design + Tailwind

> **Ngày:** 2026-07-14
> **Trạng thái:** accepted
> **Liên quan:** FR-03 · FR-06 · FR-07

## 1. Bối cảnh

Sản phẩm là web app nhiều màn hình có form nặng (nạp tài liệu, wizard 4 bước, thư
viện, bảng so sánh). Cần SSR và cần một thư viện component đủ dùng để không phải tự
dựng bảng, modal, upload.

## 2. Quyết định

Frontend là **TanStack Start** (React 19 trên Vite, có server function), giao diện
dựng bằng **Ant Design** cộng **Tailwind** cho phần bố cục.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Next.js | Không ghi lại lý do ở thời điểm quyết định |
| shadcn/ui | Không ghi lại lý do; hệ quả là **skill `ui-styling` của `ui-ux-pro-max` không áp dụng** cho project này |

## 4. Hệ quả

**Được:**
- Full-stack React với server function, không cần tách BFF.
- Component sẵn cho upload / table / modal — đúng phần chiếm nhiều màn hình nhất.

**Mất / phải chấp nhận:**
- Ant Design + Tailwind là hai hệ token, phải giữ một nguồn duy nhất cho màu và
  khoảng cách (xem `docs/design-system/match-cv/MASTER.md`).
- Mọi hướng dẫn UI mặc định của hệ sinh thái Claude giả định Tailwind + shadcn/Radix,
  phải bỏ qua có ý thức.

**Điều kiện xem lại quyết định này:** nếu TanStack Start đổi mô hình render, hoặc nếu
Ant Design cản trở design system nhiều hơn là giúp.
