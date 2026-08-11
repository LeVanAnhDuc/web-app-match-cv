# Client — Frontend Web

TanStack Start frontend cho web-app-match-cv (job-board 2 chiều; MVP = CV↔JD matching wizard). Kết nối BE qua `apiFetch<T>` → `VITE_API_BASE_URL` (mặc định `http://localhost:5200/api/v1`).

## Tech Stack

Chi tiết version/packages xem root `.claude/techstack/frontend.md`. Tóm tắt:

- **Framework**: TanStack Start (Vite + React 19), file-based router (`src/routes/`)
- **Language**: TypeScript 5 (`verbatimModuleSyntax`, `strict`, `noUnusedLocals`)
- **UI**: Ant Design 5 (`@ant-design/cssinjs` + `@ant-design/v5-patch-for-react-19`) + Tailwind CSS 4
- **State**: Zustand (global) + TanStack Query (server state)
- **i18n**: i18next / react-i18next (`en` / `vi`)
- **Icons**: `lucide-react` (chính) + `@ant-design/icons`
- **HTTP**: `apiFetch<T>` fetch wrapper (`src/libs/api.ts`) — trả DTO trực tiếp, throw `ApiError` khi non-2xx
- **Test**: Vitest (unit) + Playwright (e2e)
- **Package manager**: yarn

## Skills

Thư mục `.claude/skills/` chứa các file hướng dẫn coding convention. Đọc skill tương ứng task hiện tại:

| Khi nào                                                                | Skill                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Viết/review BẤT KỲ code — nguyên tắc chung                             | `standard-coding-universal/SKILL.md`                             |
| Viết/review `.ts`/`.tsx` (type safety, tsconfig, TSX typing, imports)  | `standard-typescript/SKILL.md`                                   |
| Viết/review React component, hook; performance, bundle size            | `standard-react/SKILL.md`                                        |
| Viết/review route, loader, root shell, router context (TanStack Start) | `standard-tanstack-start/SKILL.md`                               |
| Dùng Ant Design component, ConfigProvider/theme, Form                  | `standard-antd/SKILL.md`                                         |
| Viết/review Tailwind classes, theme, responsive, dark mode             | `standard-tailwind/SKILL.md`                                     |
| Viết/review a11y (form, modal, navigation, focus)                      | `standard-accessibility/SKILL.md`                                |
| Đụng auth / input user / data nhạy cảm / render untrusted              | `standard-security/SKILL.md`                                     |
| Thiết kế UI architecture, rendering, Core Web Vitals                   | `standard-frontend-engineering-mindset/SKILL.md`                 |
| Thiết kế UI/UX, layout, typography, color, animation                   | `standard-uiux/SKILL.md` (conflict → root `.claude/uiux/` thắng) |
| Tạo/chỉnh file, cần xác định convention của folder/path                | `project-rules/SKILL.md`                                         |

## Rules (path-scoped)

`project-rules` điều hướng tới `.claude/rules/*.md` theo `paths` frontmatter. Đọc rule khớp target path **1 lần ở đầu task**:

| Rule                | Paths                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| `component-folder`  | `src/**/*.tsx` — mỗi component = folder + `index.tsx`, arrow fn, `export default` |
| `components`        | `src/components/**` — shared, no business logic                                   |
| `views`             | `src/views/**` — `index.tsx` + `mains/` + `components/` (+ `ghosts/`)             |
| `layouts`           | `src/layouts/**` — shell bọc route (`AppShell`): `index.tsx` + `components/`      |
| `ghosts`            | `src/ghosts/**` — side-effect-only, `return null`                                 |
| `types`             | `src/types/**` — type dùng chung theo `<Domain>/`; props inline                   |
| `utils`             | `src/utils/**` — pure fn                                                          |
| `constants`         | `src/constants/**` — `CONSTANTS` object                                           |
| `hooks`             | `src/hooks/**` — `useXxx.ts` + barrel; React Query hooks                          |
| `requests`          | `src/requests/**` — API fn thuần qua `apiFetch`                                   |
| `stores`            | `src/stores/**` — Zustand + `slices/`                                             |
| `forms`             | `src/forms/**` — antd `Form`                                                      |
| `datasources`       | `src/dataSources/**` — static UI data                                             |
| `mocks`             | `src/mocks/**` — dummy data                                                       |
| `locales`           | `src/locales/**` — i18next JSON `en/`+`vi/`                                       |
| `imports`           | `src/**` — alias `#/`, TanStack Router nav, `import type`                         |
| `jsx`               | `src/**/*.tsx` — ưu tiên antd cho interactive element                             |
| `layout-primitives` | `src/**/*.tsx` — `PageContainer`/`SectionCard`, semantic token, thang chữ         |

## Commands

```bash
yarn dev              # Dev server (port 5300)
yarn generate-routes  # tsr generate → routeTree.gen.ts (KHÔNG sửa tay)
yarn build            # Production build (client + SSR)
yarn preview          # Preview build
yarn type-check       # tsc --noEmit
yarn lint             # ESLint (check-only, không sửa file)
yarn lint:fix         # ESLint + auto-fix
yarn format           # prettier --write . && eslint --fix
yarn format:check     # prettier --check .
yarn test             # Vitest (unit)
yarn test:e2e         # Playwright (e2e) — 3 viewport project: desktop / tablet / mobile
                      #   1 viewport: yarn test:e2e --project=mobile
                      #   dev server ở port khác (worktree): E2E_BASE_URL=http://localhost:5302 yarn test:e2e
```

**Lint/format config**: Prettier (`prettier.config.js`) dùng chung style với `server/` và app anh em `web-app-store-server-client` — double quote, có `;`, `trailingComma: none`, `printWidth 80`; kèm `prettier-plugin-tailwindcss` sort class Tailwind (`tailwindStylesheet: ./src/styles.css` vì Tailwind 4 không có file config JS). ESLint (`eslint.config.js`) = `tanstackConfig` + layer react / react-hooks / jsx-a11y / promise / unused-imports / prettier. `src/routeTree.gen.ts` bị **ignore ở cả prettier lẫn eslint** (file generated, tự yêu cầu vậy trong header).

## Architecture

```
routes/__root.tsx (shellComponent + HeadContent/Scripts)
└── AntdProvider (contexts/AntdProvider)          ← ConfigProvider theme + StyleProvider
    └── route components (từ src/views/*)
router.tsx: getContext() (libs/query-client) → QueryClient vào router context
            + setupRouterSsrQueryIntegration (KHÔNG có <QueryClientProvider> tường minh)
i18n: src/i18n/config.ts init i18next (side-effect import trong __root)
```

- **API base**: mọi request qua `apiFetch<T>` (`src/libs/api.ts`); base `VITE_API_BASE_URL`. KHÔNG hard-code URL BE.
- **Routing**: file-based (`src/routes/`). Route file chỉ wiring `createFileRoute(...)({ component })`, UI thật nằm ở `src/views/` (nội dung trang) và `src/layouts/` (shell bọc route — `_app.tsx` → `layouts/AppShell`). Route hiện có: `_app/{index,wizard,cv,jd,my-data}` → `/`, `/wizard`, `/cv`, `/jd`, `/my-data`.
- **Locales**: `en` (default) + `vi` qua i18next; JSON ở `src/locales/{en,vi}/translation.json`.
- **Design token**: `src/styles.css` khai báo semantic color token bằng Tailwind 4 `@theme` + override `@media (prefers-color-scheme: dark)` (`bg-surface`, `border-line`, `text-body/muted/faint`, `bg-primary`, `text-accent`). Mọi UI dùng utility này thay cho cặp `slate-*` + `dark:slate-*` — xem rule `layout-primitives`.

## Folder Conventions

- `src/views/<View>/` — 1 trang: `index.tsx` (shell/entry) + `mains/` (organism, import bởi index) + `components/` (molecule view-local) + optional `ghosts/`. VD `views/Wizard/`.
- `src/layouts/<Layout>/` — shell bọc route con qua `children`/`<Outlet />` (chrome của app), lắp bởi pathless layout route. VD `layouts/AppShell/` (sidebar + Drawer nav) dùng bởi `routes/_app.tsx`. KHÔNG có `mains/`.
- `src/components/` — component dùng chung ≥2 view, no business logic. Gồm 2 layout primitive bắt buộc: `PageContainer` (khung trang) + `SectionCard` (card duy nhất của app).
- `src/requests/` — fn gọi API thuần (1 file/domain) + query-key factory; dùng `apiFetch` + `#/constants`.
- `src/hooks/` — React Query hook (`useXxx.ts`) gọi `requests/` + barrel `index.ts`.
- `src/types/<Domain>/` — MỌI type dùng chung; props component viết **inline** tại tham số, KHÔNG `type Props`.
- `src/stores/` — Zustand: `index.ts` barrel + `slices/<name>.ts` (`wizard`, `ui`); ngoài React dùng `useXStore.getState()`. Slice `ui` giữ trạng thái thu/mở sidebar, persist `localStorage` key `ui.sidebarCollapsed`, hydrate sau mount (AppShell) để không vỡ SSR.
- `src/constants/` — `CONSTANTS` object (endpoints, file constraints, keys).
- `src/libs/` — `api.ts` (apiFetch/ApiError), `query-client.ts` (getContext), `query-devtools.tsx`.
- `src/contexts/` — provider (AntdProvider…).

## Core Patterns

- **apiFetch**: `apiFetch<T>(path, init?)` — `init.body` là JSON string (+ Content-Type) hoặc `FormData`. Non-2xx → `throw new ApiError(status, message)`. 204 → `undefined`.
- **Query keys**: factory trong `requests/*` (`documentQueryKey(id)`, `savedDocumentsQueryKey(kind)`, `matchResultQueryKey(id)`).
- **Component**: arrow fn + `export default`, props inline; helper private single-use được co-locate (không export).
- **Alias**: `#/*` → `src/*`; cross-layer luôn `#/`, relative chỉ trong cùng view.
- **i18n**: text qua `t(...)`; key đồng bộ `en`/`vi`.

## Quality & Workflow

**BẮT BUỘC: sau khi hoàn tất BẤT KỲ task code trong thư mục này, chạy đủ theo thứ tự:**

```bash
yarn format       # auto-fix format
yarn lint         # ESLint (fix hết error)
yarn type-check   # type check (fix tay)
yarn test         # Vitest (phải xanh)
yarn build        # build phải thành công
```

- Chạy đủ dù nghĩ code đã sạch. Còn error → fix HẾT trước khi bàn giao.
- `yarn format`/`yarn lint` có thể tự sửa file → đọc lại file sau khi chạy.
- E2E (`yarn test:e2e`) chạy khi thay đổi behavior user thấy được (§4.3 root CLAUDE.md).
