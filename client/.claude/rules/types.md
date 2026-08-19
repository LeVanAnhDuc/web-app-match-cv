---
name: types
paths:
  - "src/types/**/*"
---

# Types Convention (src/types/)

## 1. TẤT CẢ type/interface dùng chung sống ở `src/types/`, group theo `<Domain>`

Mọi type/interface **dùng chung** (API DTO, entity, shared union, input payload…) phải đặt trong `src/types/<Domain>/index.ts`. KHÔNG khai báo `export type`/`export interface` dùng chung rải rác trong `requests/`, `hooks/`, `stores/`, `dataSources/`, `constants/`, `mocks/`, `utils/`, hay file component — đưa hết về `src/types/<Domain>/` rồi import ngược lại.

```
src/types/
  Documents/index.ts     # DocumentDto, DocumentSummaryDto, DocumentKind, SourceFormat, CreateDocumentInput...
  Matching/index.ts      # MatchResultDto, MatchReport, CreateMatchInput...
```

Ví dụ `src/types/Documents/index.ts` (mirror API contract — giữ đồng bộ với server DTO):

```ts
export type DocumentKind = "CV" | "JD";
export type SourceFormat = "pdf" | "docx" | "text";

export interface DocumentDto {
  id: string;
  kind: DocumentKind;
  title: string;
  sourceFormat: SourceFormat;
  rawText: string;
  isSaved: boolean;
  createdAt: string;
}

export interface CreateDocumentFileInput {
  mode: "file";
  kind: DocumentKind;
  save: boolean;
  title?: string;
  file: File;
}
// ... CreateDocumentPasteInput, CreateDocumentInput (discriminated union)
```

Consumer import: `import type { DocumentDto } from '#/types/Documents'`.

### Quy tắc

1. Group theo domain: `types/<Domain>/index.ts` (`Documents`, `Matching`, …) — 1 domain 1 folder.
2. Đặt tên domain PascalCase.
3. Type dùng chung ≥ 2 layer (VD `DocumentDto` dùng ở requests + hooks + view) BẮT BUỘC ở đây.
4. `import type { ... }` khi import type-only (`verbatimModuleSyntax` bật — xem `imports.md`).

## 2. Type props của component — viết **INLINE**

**MANDATORY**: type props viết **inline ngay tại tham số destructuring**. KHÔNG:

- ❌ Tạo `type Props = {...}` / `interface Props {...}` rồi gắn vào tham số
- ❌ Đưa props type ra `src/types/`

```tsx
// ✅ Đúng — props inline
const Stepper = ({
  current,
  orientation = "horizontal"
}: {
  current: number;
  orientation?: "horizontal" | "vertical";
}) => {
  // ...
};

export default Stepper;
```

```tsx
// ❌ Sai — tách Props ra ngoài
type Props = { current: number };
const Stepper = ({ current }: Props) => {
  /* ... */
};
```

Ngược lại, mọi type **dùng chung** (không phải props riêng của 1 component) → `src/types/<Domain>/` như mục 1.
