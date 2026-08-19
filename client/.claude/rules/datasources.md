---
name: datasources
paths:
  - "src/dataSources/**/*"
---

# DataSources Convention (src/dataSources/)

Chứa **data configuration tĩnh phục vụ UI**: select options, Ant Design `Table` columns, enum→label map, tab items… KHÔNG business logic, KHÔNG gọi API. Folder này **có thể trống** cho tới khi cần.

Tách theo domain: `dataSources/<Domain>/`.

## Các loại file

### Select / Radio options

```ts
// src/dataSources/Documents/options.ts
import type { DocumentKind } from "#/types/Documents";

export const documentKindOptions: Array<{
  value: DocumentKind;
  label: string;
}> = [
  { value: "JD", label: "Job Description" },
  { value: "CV", label: "Curriculum Vitae" }
];
```

### Table columns config (Ant Design `Table`)

```tsx
// src/dataSources/Matching/columns.tsx
import type { ColumnsType } from "antd/es/table";
import type { DocumentSummaryDto } from "#/types/Documents";

export const savedDocumentColumns: ColumnsType<DocumentSummaryDto> = [
  { title: "Title", dataIndex: "title", key: "title" },
  { title: "Format", dataIndex: "sourceFormat", key: "sourceFormat" }
];
```

### Enum → label map

```ts
// src/dataSources/Documents/labels.ts
import type { SourceFormat } from "#/types/Documents";

export const sourceFormatLabel: Record<SourceFormat, string> = {
  pdf: "PDF",
  docx: "Word",
  text: "Plain text"
};
```

## Quy tắc

1. Mỗi domain 1 folder PascalCase: `dataSources/<Domain>/`.
2. File `.tsx` cho config có render JSX (table columns có `render`, tab `children`); file `.ts` cho config data thuần (options, label map).
3. Callback (action/modal) nhận qua **tham số** — KHÔNG gọi trực tiếp trong dataSources, KHÔNG đọc store/hook ở đây.
4. Type dùng chung → import từ `#/types/<Domain>` (xem `types.md`) — KHÔNG khai báo type ở dataSources.
5. Literal enum/endpoint/key → dùng `#/constants` (xem `constants.md`), không hard-code.
