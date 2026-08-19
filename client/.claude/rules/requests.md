---
name: requests
paths:
  - "src/requests/**/*"
---

# Requests Convention (src/requests/)

Layer **API thuần** — không React, không React Query hook. Mỗi file = 1 domain, chứa:

1. **Pure request function** — gọi `apiFetch<T>` từ `#/libs/api`, dùng endpoint từ `#/constants`.
2. **Query-key factory** — hàm build tuple query key cho domain đó.

React Query hook (`useQuery`/`useMutation`) KHÔNG ở đây — chúng sống ở `src/hooks/` và import các fn/key từ đây (xem `hooks.md`).

## Cấu trúc

```
src/requests/
  documents.ts     # fetchDocument, fetchSavedDocuments, createDocument + query-key factory
  match.ts         # runMatch, fetchMatchResult + query-key factory
```

## Ví dụ — `src/requests/documents.ts`

```ts
import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type {
  CreateDocumentInput,
  DocumentDto,
  DocumentKind,
  DocumentSummaryDto
} from "#/types/Documents";

// Query-key factory — nguồn chân lý key cho domain documents
export function savedDocumentsQueryKey(kind: DocumentKind) {
  return ["documents", kind, "saved"] as const;
}

export function documentQueryKey(id: string) {
  return ["documents", id] as const;
}

/** GET /documents/:id */
export function fetchDocument(id: string): Promise<DocumentDto> {
  return apiFetch<DocumentDto>(ENDPOINTS.documentById(id));
}

/** GET /documents?kind=..&saved=true */
export function fetchSavedDocuments(
  kind: DocumentKind
): Promise<Array<DocumentSummaryDto>> {
  return apiFetch<Array<DocumentSummaryDto>>(ENDPOINTS.savedDocuments(kind));
}

/** POST /documents — file (multipart) hoặc paste (JSON). */
export function createDocument(
  input: CreateDocumentInput
): Promise<DocumentDto> {
  if (input.mode === "file") {
    const formData = new FormData();
    formData.append("file", input.file);
    formData.append("kind", input.kind);
    formData.append("save", String(input.save));
    if (input.title) formData.append("title", input.title);
    return apiFetch<DocumentDto>(ENDPOINTS.documents, {
      method: "POST",
      body: formData
    });
  }

  return apiFetch<DocumentDto>(ENDPOINTS.documents, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      sourceText: input.sourceText,
      save: input.save,
      title: input.title
    })
  });
}
```

## Ví dụ — `src/requests/match.ts`

```ts
import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type { CreateMatchInput, MatchResultDto } from "#/types/Matching";

export function matchResultQueryKey(id: string) {
  return ["match", id] as const;
}

/** POST /match — chạy engine hybrid (semantic + keyword). */
export function runMatch(input: CreateMatchInput): Promise<MatchResultDto> {
  return apiFetch<MatchResultDto>(ENDPOINTS.match, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** GET /match/:id */
export function fetchMatchResult(id: string): Promise<MatchResultDto> {
  return apiFetch<MatchResultDto>(ENDPOINTS.matchById(id));
}
```

## Quy tắc

1. Mọi HTTP call đi qua `apiFetch<T>` từ `#/libs/api` — KHÔNG gọi `fetch` trực tiếp, KHÔNG axios. API trả DTO trực tiếp (no envelope); type `<T>` = DTO ở `#/types/<Domain>`.
2. Endpoint path lấy từ `ENDPOINTS.*` (`#/constants`) — KHÔNG hard-code string (xem `constants.md`).
3. Request function **pure** (không React hook, không đọc store) — testable độc lập.
4. Query-key factory sống ở đây, export cho `src/hooks/` import. KHÔNG khai báo tuple key rải rác ở nơi khác.
5. Type payload/response dùng chung → `#/types/<Domain>` (xem `types.md`) — KHÔNG `export type` trong file request.
6. KHÔNG `useQuery`/`useMutation` trong `requests/` — đó là việc của `src/hooks/`.
