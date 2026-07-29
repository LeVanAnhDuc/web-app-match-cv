# Client Layer-First Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `client/` to layer-first architecture and author the `client/.claude/` methodology layer (CLAUDE.md + rules + skills), with zero behavior change.

**Architecture:** Reorganize `client/src/**` from `features/<feature>/` into layer folders (`libs/ contexts/ constants/ types/ requests/ hooks/ stores/ locales/ i18n/ views/`), keeping `routes/`, `router.tsx`, `styles.css`, `test/`. Author `client/.claude/{CLAUDE.md,rules/*,skills/*}` modeled on the reference project, adapted to TanStack Start + Ant Design + i18next.

**Tech Stack:** TanStack Start (Vite/React 19), Ant Design 5, Tailwind 4, TanStack Query, Zustand, i18next, Vitest, Playwright, yarn.

## Global Constraints

- Alias `#/*` → `./src/*` (keep `#/`; do NOT switch to `@/`).
- Every component: own folder + `index.tsx`, arrow fn, `export default`, one const/file.
- Props typed inline in component params; all shared types in `src/types/<Domain>/`.
- No behavior change; UI/markup/i18n keys unchanged.
- `routeTree.gen.ts` is generated (`yarn generate-routes`) — never hand-edit.
- Verification (green gate, all must pass): `yarn format` → `yarn lint` → `npx tsc --noEmit` → `yarn test` → `yarn build`.
- Work in worktree `client/.worktrees/client-layer-first-migration` (branch `refactor/client-layer-first-migration`).

---

## Group A — `client/.claude/` authoring (no code dependency; parallelizable)

### Task A1: Skills (curated 11)

**Files (create):** `client/.claude/skills/<name>/SKILL.md` for:
`project-rules`, `standard-coding-universal`, `standard-typescript`, `standard-react`,
`standard-tanstack-start`, `standard-antd`, `standard-tailwind`, `standard-accessibility`,
`standard-security`, `standard-frontend-engineering-mindset`, `standard-uiux`.

**Source:** adapt from `web-app-store-server-client/client/.claude/skills/*`. Keep generic
skills near-verbatim; rewrite `standard-tanstack-start` (from `standard-nextjs`) and
`standard-antd` (from `standard-shadcn`) for this stack. Each SKILL.md keeps YAML
frontmatter (`name`, `description` with TRIGGER).

- [ ] Copy/adapt each skill; ensure `standard-uiux` states root `.claude/uiux/` wins on conflict.
- [ ] `project-rules/SKILL.md` rule table matches the 16 rules in Task A2.

### Task A2: Rules (path-scoped, 16)

**Files (create):** `client/.claude/rules/<name>.md` with YAML frontmatter `paths:`:
`component-folder`(`src/**/*.tsx`), `components`(`src/components/**`), `views`(`src/views/**`),
`ghosts`(`src/ghosts/**`), `types`(`src/types/**`), `utils`(`src/utils/**`),
`constants`(`src/constants/**`), `hooks`(`src/hooks/**`), `requests`(`src/requests/**`),
`stores`(`src/stores/**`), `forms`(`src/forms/**`), `datasources`(`src/dataSources/**`),
`mocks`(`src/mocks/**`), `locales`(`src/locales/**`), `imports`(`src/**`), `jsx`(`src/**/*.tsx`).

- [ ] Adapt content to this stack: `imports` → TanStack Router `Link`/`useNavigate` + `#/` alias;
      `forms` → antd `Form`; `requests` → `apiFetch` + query-key factory; `stores` → zustand;
      `locales` → i18next namespaced JSON.

### Task A3: `client/.claude/CLAUDE.md`

**Files (create):** `client/.claude/CLAUDE.md`.
Sections: Tech Stack (→ root `.claude/techstack/frontend.md`), Skills table, Commands, Architecture, Folder Conventions, Core Patterns, Quality gate. Model on ref CLAUDE.md.

- [ ] Verify every skill/rule referenced exists (A1/A2 done).

---

## Group B — code migration (sequential; `tsc` after each task catches danglers)

> Use `git mv` where a file moves 1:1 to preserve history; use Write for splits.

### Task B1: `libs/` + `contexts/`

**Files:**
- Move: `lib/api.ts` → `libs/api.ts`
- Create: `libs/query-client.ts` (extract the `QueryClient` factory from `integrations/tanstack-query/root-provider.tsx`)
- Create: `contexts/ReactQueryProvider/index.tsx` (provider wrapping children with the client) + `contexts/ReactQueryProvider/devtools.tsx` (from `integrations/tanstack-query/devtools.tsx`)
- Move: `providers/AntdProvider.tsx` → `contexts/AntdProvider/index.tsx`
- Modify: `routes/__root.tsx` imports → `#/contexts/AntdProvider`, `#/contexts/ReactQueryProvider/devtools`, `#/i18n/config`
- Modify: `router.tsx` (if it builds the QueryClient) → import from `#/libs/query-client`

**Interfaces:** Produces `apiFetch<T>`, `ApiError` from `#/libs/api`; `createQueryClient()` from `#/libs/query-client`; `AntdProvider` default/named from `#/contexts/AntdProvider`.

- [ ] Move files; update imports; `npx tsc --noEmit` clean for touched files.

### Task B2: `constants/`

**Files (create):**
- `constants/endpoints.ts` — `/documents`, `/documents/:id`, `/match`, `/match/:id` builders
- `constants/fileConstraints.ts` — `MAX_FILE_SIZE_BYTES`, `MAX_FILE_SIZE_LABEL`, `ALLOWED_FILE_PATTERN`
- `constants/index.ts` — barrel exporting a `CONSTANTS` object

**Interfaces:** Produces `CONSTANTS.ENDPOINTS.*`, `CONSTANTS.FILE.*` from `#/constants`.

- [ ] Extract literals from `DocumentInputStep` and request fns; leave usages wired in B4/B7.

### Task B3: `types/`

**Files:**
- Move: `features/documents/types.ts` → `types/Documents/index.ts`
- Move: `features/matching/types.ts` → `types/Matching/index.ts`

**Interfaces:** Produces `DocumentKind, SourceFormat, DocumentDto, DocumentSummaryDto, CreateDocumentInput, CreateDocumentFileInput, CreateDocumentPasteInput` from `#/types/Documents`; `MatchReport, MatchResultDto, CreateMatchInput` from `#/types/Matching`.

- [ ] Move; no logic change.

### Task B4: `requests/` + `hooks/` (split queries.ts — D3)

**Files (create):**
- `requests/documents.ts` — `savedDocumentsQueryKey`, `documentQueryKey`, `fetchDocument`, `fetchSavedDocuments`, `createDocument` (pure fns using `apiFetch` + `CONSTANTS.ENDPOINTS`)
- `requests/match.ts` — `matchResultQueryKey`, `runMatch`, `fetchMatchResult`
- `hooks/useDocuments.ts` — `useDocument`, `useSavedDocuments`, `useCreateDocument` (React Query hooks calling `requests/documents`)
- `hooks/useMatch.ts` — `useRunMatch`, `useMatchResult`
- `hooks/index.ts` — barrel

**Interfaces:** Consumes `#/types/*`, `#/libs/api`, `#/constants`. Produces the hooks above from `#/hooks`.

- [ ] Split; keep query-key factories in `requests/*` and re-export via hooks if convenient.
- [ ] Move+update `features/*/__tests__/queries.test.tsx` → `hooks/__tests__/{useDocuments,useMatch}.test.tsx`.

### Task B5: `stores/`

**Files:**
- Create: `stores/slices/wizard.ts` (from `features/wizard/store.ts`) — `useWizardStore`, `WizardStep`
- Create: `stores/index.ts` — barrel re-export

**Interfaces:** Produces `useWizardStore`, `WizardStep` from `#/stores`.

- [ ] Move; consumers rewired in B7.

### Task B6: `locales/` + `i18n/config.ts`

**Files:**
- Move: `i18n/en.json` → `locales/en/translation.json`; `i18n/vi.json` → `locales/vi/translation.json`
- Move: `i18n/index.ts` → `i18n/config.ts` (update JSON imports to `#/locales/*`)
- Move: `i18n/__tests__/i18n.test.ts` → `i18n/__tests__/config.test.ts` (update import)
- Modify: `routes/__root.tsx`, `routes/index.tsx` — import `#/i18n/config` (side-effect import)

**Interfaces:** Produces default i18next instance from `#/i18n/config`.

- [ ] Move; keep keys byte-identical.

### Task B7: `views/Wizard/` (D1 component-folder)

**Files (create — each `index.tsx` in its own folder):**
- `views/Wizard/index.tsx` (from `WizardPage.tsx`)
- `views/Wizard/mains/StepJD/index.tsx`, `StepCV/index.tsx`, `StepReview/index.tsx`, `StepResult/index.tsx`
- `views/Wizard/components/DocumentInputStep/index.tsx`, `Stepper/index.tsx`, `UploadPasteTabs/index.tsx`, `SavedDocRadioList/index.tsx`, `SaveForReuseButton/index.tsx`
- Co-locate tests: `views/Wizard/**/__tests__/*` (from `features/wizard/__tests__/*`)

**Rewrites in each file:** imports → `#/hooks`, `#/stores`, `#/types/*`, `#/constants`, sibling `views/Wizard/*`. Convert any local `ScoreBar`/`ReportList` helpers that are used only in one file — keep inline (single-use) OR extract to `components/` only if shared. Props stay inline-typed.

**Interfaces:** Produces default `Wizard` from `#/views/Wizard`.

- [ ] Create folders/files; migrate content; update intra-view imports; `tsc` clean.

### Task B8: routes + cleanup

**Files:**
- Modify: `routes/wizard.tsx` → `import Wizard from '#/views/Wizard'`
- Modify: `routes/index.tsx` (Home) → if kept as-is, leave; else move to `views/Home/` (optional, keep inline for MVP)
- Delete: emptied `features/`, `lib/`, `providers/`, `integrations/tanstack-query/` dirs
- Run: `yarn generate-routes` to refresh `routeTree.gen.ts`

- [ ] Remove empty dirs; regenerate routes; `tsc` clean.

### Task B9: green gate

- [ ] `yarn format`
- [ ] `yarn lint` (fix all)
- [ ] `npx tsc --noEmit` (fix all)
- [ ] `yarn test` (all vitest pass)
- [ ] `yarn build` (succeeds)
- [ ] `yarn test:e2e` if app boots (ports 5300/5200); else record skip reason (pure refactor).

---

## Group C — drift, finish, PR

### Task C1: root `.claude/CLAUDE.md` drift (§4.6)

**Files (modify, root `.claude/` repo worktree):** mark `client/.claude/CLAUDE.md` + FE skills DONE (not TBD) in §2 & §4.2; set E2E command `yarn test:e2e`.

> NOTE: root `.claude/` is a separate repo. Create a sibling worktree
> `.claude/.worktrees/client-layer-first-migration` if this drift update is included.

- [ ] Update; non-blocking; user approves.

### Task C2: README sync

- [ ] If setup/structure changed enough, dispatch `readme-maintainer` for `client/README.md` (folder-structure section). README only.

### Task C3: commit + PR (STOP → report user before merge)

- [ ] Commit per repo touched (docs: design.md+plan.md+.gitignore; client: .claude + src migration; .claude root: drift).
- [ ] Push + open PR per repo via `creating-github-pr`.
- [ ] **Report to user at merge gate** (do not auto-merge).

## Self-Review notes

- Spec coverage: §4/§5 map → Tasks B1–B8; §6 → A1–A3; §7 → C1; §8 → B9. ✓
- Type consistency: interfaces blocks name exact exports reused across tasks. ✓
