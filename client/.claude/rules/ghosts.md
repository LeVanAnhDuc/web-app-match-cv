---
name: ghosts
paths:
  - "src/ghosts/**/*"
  - "src/views/**/ghosts/**/*"
---

# Ghost Components

Headless component — chỉ chứa **side effect** (sync store, subscription, event listener), **không render UI**, luôn `return null`.

## Phân loại

| Loại         | Path                                       | Dùng khi              |
| ------------ | ------------------------------------------ | --------------------- |
| Shared ghost | `src/ghosts/<Name>/index.tsx`              | Dùng ở ≥ 2 view       |
| View ghost   | `src/views/<View>/ghosts/<Name>/index.tsx` | Chỉ dùng trong 1 view |

## Ví dụ

```tsx
// src/views/Wizard/ghosts/ResetWizardOnUnmount/index.tsx
import { useEffect } from "react";
import { useWizardStore } from "#/stores";

const ResetWizardOnUnmount = () => {
  const reset = useWizardStore((s) => s.reset);
  useEffect(() => reset, [reset]);
  return null;
};

export default ResetWizardOnUnmount;
```

## Quy tắc

1. Luôn `return null` — không render UI.
2. Ghost chỉ dùng 1 view → `views/<View>/ghosts/`; dùng ≥ 2 view → `src/ghosts/`.
3. Ưu tiên đặt các `useEffect` side-effect (sync, subscription, listener) vào ghost thay vì rải trong `mains/`/`components/`, giúp component UI thuần khai báo.
4. Type props viết inline (xem `types.md`); mỗi ghost = 1 folder + `index.tsx` (xem `component-folder.md`).
