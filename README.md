# Match CV — score your CV against a job description, then improve it

Match CV takes one CV and one job description, gives you a match score with a plain-language report of what fits and what is missing, and then helps you act on it: reworded CV suggestions you approve one by one, a grounded cover letter, and a side-by-side comparison showing how much a new CV version improved.

It is built for job seekers who want to know whether a CV is worth sending before they send it. You bring your own AI provider key (or fall back to the system key), so you always know where your documents are going.

Runs locally as two apps: a NestJS API (`server/`, port `5200`) and a TanStack Start web client (`client/`, port `5300`).

## Features

- **4-step matching wizard** (`/wizard`)
  - Step 1 (JD) and step 2 (CV): upload a PDF or DOCX (max 10MB) or paste plain text; the server extracts the text.
  - Pick a document you already saved instead of uploading again, or save the one you just added for reuse.
  - Step 3 Review: read back the extracted text of both documents before spending an AI call. Read-only — if the parse is wrong, go back and upload again.
  - Step 4 Result: the match report.

- **Match score with a breakdown**
  - One overall percentage in a circular gauge, plus two bars: semantic match and keyword/skills match (overall = 60% semantic + 40% keyword; the LLM does not score, it only explains).
  - Report sections: matched strengths, gaps / missing, and how to improve your CV.
  - A visible disclaimer that the text was sent to an AI provider and results should be verified.

- **Run one pair through several providers at once**
  - Select several of your credentials in step 3 and get one result card per provider, revealed as each finishes; the others show a loading skeleton.
  - Partial success is normal: a provider that fails shows a specific reason on its own card (invalid key, no quota, model unavailable, timed out, unreachable) while the other cards keep their results.
  - Before you run, the screen names every provider your CV and JD will be sent to.

- **Bring your own AI keys** (`/ai-credentials`)
  - Add, rename, edit and delete keys for OpenRouter, OpenAI or Google Gemini, with optional chat/embedding model overrides.
  - Test connection pings both chat and embeddings and shows the outcome per credential; the key itself is stored encrypted and only ever shown as its last four characters.
  - With no credential of your own, matching falls back to the system OpenRouter key.

- **Document library** (`/cv`, `/jd`)
  - Saved CVs and job descriptions listed per kind, with previews for PDF, DOCX and pasted text.
  - Rename, download the original file, or delete — deletion is refused when a match still references the document.
  - Mark a document as "a new version of" another one, which is what unlocks version comparison.

- **Home dashboard** (`/`)
  - Counts of saved CVs and JDs, total matches, highest and average score.
  - Recent matches table; clicking a row reopens that full report.

- **CV rewrite assistant** (`/cv-rewrite/$matchResultId`)
  - From a finished match, generate suggested edits that only reword what your CV already says.
  - Each suggestion shows the exact current wording next to the proposed wording; nothing is applied until you tick it. The server rejects any suggestion that does not anchor to a unique verbatim passage of your CV.
  - Save the approved set as a new CV document linked to the original — the original is never overwritten.
  - Gaps that cannot be closed by rewording are listed separately as "these gaps need real experience".

- **Cover letter generator**
  - From a finished match, generate a letter with a chosen tone (formal / friendly), length (short / standard) and letter language (English / Vietnamese, independent of the UI).
  - Edit the text in place, copy it, or download it as `.txt`; every draft is kept so you can compare tones.
  - The letter refuses to claim what your CV does not support, and shows you that list ("this letter does not claim …").

- **CV version comparison** (`/compare/$documentId`)
  - Compare a CV against the version it came from, on one job description you pick, labelled `Version 1 → Version 2`.
  - Signed deltas for overall, semantic and keyword score, plus gaps grouped into closed / still open / new.
  - Opening this screen never runs a match and never sends your CV anywhere; if a version was never matched against that JD, it says so and links to the wizard.
  - Warns when the two matches ran on different AI models, because the scores are then not strictly comparable.

- **Export your data** (`/my-data`)
  - One button downloads a zip containing `data.json` (documents, matches with full reports, AI credential settings) plus every original file you uploaded.
  - Credentials are exported masked — the archive never contains a key.

- **Vietnamese and English documents**
  - The keyword engine is Unicode-aware (accented Vietnamese words are not shredded), strips Vietnamese stopwords and normalizes technical aliases (`React` / `ReactJS` / `React.js`).
  - API messages are available in English and Vietnamese (`?lang=` or `Accept-Language`).

### Not built yet

- **No sign-in.** Auth/SSO is deferred; the whole app runs as one fixed stub user, so every visitor shares the same documents and credentials. Do not deploy it publicly.
- **No match history page.** The API can list and reopen matches, but the client only has the *Recent matches* widget on the dashboard — the "View all" label is inert text. No `/history` route, no filtering or sorting, and no way to delete a match.
- **No UI language switcher.** Vietnamese translations exist for the client but the interface is fixed to English (`VITE_DEFAULT_LOCALE` is not wired up yet).
- **Data sovereignty is only half done.** Export works; deleting all your data and the data-disclosure log (which document went to which provider, when) are not implemented.
- **Keyword scores are not comparable across languages.** Because Vietnamese is tokenized per syllable, any two Vietnamese documents share a noise floor of roughly 30–43%, versus roughly 5% for English. The UI shows both as plain percentages. See `docs/unfinished-features.md` #5.
- **No structured CV/JD parsing.** `Document.parsedContent` is always empty: there is no per-section (skills / experience / education) breakdown and no skill-level overlap — the keyword leg works on tokens.
- **No batch ranking** of many CVs against one JD.

## Tech Stack

- **Server** (`server/`) — Node + TypeScript, NestJS 11, Prisma 6 + PostgreSQL (installed locally, no Docker; pgvector deliberately not used — cosine similarity is computed in-app), `class-validator`, Swagger, `nestjs-i18n`, `pdf-parse` + `mammoth` for document parsing, `archiver` for the data export, AES-256-GCM credential encryption via `node:crypto`, Jest (unit + supertest e2e).
- **Client** (`client/`) — TanStack Start (React 19 + Vite), TanStack Router + Query, Zustand, Ant Design 5 + Tailwind 4, `i18next`, `react-pdf` + `docx-preview` for previews, Vitest (unit) + Playwright (e2e across desktop / tablet / mobile viewports).
- **AI** — the `openai` SDK pointed at any OpenAI-compatible provider: OpenRouter, OpenAI or Google Gemini. A provider must offer both chat completions and embeddings, which is why Anthropic is not on the list.

## Running

You need Node.js, Yarn and a local PostgreSQL.

**1. Server** (from `server/`)

```bash
yarn install
cp .env.example .env          # set DATABASE_URL for your local Postgres
createdb matchcv              # or: psql -c "CREATE DATABASE matchcv"
npx prisma migrate dev        # create the tables
npx prisma db seed            # seed the stub current-user (auth is deferred)
yarn start:dev                # http://localhost:5200 — Swagger at /api/v1/docs
```

Env vars (see `server/.env.example`):

- `DATABASE_URL` — required.
- `PORT` (default `5200`), `CLIENT_ORIGIN` (default `http://localhost:5300`, used for CORS).
- `OPENROUTER_API_KEY` — the system fallback key. Without it, and without a credential of your own, running a match returns 503. `OPENROUTER_BASE_URL` / `OPENROUTER_CHAT_MODEL` / `OPENROUTER_EMBED_MODEL` are optional overrides.
- `CREDENTIAL_ENCRYPTION_KEY` — base64 of exactly 32 bytes (`openssl rand -base64 32`). Required for `/ai-credentials`; missing or wrong length makes those endpoints return 503 while everything else keeps working. Changing or losing it makes stored credentials undecryptable.

Optional dev data: `yarn seed:mock` inserts 3 CV + 3 JD mock documents (Vietnamese and English), `yarn seed:mock:clean` removes them.

**2. Client** (from `client/`)

```bash
yarn install
cp .env.example .env          # VITE_API_BASE_URL, VITE_DEFAULT_LOCALE
yarn dev                      # http://localhost:5300
```

**3. Tests**

```bash
cd server && yarn test        # Jest unit tests
cd server && yarn test:e2e    # Jest + supertest, needs the database
cd client && yarn test        # Vitest unit tests (run serially)
cd client && yarn test:e2e    # Playwright; both servers must be running,
                              # and E2E_DATABASE_URL must be set
```

## Project structure

```
.
├── client/                     TanStack Start web app (port 5300)
│   ├── e2e/                    Playwright specs, one folder per feature
│   └── src/
│       ├── components/         Shared UI pieces (document rows, modals, previews)
│       ├── constants/          API endpoint paths, upload limits
│       ├── hooks/              TanStack Query hooks per domain (match, documents, …)
│       ├── layouts/AppShell/   Sidebar shell every page renders inside
│       ├── locales/            en + vi UI strings
│       ├── requests/           Typed HTTP callers
│       ├── routes/             File-based routes (/, /wizard, /cv, /jd, …)
│       ├── stores/             Zustand slices (wizard state, UI state)
│       ├── types/              Shared DTO types
│       └── views/              One folder per screen (Wizard, CvRewrite, CvComparison, …)
├── server/                     NestJS REST API (port 5200)
│   ├── prisma/                 schema.prisma, migrations, stub-user seed
│   ├── scripts/                seed-mock, recompute-keyword-scores
│   ├── src/
│   │   ├── common/crypto/      AES-256-GCM credential encryption
│   │   ├── common/current-user/ Stub current user (auth deferred)
│   │   ├── config/             Env validation
│   │   ├── i18n/               en + vi API messages
│   │   ├── modules/ai/         OpenAI-compatible provider client + whitelist
│   │   ├── modules/ai-credentials/  BYO key CRUD + connection test
│   │   ├── modules/comparison/ Version comparison + gap diffing
│   │   ├── modules/cover-letters/   Cover letter generation and drafts
│   │   ├── modules/cv-rewrite/ Anchored rewrite proposals + grounding checks
│   │   ├── modules/documents/  Upload, parse, store, preview, lineage
│   │   ├── modules/matching/   Hybrid scoring engine + tokenizer
│   │   └── modules/me/         Data export (zip stream)
│   └── test/                   Jest + supertest e2e specs
├── docs/                       Shared project docs (source of truth for scope)
│   ├── project-goals.md        Goals, non-goals, ADRs, roadmap
│   ├── erd.md                  Data model, kept in sync with schema.prisma
│   ├── unfinished-features.md  Known half-done work, honestly tracked
│   ├── specs/                  Per-feature design / plan / e2e / security notes
│   └── ui-designs/             Static HTML mockups per feature
└── .husky/pre-commit           Runs lint-staged in client/ then server/
```
