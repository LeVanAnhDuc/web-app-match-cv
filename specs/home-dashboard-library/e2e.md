# E2E — `home-dashboard-library`

> §4.3 dual-gate. Gate A = committed Playwright suite (`client/e2e/home-dashboard-library/library.e2e.ts`) against the running dev pair. Gate B = MCP browser walk (chrome-devtools) of the same scenarios. Both **PASS**.

## Run (worktree pair on separate ports)

```bash
# server (feature branch)
cd server/.worktrees/home-dashboard-library
PORT=5202 CLIENT_ORIGIN=http://localhost:5302 yarn start:dev
# client (feature branch)
cd client/.worktrees/home-dashboard-library
VITE_API_BASE_URL=http://localhost:5202/api/v1 yarn dev --port 5302
# Gate A
E2E_BASE_URL=http://localhost:5302 E2E_API_BASE=http://localhost:5202/api/v1 \
  E2E_DATABASE_URL="<server DATABASE_URL>" yarn test:e2e e2e/home-dashboard-library/library.e2e.ts
```

The spec is self-contained: `global-setup` clears `Document`/`MatchResult`; the suite seeds its own saved CVs/JD via the API + one `MatchResult` via `pg` (no OpenRouter call) — deterministic, re-runnable. Each mutation test targets its own document, so tests are order-independent.

## Scenarios (Gate A — 8/8 pass · Gate B — walked, pass)

| # | Scenario | Rubric | Gate A | Gate B (MCP) |
|---|---|---|---|---|
| 1 | Home: hero CTA (→ wizard) + recent match row (CV×JD title) rendered | happy / data-render | ✅ | ✅ stats CVS 2 / JDS 1 / matches 1 / highest 18% + recent row |
| 2 | i18n: switch nav + labels to Vietnamese | i18n (en+vi) | ✅ | ✅ Trang chủ / CV đã lưu; UI re-renders w/o crash |
| 3 | Responsive: sidebar → hamburger + drawer nav at 375px | responsive (F3) | ✅ | ✅ desktop sidebar / mobile hamburger→drawer |
| 4 | Library `/cv`: lists saved CVs w/ actions + format badge; download hidden for text | happy / data-render | ✅ | ✅ PDF badge + Download link; text row no Download |
| 5 | Preview: opens modal, renders original file | happy / F1 renderer | ✅ (text content) | ✅ **PDF rendered via react-pdf** (canvas) |
| 6 | Rename saved CV → title updates | mutation | ✅ | (unit-covered) |
| 7 | Delete blocked (409) while used by a match → inUse message, row survives | mutation / validation [DT] | ✅ | ✅ toast "used in a match history" + row stays |
| 8 | Delete unreferenced CV → removed | mutation [ST] | ✅ | (covered) |
| 9 | Home empty state (0 saved, no matches) → zeros + "No matches yet" + CTA | empty/null | (implicit) | ✅ verified on empty DB |

**Bug found by Gate B (fixed, commit `922722e`)**: PDF preview crashed on any unrelated re-render (e.g. i18n language change) — react-pdf received a fresh `{data: ArrayBuffer}` literal each render and pdf.js had already detached (transferred) the buffer to its worker → "Cannot perform Construct on a detached ArrayBuffer". Fix: memoize the `file` object + `destroyOnHidden` on the modal. Unit tests (which mock react-pdf) could not catch this — exactly the value of Gate B.

## Coverage notes / follow-up
- AuthN/AuthZ: **N/A** (auth deferred, single stub user); per-user isolation covered by BE e2e.
- Library pagination + a dedicated "all matches" page: intentional follow-up gaps (small dataset in MVP).
- **Pre-existing**: the wizard e2e suite (`client/e2e/cv-jd-matching-wizard/*`) predates the client layer-first migration and references removed `src/features/*` paths; `helpers.ts` type import was fixed here, but a full reconciliation of that suite with the migrated structure + the new render-based Review step is a separate follow-up (out of this feature's scope).
