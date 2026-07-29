# Design — Client Layer-First Rules/Skills + Migration

> **Status**: Approved 2026-07-30. Feature `client-layer-first-migration`.
> Migrate `client/` (TanStack Start + Ant Design) from feature-first to
> layer-first architecture, and author the `client/.claude/` methodology layer
> (CLAUDE.md + rules + skills) modeled on the reference project
> `web-app-store-server-client/client` (Next.js + shadcn), adapted to this stack.

## 1. Goal & Scope

- **Author** `client/.claude/`: `CLAUDE.md`, `rules/*.md` (path-scoped), `skills/*` (curated).
- **Migrate** all `client/src/**` code from `features/<feature>/` (feature-first)
  to layer-first folders (`components/`, `views/`, `hooks/`, `requests/`, `types/`,
  `constants/`, `stores/`, `libs/`, `contexts/`, `locales/`, `dataSources/`, etc.).
- **No behavior change** — pure refactor + convention docs. Existing Vitest unit
  tests and Playwright e2e must still pass; UI output unchanged.

**Out of scope**: BE (`server/`), new features, DB wiring, auth. `.claude/uiux/`
and `.claude/techstack/` (root repo) unchanged — client CLAUDE.md references them.

## 2. Reference vs Current (baseline)

| | Ref `store/client` | Current `match-cv/client` |
|---|---|---|
| Framework | Next.js 15 App Router | **TanStack Start** (file-based router) |
| UI | shadcn/ui | **Ant Design 5** + `@ant-design/cssinjs` |
| i18n | next-intl | **i18next / react-i18next** |
| HTTP | Axios instance | `apiFetch<T>` fetch wrapper (`lib/api.ts`) |
| Org | layer-first | feature-first (`features/{wizard,documents,matching}`) |
| Alias | `@/` | `#/` (both `#/` & `@/` resolve; **keep `#/`**) |
| PM | yarn | **yarn** |

## 3. Decisions (approved)

- **D1 — component-folder**: adopt ref fidelity. Every component = its own folder
  with `index.tsx`, arrow function, `export default`, one const per file.
- **D2 — alias**: keep `#/` (current, less churn; both resolve to `./src/*`).
- **D3 — API split**: `features/*/queries.ts` → `requests/*.ts` (pure fetch fns +
  query-key factories) + `hooks/use*.ts` (React Query hooks). DTOs → `types/*`.
- **Skill set**: curated 11 (drop `standard-seo`); adapt `standard-nextjs`→
  `standard-tanstack-start`, `standard-shadcn`→`standard-antd`.
- **Props typing**: inline in component params (no separate `Props` type/interface);
  all *shared* types live in `src/types/<Domain>/`.

## 4. Target `src/` layout (layer-first)

```
src/
  components/        # shared components (≥2 consumers), no business logic
  constants/         # CONSTANTS object: endpoints, queryKeys, storage keys, fileConstraints
  contexts/          # providers: AntdProvider, ReactQueryProvider, (AppProvider)
  dataSources/       # UI static data (options, columns) — added when needed
  forms/             # antd Form definitions — added when needed
  ghosts/            # side-effect-only components, return null — added when needed
  hooks/             # useXxx.ts (incl. React Query hooks) + barrel index.ts
  i18n/              # config.ts (i18next init)
  libs/              # api.ts (apiFetch/ApiError), query-client.ts
  locales/           # en/*.json, vi/*.json (namespaced)
  mocks/             # dummy data — added when needed
  requests/          # pure API request fns per feature
  routes/            # TanStack file-based routing (== Next app/) — KEPT
  stores/            # zustand: index.ts + slices/
  types/             # ALL shared types, grouped by <Domain>/
  utils/             # pure fns
  views/             # page views: index.tsx + mains/ + components/ + ghosts/
  router.tsx         # KEPT
  routeTree.gen.ts   # generated — KEPT
  styles.css         # KEPT
  test/setup.ts      # KEPT (vitest)
```

## 5. File migration map

| Current | Target |
|---|---|
| `lib/api.ts` | `libs/api.ts` |
| `integrations/tanstack-query/root-provider.tsx` | `contexts/ReactQueryProvider/index.tsx` + `libs/query-client.ts` |
| `integrations/tanstack-query/devtools.tsx` | `contexts/ReactQueryProvider/devtools.tsx` (or keep in integrations barrel) |
| `providers/AntdProvider.tsx` | `contexts/AntdProvider/index.tsx` |
| `features/documents/queries.ts` | `requests/documents.ts` (fns + keys) + `hooks/useDocuments.ts` |
| `features/documents/types.ts` | `types/Documents/index.ts` |
| `features/documents/__tests__/queries.test.tsx` | `hooks/__tests__/useDocuments.test.tsx` |
| `features/matching/queries.ts` | `requests/match.ts` + `hooks/useMatch.ts` |
| `features/matching/types.ts` | `types/Matching/index.ts` |
| `features/matching/__tests__/queries.test.tsx` | `hooks/__tests__/useMatch.test.tsx` |
| `features/wizard/store.ts` | `stores/slices/wizard.ts` + `stores/index.ts` |
| `features/wizard/WizardPage.tsx` | `views/Wizard/index.tsx` |
| `features/wizard/Step{JD,CV,Review,Result}.tsx` | `views/Wizard/mains/Step{JD,CV,Review,Result}/index.tsx` |
| `features/wizard/{DocumentInputStep,Stepper,UploadPasteTabs,SavedDocRadioList,SaveForReuseButton}.tsx` | `views/Wizard/components/<Name>/index.tsx` |
| `features/wizard/__tests__/*` | `views/Wizard/**/__tests__/*` (co-located per component) |
| inline consts (`MAX_FILE_SIZE_*`, `ALLOWED_FILE_PATTERN`, API paths) | `constants/*.ts` |
| `i18n/index.ts` | `i18n/config.ts` |
| `i18n/{en,vi}.json` | `locales/{en,vi}/translation.json` |
| `i18n/__tests__/i18n.test.ts` | `i18n/__tests__/config.test.ts` |
| `routes/*`, `router.tsx`, `routeTree.gen.ts`, `styles.css`, `test/setup.ts` | KEPT (update imports only) |

Route files import from `views/` (e.g. `routes/wizard.tsx` → `#/views/Wizard`).
`__root.tsx` imports providers from `#/contexts/*`.

## 6. `client/.claude/` deliverables

### 6.1 Skills (`client/.claude/skills/<name>/SKILL.md`) — 11
`project-rules`, `standard-coding-universal`, `standard-typescript`,
`standard-react`, `standard-tanstack-start` (new), `standard-antd` (new),
`standard-tailwind`, `standard-accessibility`, `standard-security`,
`standard-frontend-engineering-mindset`, `standard-uiux`.
(`standard-uiux` conflict rule: root `.claude/uiux/` wins.)

### 6.2 Rules (`client/.claude/rules/<name>.md`, YAML `paths` frontmatter) — 16
`component-folder` (`src/**/*.tsx`), `components` (`src/components/**`),
`views` (`src/views/**`), `ghosts` (`src/ghosts/**`), `types` (`src/types/**`),
`utils` (`src/utils/**`), `constants` (`src/constants/**`), `hooks` (`src/hooks/**`),
`requests` (`src/requests/**`), `stores` (`src/stores/**`), `forms` (`src/forms/**`),
`datasources` (`src/dataSources/**`), `mocks` (`src/mocks/**`),
`locales` (`src/locales/**`), `imports` (`src/**`), `jsx` (`src/**/*.tsx`).

### 6.3 `client/.claude/CLAUDE.md`
Sections: Tech Stack (→ `.claude/techstack/frontend.md`) · Skills table ·
Commands (yarn dev/build/lint/test/e2e + `tsc --noEmit`) · Architecture
(TanStack Start shell, router context `{ queryClient }`, i18next, AntdProvider) ·
Folder Conventions · Core Patterns (`apiFetch<T>`/`ApiError`, query-key factory,
zustand `getState()`, inline props, i18n) · Quality gate (format→lint→tsc).

## 7. Root CLAUDE.md updates (drift, §4.6)

After migration, update root `.claude/CLAUDE.md` §2 & §4.2 to mark
`client/.claude/CLAUDE.md` and FE skills as **DONE** (no longer TBD), and E2E
tooling command (`yarn test:e2e`). This rides the client PR's sibling docs/root PR.

## 8. Verification

Pure refactor ⇒ E2E dual-gate (§4.3) **skipped** (no behavior change); security
review (§4.5) **skipped** (no attack-surface change) — both reasons recorded.
Green-checks gate (§4.7) is authoritative:
1. `yarn format` 2. `yarn lint` 3. `npx tsc --noEmit` 4. `yarn test` (vitest) 5. `yarn build`.
All must pass. E2E suite (`yarn test:e2e`) run if app boots; else note.

## 9. Risks

- **Import churn**: every module import path changes. Mitigate: migrate folder by
  folder, run `tsc --noEmit` after each layer to catch danglers early.
- **`routeTree.gen.ts`**: regenerated by `tsr generate` — do not hand-edit; run
  `yarn generate-routes` after route imports settle.
- **component-folder churn (D1)**: large file count increase; acceptable per approval.
- **Tests referencing old paths**: update alongside their moved modules.
