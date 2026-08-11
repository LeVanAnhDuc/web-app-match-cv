# Seed Mock CV/JD Documents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two yarn commands in `server/` — one inserts a fixed set of 6 mock CV/JD documents, one removes them along with any match produced from them.

**Architecture:** A pure data file (`scripts/mock-documents.ts`) holding the 6 fixtures and their constant UUIDs, plus a runner (`scripts/seed-mock.ts`) that owns every DB interaction and branches on a `--clean` flag. No schema change, no new endpoint, nothing under `server/src/**`.

**Tech Stack:** TypeScript, `ts-node` (CommonJS override), `@prisma/client` 6.19.3, PostgreSQL.

## Global Constraints

- Read `server/.claude/CLAUDE.md` before touching anything in `server/`.
- Relative imports only — this project has **no** `@/` path alias (`server/.claude/rules/imports.md`).
- Magic values become named `UPPER_SNAKE_CASE` constants (`server/.claude/rules/constants.md`).
- `STUB_USER_ID` is imported from `../src/common/current-user/current-user.service` — **never** from `../prisma/seed`, which calls `main()` at top level and would run the seed as an import side effect.
- Mock CV ids are `10000000-0000-4000-8000-00000000000N`, mock JD ids are `20000000-0000-4000-8000-00000000000N`, for `N` = 1, 2, 3.
- Every delete query keys on the constant id **dial** (the fixed 24-char UUID prefix), not on the current fixture id list — renumbering a fixture must not strand the row already in the DB. No `deleteMany` may filter by `userId`, `isSaved`, or `title`.
- Mock ids MUST be valid **UUIDv4** (version nibble `4`, variant nibble `8`). `Document.id` is TEXT so a malformed id seeds fine, then every write endpoint 400s on `@IsUUID()`. Verify by passing an id through the real DTO, not just by writing it to the DB.
- These are dev-only scripts, not part of `src/` — no NestJS DI, no `HttpException`, no i18n. Plain `console.log` and `process.exit(1)` are correct here (matching `scripts/recompute-keyword-scores.ts`).
- No unit spec: `jest` has `rootDir: src`, so a spec under `scripts/` would never run. Verification is by real DB run (Task 5).

## File Structure

| File | Responsibility |
| --- | --- |
| `server/scripts/mock-documents.ts` (create) | The 6 fixtures + id constants + a fixture-integrity guard. Imports only `DocumentKind`/`SourceFormat` from `@prisma/client`. No DB access, no side effects. |
| `server/scripts/seed-mock.ts` (create) | All Prisma interaction: the insert path, the clean path, flag parsing, console output. Contains no document prose. |
| `server/package.json` (modify) | Two new entries in `scripts`. |
| `server/.claude/CLAUDE.md` (modify) | Two new rows in the Commands block. |

---

### Task 1: Fixture data file

**Files:**
- Create: `server/scripts/mock-documents.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type MockDocument = { id: string; kind: DocumentKind; language: "vi" | "en"; label: string; title: string; rawText: string }`
  - `const MOCK_DOCUMENTS: readonly MockDocument[]` — length 6
  - `const MOCK_DOCUMENT_IDS: readonly string[]` — the 6 ids, derived from `MOCK_DOCUMENTS`
  - `function assertFixturesValid(): void` — throws on duplicate id, empty `rawText`, or an id whose prefix contradicts its `kind`

**Normative content.** Prose wording is free, but the **keyword sets below are normative** — they are what produces the score shape in design §4. Every listed term must appear in the document's `rawText`; a term listed for a low-scoring pair must **not** be padded into the others.

| Label | id | kind | lang | Required terms in `rawText` |
| --- | --- | --- | --- | --- |
| CV-01 | `10000000-0000-4000-8000-000000000001` | `CV` | vi | NestJS, Node.js, TypeScript, PostgreSQL, Prisma, REST API, Docker, Redis, CI/CD, unit test, microservice |
| CV-02 | `10000000-0000-4000-8000-000000000002` | `CV` | en | NestJS, Node.js, TypeScript, PostgreSQL, Prisma, REST API, Docker, Redis, CI/CD, unit test, microservice |
| CV-03 | `10000000-0000-4000-8000-000000000003` | `CV` | vi | React, TypeScript, Tailwind CSS, Figma, responsive, accessibility, Vite, Zustand, Storybook |
| JD-01 | `20000000-0000-4000-8000-000000000001` | `JD` | vi | NestJS, Node.js, TypeScript, PostgreSQL, Prisma, REST API, Docker, Redis, CI/CD, microservice, unit test |
| JD-02 | `20000000-0000-4000-8000-000000000002` | `JD` | en | NestJS, Node.js, TypeScript, PostgreSQL, Prisma, REST API, Docker, Redis, CI/CD, microservice, unit test |
| JD-03 | `20000000-0000-4000-8000-000000000003` | `JD` | vi | Python, Spark, Airflow, ETL, data warehouse, BigQuery, dbt, Kafka, SQL |

CV-01 and CV-02 must describe **the same person and the same experience** — one in Vietnamese, one in English. That equivalence is the whole point of the pair (design §4, regression guard for the shipped Goal 8 tokenizer). Vietnamese fixtures must be written **with proper diacritics** — `kinh nghiệm`, `phát triển`, `hệ thống` — since exercising the diacritic-folding path is why they exist.

Each `rawText` is 250–400 words, plain text with `\n` line breaks, shaped like a real document (heading, then sections). No markdown syntax.

- [ ] **Step 1: Create the file with the type, the id constants, and the guard**

```ts
// Fixture data for `yarn seed:mock` — see docs/specs/seed-mock-documents/design.md.
//
// Pure data on purpose: this file never touches the database, so adding or
// editing a mock document means reading exactly one file and knowing nothing
// about Prisma. All DB interaction lives in seed-mock.ts.

import { DocumentKind } from "@prisma/client";

// Mock rows are recognised by a constant id, NOT by a column or a title
// prefix. Every delete in seed-mock.ts keys on this list, which is what makes
// the clean command incapable of touching a real document — mock and real data
// currently share the same owner (STUB_USER_ID, auth deferred).
// The dial extends STUB_USER_ID's 00000000-… convention.
export const CV_ID_DIAL = "10000000-0000-4000-8000-";
export const JD_ID_DIAL = "20000000-0000-4000-8000-";

export type MockDocument = {
  id: string;
  kind: DocumentKind;
  /** Language the document is WRITTEN in — drives nothing but the summary output. */
  language: "vi" | "en";
  /** Short handle used in console output and in the design doc's score matrix. */
  label: string;
  title: string;
  rawText: string;
};
```

- [ ] **Step 2: Add the 6 fixtures**

Append `export const MOCK_DOCUMENTS: readonly MockDocument[] = [ ... ]` with the 6 entries from the table above. Ids are built as `` `${CV_ID_PREFIX}1` `` etc. so the prefix constant is the single source of truth. Use template literals for `rawText`.

- [ ] **Step 3: Add the derived id list and the guard**

```ts
export const MOCK_DOCUMENT_IDS: readonly string[] = MOCK_DOCUMENTS.map(
  (doc) => doc.id
);

/**
 * Guards the three mistakes a hand-maintained fixture list invites, each of
 * which fails SILENTLY rather than loudly:
 *
 * - a duplicate id makes `seed:mock` upsert the same row twice and report 6
 *   documents when the database holds 5;
 * - an empty rawText seeds a document that scores 0 against everything, which
 *   reads as an engine bug rather than as bad fixture data;
 * - an id on the wrong dial (a CV numbered 2000…) survives seeding but is then
 *   invisible to a kind-filtered clean, so it outlives the command meant to
 *   remove it.
 */
export function assertFixturesValid(): void {
  const seen = new Set<string>();
  for (const doc of MOCK_DOCUMENTS) {
    if (seen.has(doc.id)) {
      throw new Error(`Duplicate mock document id: ${doc.id}`);
    }
    seen.add(doc.id);

    if (doc.rawText.trim().length === 0) {
      throw new Error(`Mock document ${doc.label} has empty rawText.`);
    }

    const expectedPrefix =
      doc.kind === DocumentKind.CV ? CV_ID_PREFIX : JD_ID_PREFIX;
    if (!doc.id.startsWith(expectedPrefix)) {
      throw new Error(
        `Mock document ${doc.label} is a ${doc.kind} but its id is not on the ${doc.kind} dial: ${doc.id}`
      );
    }
  }
}
```

- [ ] **Step 3a: Prove the guard actually fires**

Temporarily duplicate one fixture's id, then run:

```bash
cd server
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" -e "require('./scripts/mock-documents').assertFixturesValid()"
```

Expected: throws `Duplicate mock document id: 10000000-…`. Then revert the duplicate and re-run — expected: exits silently. A guard never seen failing is not known to work.

- [ ] **Step 4: Type-check**

Run: `cd server && yarn type-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd server
git add scripts/mock-documents.ts
git commit -m "chore(scripts): add mock CV/JD fixture data"
```

---

### Task 2: Runner — insert path

**Files:**
- Create: `server/scripts/seed-mock.ts`
- Modify: `server/package.json` (`scripts` block)

**Interfaces:**
- Consumes: `MOCK_DOCUMENTS`, `MOCK_DOCUMENT_IDS`, `assertFixturesValid` from `./mock-documents`; `STUB_USER_ID` from `../src/common/current-user/current-user.service`.
- Produces: `scripts/seed-mock.ts` as a runnable entry point; `yarn seed:mock`.

- [ ] **Step 1: Write the runner skeleton and the insert path**

```ts
import { PrismaClient, Role, SourceFormat } from "@prisma/client";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import {
  MOCK_DOCUMENTS,
  MOCK_DOCUMENT_IDS,
  assertFixturesValid
} from "./mock-documents";

// Deleting is the destructive branch, so it is the one that must be asked for
// explicitly. Bare `yarn seed:mock` inserts.
const CLEAN = process.argv.includes("--clean");

const prisma = new PrismaClient();

async function insert(): Promise<void> {
  // The stub user owns every mock document, and a freshly reset database has
  // no rows at all — so upsert it here rather than assuming `prisma db seed`
  // was run first. Same id/role as prisma/seed.ts, so the two agree.
  await prisma.user.upsert({
    where: { id: STUB_USER_ID },
    update: {},
    create: { id: STUB_USER_ID, role: Role.candidate }
  });

  for (const doc of MOCK_DOCUMENTS) {
    const data = {
      userId: STUB_USER_ID,
      kind: doc.kind,
      title: doc.title,
      sourceFormat: SourceFormat.text,
      rawText: doc.rawText,
      isSaved: true,
      // Explicit nulls, not omissions: this is the RESET half of the command.
      // Leaving them out would let a previous run's values survive.
      fileData: null,
      fileMime: null,
      parsedContent: null,
      parentId: null
    };

    // Full `update`, not `update: {}`: re-running is meant to restore a mock
    // to its pristine state even after it was renamed or edited through the
    // UI. That would be wrong for real data; for mock data it is the point.
    await prisma.document.upsert({
      where: { id: doc.id },
      update: data,
      create: { id: doc.id, ...data }
    });

    console.log(
      `  ${doc.label}  ${doc.kind}  ${doc.language}  ${doc.rawText.length} chars  ${doc.title}`
    );
  }

  console.log(`\n${MOCK_DOCUMENTS.length} mock documents seeded.`);
  console.log("Remove them with: yarn seed:mock:clean");
}
```

- [ ] **Step 2: Add the entry point**

```ts
async function main(): Promise<void> {
  assertFixturesValid();
  if (CLEAN) {
    await clean();
  } else {
    await insert();
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

`clean()` does not exist yet — Task 3 adds it. Write it as a stub that throws `new Error("not implemented")` so this task type-checks on its own, and replace the body in Task 3.

- [ ] **Step 3: Add the npm scripts**

In `server/package.json`, after the existing `recompute-scores` entry, matching its exact escaping:

```jsonc
"seed:mock": "ts-node --compiler-options \"{\\\"module\\\":\\\"CommonJS\\\"}\" scripts/seed-mock.ts",
"seed:mock:clean": "ts-node --compiler-options \"{\\\"module\\\":\\\"CommonJS\\\"}\" scripts/seed-mock.ts --clean",
```

- [ ] **Step 4: Run the insert and confirm 6 rows**

```bash
cd server
yarn seed:mock
```

Expected: 6 summary lines (CV-01…JD-03), then `6 mock documents seeded.`

- [ ] **Step 5: Confirm idempotency**

```bash
cd server
yarn seed:mock
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.document.count({where:{id:{in:require('./scripts/mock-documents').MOCK_DOCUMENT_IDS}}}).then(n=>{console.log('mock docs =',n);return p.\$disconnect();});"
```

Expected: `mock docs = 6` — not 12. A second run must not duplicate.

- [ ] **Step 6: Commit**

```bash
cd server
git add scripts/seed-mock.ts package.json
git commit -m "feat(scripts): add yarn seed:mock to insert mock CV/JD documents"
```

---

### Task 3: Runner — clean path

**Files:**
- Modify: `server/scripts/seed-mock.ts` (replace the `clean()` stub)

**Interfaces:**
- Consumes: `MOCK_DOCUMENT_IDS` from `./mock-documents`.
- Produces: `yarn seed:mock:clean`.

- [ ] **Step 1: Replace the stub with the real clean path**

```ts
async function clean(): Promise<void> {
  const mockIds = [...MOCK_DOCUMENT_IDS];
  // Reused verbatim by both match tables: a row is mock-derived if EITHER side
  // of the pair is a mock document.
  const referencesMock = {
    OR: [
      { cvDocumentId: { in: mockIds } },
      { jdDocumentId: { in: mockIds } }
    ]
  };

  // One transaction: a failure partway through must not leave the database
  // with the matches gone but the documents still present, or vice versa.
  //
  // Order is forced by the schema. MatchResult and MatchRun both point at
  // Document through a REQUIRED relation with no onDelete, which Postgres
  // defaults to RESTRICT — so deleting the documents first is refused outright
  // once a mock has ever been matched. CoverLetter needs no step of its own:
  // it cascades from MatchResult (onDelete: Cascade).
  const [matchResults, matchRuns, documents] = await prisma.$transaction([
    prisma.matchResult.deleteMany({ where: referencesMock }),
    prisma.matchRun.deleteMany({ where: referencesMock }),
    prisma.document.deleteMany({ where: { id: { in: mockIds } } })
  ]);

  console.log(`  match results removed : ${matchResults.count}`);
  console.log(`  match runs removed    : ${matchRuns.count}`);
  console.log(`  documents removed     : ${documents.count}`);
  // STUB_USER_ID is deliberately left alone: it is required seed data that
  // CurrentUserService resolves to, not mock data. Deleting it breaks the app.
  console.log("\nMock data removed. Seed it again with: yarn seed:mock");
}
```

- [ ] **Step 2: Verify clean removes exactly the mock documents**

With mock seeded from Task 2, and a real document present as a control:

```bash
cd server
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.document.create({data:{userId:'00000000-0000-0000-0000-000000000001',kind:'CV',title:'REAL control doc',sourceFormat:'text',rawText:'control',isSaved:true}}).then(d=>{console.log('control id',d.id);return p.\$disconnect();});"
yarn seed:mock:clean
```

Expected: `documents removed : 6`, and the control document still exists (verify with a `document.count` on its id). Delete the control document afterwards.

- [ ] **Step 3: Verify clean succeeds when a mock has been matched**

This is the case that fails without the RESTRICT ordering. Seed mock, insert a `MatchResult` row referencing CV-01 and JD-01 directly via Prisma (no AI call needed), then run clean.

```bash
cd server
yarn seed:mock
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.matchResult.create({data:{userId:'00000000-0000-0000-0000-000000000001',cvDocumentId:'10000000-0000-4000-8000-000000000001',jdDocumentId:'20000000-0000-4000-8000-000000000001',overallScore:80,semanticScore:80,keywordScore:80,report:{},provider:'openrouter',chatModel:'x',embedModel:'y'}}).then(r=>{console.log('match id',r.id);return p.\$disconnect();});"
yarn seed:mock:clean
```

Expected: `match results removed : 1`, `documents removed : 6`, exit code 0 — **not** a foreign key error.

- [ ] **Step 4: Commit**

```bash
cd server
git add scripts/seed-mock.ts
git commit -m "feat(scripts): add yarn seed:mock:clean to remove mock documents"
```

---

### Task 4: Document the commands

**Files:**
- Modify: `server/.claude/CLAUDE.md` (Commands block)
- Check: `server/README.md` — if it lists yarn commands, add the two there too; if it has no command list, leave it alone.

- [ ] **Step 1: Add the two rows to the Commands block**

After the `yarn recompute-scores` lines in `server/.claude/CLAUDE.md`:

```bash
yarn seed:mock                         # chèn/làm mới 6 mock document CV+JD (VI+EN) — dev only
yarn seed:mock:clean                   # xoá mock document + match sinh ra từ chúng
```

- [ ] **Step 2: Commit**

```bash
cd server
git add .claude/CLAUDE.md README.md
git commit -m "docs(server): document seed:mock commands"
```

---

### Task 5: Full verification run (design §7)

**Files:** none — this task only runs things.

- [ ] **Step 1: Baseline counts**

```bash
cd server
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.document.count(),p.matchResult.count(),p.matchRun.count(),p.user.count()]).then(([d,mr,run,u])=>{console.log({documents:d,matchResults:mr,matchRuns:run,users:u});return p.\$disconnect();});"
```

Record the four numbers.

- [ ] **Step 2: Seed, then confirm content**

Run `yarn seed:mock`, then read the 6 rows back and assert: `kind` matches the dial, `isSaved === true`, `sourceFormat === 'text'`, `fileData === null`, `rawText.length` between 1000 and 4000 characters (250–400 words).

- [ ] **Step 3: Confirm the refresh branch**

Rename CV-01 in the database, run `yarn seed:mock` again, read the title back. Expected: back to the fixture title.

```bash
cd server
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.document.update({where:{id:'10000000-0000-4000-8000-000000000001'},data:{title:'RENAMED BY HAND'}}).then(()=>p.\$disconnect());"
yarn seed:mock
```

- [ ] **Step 4: Clean, then confirm return to baseline**

Run `yarn seed:mock:clean`, re-run the Step 1 count. Expected: `documents`, `matchResults`, `matchRuns` back to the Step 1 values, `users` unchanged, and `STUB_USER_ID` still present.

- [ ] **Step 5: Green checks gate**

```bash
cd server
yarn format && yarn lint && yarn type-check && yarn test && yarn build
```

All must pass. `yarn test:e2e` is **not** required: this change adds no runtime dependency and does not touch `AppModule`'s module graph (the trigger stated in `server/.claude/CLAUDE.md`).

- [ ] **Step 6: Commit any formatting the gate applied**

```bash
cd server
git add -A scripts package.json .claude
git commit -m "chore(scripts): apply formatter to seed-mock scripts"
```

(Skip if `git status` is clean.)

---

## Self-Review

**Spec coverage:**

| design.md | Task |
| --- | --- |
| §3 constant-id identification | Task 1 (prefix constants + guard) |
| §4 six fixtures, normative keyword sets, VI diacritics, VI/EN equivalence | Task 1 |
| §5 two files, data/runner split, `STUB_USER_ID` import source | Tasks 1–2 |
| §6 insert: stub user upsert, full `update`, summary output | Task 2 |
| §6 clean: FK order, single transaction, per-step counts, stub user spared | Task 3 |
| §6 two npm scripts with exact escaping | Task 2 Step 3 |
| §7 verification 1–6 | Task 5 |
| §2 in-scope: CLAUDE.md Commands note | Task 4 |

No spec requirement is unassigned.

**Placeholder scan:** The `clean()` stub in Task 2 Step 2 is an intentional, named, single-task placeholder replaced in Task 3 Step 1 — not an unresolved TODO. Fixture prose is specified by normative keyword table rather than transcribed in full; the score shape depends on the keyword sets, which are given exactly.

**Type consistency:** `MockDocument` fields (`id`, `kind`, `language`, `label`, `title`, `rawText`) are used identically in Task 1 and in Task 2's summary line. `MOCK_DOCUMENT_IDS` is `readonly string[]` and is spread into a mutable `mockIds` before reaching Prisma's `in`, which does not accept a readonly array. `assertFixturesValid()` returns `void` and throws; Task 2 calls it bare inside `main()`.
