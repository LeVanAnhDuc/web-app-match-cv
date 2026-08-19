---
name: hooks
paths:
  - "src/hooks/**/*"
---

# Hooks Convention (src/hooks/)

- **React Query hook theo domain**: gom các hook cùng domain vào 1 file `use<Domain>.ts`, mirror file tương ứng ở `src/requests/`:
  - `hooks/useDocuments.ts` ↔ `requests/documents.ts` → `useDocument`, `useSavedDocuments`, `useCreateDocument`
  - `hooks/useMatch.ts` ↔ `requests/match.ts` → `useRunMatch`, `useMatchResult`
- **Hook tiện ích standalone** (không gắn API): 1 hook / 1 file, đặt tên theo hook — `useDebounce.ts`, `useMediaQuery.ts`.
- `index.ts` là **barrel** re-export.

## React Query hooks sống ở đây, gọi pure fn từ `src/requests/`

Ranh giới quan trọng của layout layer-first:

- **`src/requests/`** = pure API function + query-key factory (không React) — xem `requests.md`.
- **`src/hooks/`** = React Query wrapper (`useQuery`/`useMutation`) gọi các pure fn đó, xử lý `enabled`, `invalidateQueries`, `onSuccess`.

```ts
// src/hooks/useDocuments.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocument,
  documentQueryKey,
  fetchDocument,
  fetchSavedDocuments,
  savedDocumentsQueryKey
} from "#/requests/documents";
import type { DocumentKind } from "#/types/Documents";

/** GET /documents/:id — rawText cho bước Review của wizard. */
export function useDocument(id: string | null) {
  return useQuery({
    queryKey: documentQueryKey(id ?? ""),
    queryFn: () => fetchDocument(id as string),
    enabled: id !== null
  });
}

export function useSavedDocuments(kind: DocumentKind) {
  return useQuery({
    queryKey: savedDocumentsQueryKey(kind),
    queryFn: () => fetchSavedDocuments(kind)
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDocument,
    onSuccess: (data) => {
      if (data.isSaved) {
        void queryClient.invalidateQueries({
          queryKey: savedDocumentsQueryKey(data.kind)
        });
      }
    }
  });
}
```

```ts
// src/hooks/index.ts (barrel)
export {
  useDocument,
  useSavedDocuments,
  useCreateDocument
} from "./useDocuments";
export { useRunMatch, useMatchResult } from "./useMatch";
```

## Import ở consumer — dùng module domain để test spy được

Component gọi hook import từ **module domain cụ thể** (`#/hooks/useDocuments`, `#/hooks/useMatch`) — KHÔNG chỉ qua barrel — để test có thể `vi.spyOn(import * as ..., 'useMatchResult')` chặn đúng binding:

```tsx
import { useMatchResult } from "#/hooks/useMatch";
```

Barrel `#/hooks` dùng cho hook không bị spy (VD hook tiện ích) hoặc import gọn nhiều hook.

## Quy tắc

1. React Query hook BẮT BUỘC ở `src/hooks/` — KHÔNG khai báo `useQuery`/`useMutation` inline trong view/component.
2. `queryFn`/`mutationFn` gọi pure fn từ `#/requests/*` — KHÔNG gọi `apiFetch` trực tiếp trong hook (giữ hook mỏng, request testable độc lập).
3. Query key import từ factory trong `src/requests/` — KHÔNG khai báo tuple key inline trong hook.
4. Hook non-query (`useDebounce`, `useMediaQuery`…) 1 hook / 1 file, cùng barrel.
5. Type dùng chung → `src/types/<Domain>/` (xem `types.md`); props/params type inline nếu chỉ hook đó dùng.
