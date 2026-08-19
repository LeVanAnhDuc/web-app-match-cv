---
name: utils
paths:
  - "src/utils/**/*"
---

# Utils Convention (src/utils/)

- `src/utils/` chứa **pure function / helper**. Miễn là pure function (hay support function thuần) thì đưa vào đây — kể cả chỉ dùng ở 1 nơi.
- Các hàm phải **pure**: không side effect, không đọc state/context/React hook bên ngoài, chỉ nhận input → trả output.
- Mỗi hàm **named export** riêng lẻ; tên camelCase, mô tả rõ chức năng.
- Có **barrel `index.ts`** re-export để consumer `import { fmtScore } from '#/utils'`.

## Cấu trúc

```
src/utils/
  index.ts        # barrel: export * from './score'  ...
  score.ts        # formatScore, clampPercent
  document.ts     # documentKindLabel, isSupportedFileType
```

## Ví dụ

```ts
// src/utils/score.ts
export const formatScore = (score: number): string => `${Math.round(score)}%`;

export const clampPercent = (value: number): number =>
  Math.max(0, Math.min(100, value));
```

```ts
// src/utils/index.ts
export * from "./score";
export * from "./document";
```

## Quy tắc

1. Không đưa hàm có side effect (fetch, đọc store, dùng `window`) vào `utils/` — API request → `src/requests/` (xem `requests.md`); logic React → `src/hooks/`.
2. Type dùng chung mà util nhận/trả → khai báo ở `src/types/<Domain>/`, import vào (xem `types.md`) — KHÔNG `export type` trong file util.
