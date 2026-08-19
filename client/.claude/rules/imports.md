---
name: imports
paths:
  - "src/**/*"
---

# Imports Convention

## 1. Alias `#/` cho `src/*` — KHÔNG deep relative

Alias `#/*` → `./src/*`. Mọi import cross-folder dùng `#/` — KHÔNG dùng đường dẫn tương đối sâu (`../../`).

```ts
// ✅ Đúng
import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import { useDocument } from "#/hooks/useDocuments";
import type { DocumentDto } from "#/types/Documents";

// ❌ Sai — deep relative
import { apiFetch } from "../../libs/api";
```

Relative (`./`, `../`) chỉ dùng **trong cùng một folder feature/view** (VD `mains/` import `../../components/Stepper` trong cùng view) — cross-layer luôn `#/`.

## 2. `import type` cho type-only imports (`verbatimModuleSyntax` bật)

`verbatimModuleSyntax` đang bật → import chỉ dùng làm type BẮT BUỘC `import type`:

```ts
import type { DocumentDto, DocumentKind } from "#/types/Documents";
import { useMutation, useQuery } from "@tanstack/react-query";
```

Trộn value + type trong 1 dòng → tách type ra `import type` riêng, hoặc dùng inline `import { foo, type Bar }`.

## 3. Navigation — TanStack Router

Routing dùng **TanStack Router**. Mọi API điều hướng import từ `@tanstack/react-router`:

| Nhu cầu                      | Import                                                 |
| ---------------------------- | ------------------------------------------------------ |
| Link nội bộ                  | `import { Link } from '@tanstack/react-router'`        |
| Điều hướng imperative        | `import { useNavigate } from '@tanstack/react-router'` |
| Truy cập router instance     | `import { useRouter } from '@tanstack/react-router'`   |
| Redirect (loader/beforeLoad) | `import { redirect } from '@tanstack/react-router'`    |

```tsx
// libs
import { Link, useNavigate } from "@tanstack/react-router";

const GoToWizard = () => {
  const navigate = useNavigate();
  return <Link to="/wizard">Start</Link>;
};
```

KHÔNG dùng `<a href>` cho điều hướng nội bộ (mất client routing) — `<a>` chỉ cho link external (`https://...`).

## 4. Thứ tự import (khuyến nghị)

Nhóm theo thứ tự, cách nhau 1 dòng trống:

```ts
// libs — third-party (react, antd, @tanstack/*, zustand, i18next)
import { Button } from "antd";
import { useQuery } from "@tanstack/react-query";
// types — import type ...
import type { DocumentDto } from "#/types/Documents";
// internal — #/components, #/views, #/hooks, #/requests, #/stores, #/constants, #/utils, #/libs
import { useDocument } from "#/hooks/useDocuments";
import { ENDPOINTS } from "#/constants";
// relative — cùng feature/view
import Stepper from "../../components/Stepper";
```
