---
name: constants
paths:
  - "src/constants/**/*"
---

# Constants Convention (src/constants/)

- Chứa **tất cả** hằng số cứng: API endpoint (path/builder), file constraint (max size, label, accepted pattern), storage key, regex, format string…
- Mỗi nhóm tách 1 file theo domain (`endpoints.ts`, `fileConstraints.ts`, …).
- File `index.ts` gom tất cả thành **1 object `CONSTANTS` duy nhất** rồi `export default CONSTANTS`; đồng thời có thể named-export từng nhóm để import trực tiếp. Consumer truy cập `CONSTANTS.<DOMAIN>.<KEY>` (hoặc `import { ENDPOINTS } from '#/constants'`).

## Cấu trúc

```
src/constants/
  index.ts            # gom tất cả → export default CONSTANTS (+ named export nhóm)
  endpoints.ts        # ENDPOINTS: path tĩnh + builder cho dynamic path
  fileConstraints.ts  # FILE: MAX_SIZE_BYTES, MAX_SIZE_LABEL, ALLOWED_PATTERN
```

## Ví dụ

```ts
// src/constants/endpoints.ts
import type { DocumentKind } from "#/types/Documents";

export const ENDPOINTS = {
  documents: "/documents",
  documentById: (id: string) => `/documents/${id}`,
  savedDocuments: (kind: DocumentKind) => `/documents?kind=${kind}&saved=true`,
  match: "/match",
  matchById: (id: string) => `/match/${id}`
} as const;

// src/constants/fileConstraints.ts
export const FILE = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_SIZE_LABEL: "10MB",
  ALLOWED_PATTERN: /\.(pdf|docx)$/i
} as const;
```

```ts
// src/constants/index.ts
import { ENDPOINTS } from "./endpoints";
import { FILE } from "./fileConstraints";

const CONSTANTS = {
  ENDPOINTS,
  FILE
} as const;

export default CONSTANTS;
export { ENDPOINTS, FILE };
```

## No Hard-coded literals — luôn qua CONSTANTS

Mọi endpoint path, file constraint **phải** đi qua `CONSTANTS.<DOMAIN>.<KEY>` (hoặc named import) từ `#/constants`. KHÔNG hard-code literal song song với constant đã có.

| Pattern                          | Rule                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| API endpoint (trong `requests/`) | `ENDPOINTS.<KEY>` — không hard-code `'/documents'`, `'/match'`                               |
| Endpoint có path param           | Dùng builder `ENDPOINTS.documentById(id)` — không nối chuỗi `` `/documents/${id}` `` rải rác |
| File constraint (size, pattern)  | `FILE.<KEY>` — không hard-code `10485760` hay regex `/\.(pdf\|docx)$/i` rải rác              |

Thiếu key → thêm vào file domain trong `src/constants/` **trước**, rồi dùng. KHÔNG bypass bằng literal.

> **Query key React Query**: factory (`documentQueryKey`, `matchResultQueryKey`…) sống ở `src/requests/` (xem `requests.md`), KHÔNG ở đây. `constants/` chỉ giữ hằng nguyên thủy; query-key là hàm build tuple gắn với domain request.
