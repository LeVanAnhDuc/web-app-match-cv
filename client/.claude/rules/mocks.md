---
name: mocks
paths:
  - "src/mocks/**/*"
---

# Mocks Convention (src/mocks/)

- Chứa **dummy data** giả lập response API, dùng khi dựng UI trước khi có API thật. Folder này **có thể trống** cho tới khi cần.
- Mỗi file đặt theo domain/entity, **PascalCase**: `mocks/Documents.ts`, `mocks/MatchResults.ts`.
- Mỗi biến export phải **type rõ ràng**, khớp DTO thật ở `#/types/<Domain>` (import type từ đó).

## Ví dụ

```ts
// src/mocks/MatchResults.ts
import type { MatchResultDto } from "#/types/Matching";

export const sampleMatchResult: MatchResultDto = {
  id: "match_001",
  cvDocumentId: "doc_cv_001",
  jdDocumentId: "doc_jd_001",
  overallScore: 82,
  semanticScore: 85,
  keywordScore: 78,
  report: {
    strengths: ["5+ years React", "Strong TypeScript"],
    gaps: ["No Kubernetes experience"],
    suggestions: ["Highlight CI/CD ownership"]
  },
  createdAt: "2026-07-30T08:00:00.000Z"
};
```

## Quy tắc

1. File PascalCase theo entity (số nhiều): `Documents.ts`, `MatchResults.ts`.
2. Type từ `#/types/<Domain>` — KHÔNG khai báo type mới trong mocks (xem `types.md`).
3. Chỉ dữ liệu — KHÔNG logic, KHÔNG gọi API. Khi API thật sẵn sàng → thay bằng `src/requests/` + `src/hooks/`, gỡ mock.
