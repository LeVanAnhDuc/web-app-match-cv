---
name: components
paths:
  - "src/components/**/*"
---

# Shared Components (src/components/)

Chứa component **dùng chung** giữa **≥ 2 consumers** (nhiều view, hoặc view + layout). Đây là Atom/Molecule tái sử dụng — **KHÔNG chứa business logic**, chỉ UI thuần (presentational).

## Cấu trúc

```
src/components/
  Stepper/index.tsx        # dùng ở nhiều nơi → shared
  ScoreGauge/index.tsx
```

Mỗi component = 1 folder + `index.tsx` (xem `component-folder.md`).

## Quy tắc đặt chỗ

1. Chỉ đặt vào đây component dùng ở **≥ 2 consumers**. Component chỉ dùng trong 1 view → đặt trong `src/views/<View>/components/` (molecule) hoặc `mains/` (organism) — xem `views.md`.
2. Không business logic, không gọi API/React Query hook trực tiếp. Data + callback nhận qua props từ parent (view/organism).
3. Type props viết **inline** tại tham số — không tách `Props` (xem `types.md`).

## Ưu tiên primitive của Ant Design

Stack dùng **Ant Design 5**. Với control có hành vi (click, input, select, submit…) → dùng thẳng primitive antd: `Button`, `Input`, `Input.TextArea`, `Select`, `Radio`, `Upload`, `Steps`, `Progress`, `Tabs`, `Modal`, `Table`… KHÔNG dựng lại từ raw `<button>/<input>/<select>` (xem `jsx.md`).

```tsx
// ✅ dùng antd primitive trực tiếp
import { Button } from "antd";

const NextButton = ({
  onClick,
  loading
}: {
  onClick: () => void;
  loading?: boolean;
}) => (
  <Button type="primary" onClick={onClick} loading={loading}>
    Next
  </Button>
);

export default NextButton;
```

## Lớp `Custom*` — OPTIONAL, chỉ tạo khi có nhu cầu chung thật sự

Hiện **chưa có** lớp `Custom*` wrapper. **KHÔNG bắt buộc** dựng lớp này. Chỉ tạo `Custom<Name>` (wrap 1 primitive antd) khi xuất hiện **nhu cầu tái sử dụng thật** — cùng một cấu hình/behavior antd lặp lại ở ≥ 2 nơi và cần chốt 1 chỗ (VD default size, icon cố định, aria pattern dự án).

- Khi đó đặt tại `src/components/Custom<Name>/index.tsx`, wrap primitive antd, giữ API gần với antd.
- Trước khi tạo `Custom*`: kiểm tra prop/`theme` token của Ant Design đã giải quyết được chưa (thường antd đủ). Ưu tiên cấu hình qua `ConfigProvider` theme hơn là bọc wrapper cho việc chỉnh style thuần.
- KHÔNG tạo wrapper "phòng khi cần" — chỉ tạo khi nhu cầu đã tồn tại.
