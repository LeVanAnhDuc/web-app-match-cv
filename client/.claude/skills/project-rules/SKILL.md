---
name: project-rules
description: Process for reading and applying rule files from .claude/rules/ before creating or modifying files. TRIGGER when creating new files, moving files, or determining the convention for a specific folder/path. Each rule file has a `paths` frontmatter field defining its scope — the agent MUST read the matching rules before operating on files in that path.
user-invocable: false
---

# Project Rules

The `.claude/rules/` directory contains rule files that define conventions for each part of the `client/` codebase. Each rule file has YAML frontmatter with a `paths` field specifying the glob patterns it applies to.

> **Stack**: TanStack Start (Vite + React 19) + Ant Design 5 + Tailwind 4 + TanStack Query + Zustand + i18next. Layer-first folder layout under `src/`. Import alias `#/*` → `./src/*`.

## Rule Files Reference

| Rule file             | Paths                  | Purpose                                                                                            |
| --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `component-folder.md` | `src/**/*.tsx`         | Each component = own folder + `index.tsx`, arrow function, `export default`, only 1 const per file |
| `components.md`       | `src/components/**/*`  | Shared components used across 2+ views, no business logic                                          |
| `views.md`            | `src/views/**/*`       | Page/screen-level composition; one view per route, wires components + hooks + ghosts               |
| `ghosts.md`           | `src/ghosts/**/*`      | Shared headless components (side-effects / logic), always `return null`                            |
| `types.md`            | `src/types/**/*`       | ALL shared types live in `src/types/<Domain>/`, NEVER define shared types inside components        |
| `utils.md`            | `src/utils/**/*`       | ALL pure functions go in `utils/`, named exports                                                   |
| `constants.md`        | `src/constants/**/*`   | Constants grouped into a single CONSTANTS object, `export default`                                 |
| `hooks.md`            | `src/hooks/**/*`       | Custom hooks: `useXxx.ts`, barrel re-export via `index.ts`                                         |
| `requests.md`         | `src/requests/**/*`    | API calls via `apiFetch<T>` wrapper (`src/libs/api.ts`); one module per domain                     |
| `stores.md`           | `src/stores/**/*`      | Zustand stores: `create<State>()`, one store per domain, `useXxxStore` naming                      |
| `forms.md`            | `src/forms/**/*`       | Form config per domain (antd `Form` schema / field defs / validation)                              |
| `datasources.md`      | `src/dataSources/**/*` | UI data config: table columns, enums, filter/select options                                        |
| `mocks.md`            | `src/mocks/**/*`       | Dummy data by domain, PascalCase, plural naming                                                    |
| `locales.md`          | `src/locales/**/*`     | i18next resource JSON (EN + VI), namespaced keys kept in sync across languages                     |
| `imports.md`          | `src/**/*`             | Import ordering + `#/*` alias usage; `import type` for type-only imports                           |
| `jsx.md`              | `src/**/*.tsx`         | JSX authoring rules (antd vs raw elements, Tailwind for layout, a11y attributes)                   |

## Required Process

> **IMPORTANT:** Rules phải được đọc **1 lần duy nhất ở đầu task**. Khi đã đọc rồi thì áp dụng luôn, KHÔNG đọc lại khi bắt tay vào code.

### Ở đầu task (đọc 1 lần)

1. Xác định tất cả target paths sẽ tạo/sửa trong task.
2. Find ALL rule files whose `paths` match các target paths đó (nhiều rule có thể áp dụng đồng thời).
3. Read the content of those rule files.
4. Read an existing file in the same folder (if any) to understand actual conventions.

**Example:** Task tạo trang Wizard sẽ tạo files trong `src/views/Wizard/`

- Matches: `views.md` (`src/views/**/*`) + `component-folder.md` (`src/**/*.tsx`) + `jsx.md` (`src/**/*.tsx`) + `imports.md` (`src/**/*`)
- Read tất cả rule đó ở đầu task, áp dụng khi code.

### When UNSURE about conventions

- Read the corresponding rule file first.
- If still unclear → ask the user, DO NOT guess.

## Notes

- A single file can match MULTIPLE rules simultaneously (e.g. a `.tsx` file in `views/` matches `views.md`, `component-folder.md`, `jsx.md`, and `imports.md`).
- `component-folder.md`, `jsx.md`, and `imports.md` are the broadest rules — they apply to nearly every file under `src/`.
- Always prioritize the more specific rule when conflicts arise (e.g. `components.md` is more specific than `component-folder.md`).
- **Conflict resolution**: `client/.claude/CLAUDE.md` > `.claude/rules/*` > these convention skills > generic superpowers methodology. When a rule and a skill disagree, the rule wins.
