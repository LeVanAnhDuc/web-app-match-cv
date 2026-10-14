import { randomUUID } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import type { CoverLetterDto } from "#/types/CoverLetters";
import type { MatchResultDto } from "#/types/Matching";
import { createApiClient, type ApiClient } from "@/api";
import { createHttp } from "@/api/http.client";
import { getUrls } from "@/config/urls";
import {
  SAMPLE_CV,
  SAMPLE_JD,
  SAMPLE_REPORT,
  SAMPLE_SCORES,
  LETTER_BODY,
  type LetterErrorCode,
} from "@/data/test-data/cover-letter-generator";
import { CoverLetterPage } from "@/pages/cover-letter-generator/cover-letter.page";
import { readE2eUserId } from "@/utils/auth-state";
import { insertAiCredential, insertCoverLetter, insertDocument, insertMatchResult, insertMatchRun, sql, type MatchReport } from "@/utils/db";
import { createGuestUser, createSignedInUser, createUser, deleteUsers, type SeededUser } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "cover-letter-generator" (src/docs/requirements/cover-letter-generator.md).
//   coverLetterPage        CoverLetterPage (wizard step 4 + CoverLetterModal)
//   coverLetterDb          (worker) seeding through the dev DB: users, CV/JD + run + match, letters, credential rows,
//                          read-backs. Everything it creates is removed at worker teardown.
//   coverLetterSeed        (test) the same, for the SIGNED-IN E2E USER the UI specs run as, removed after each test
//   coverLetterAi          (test) D1 stub of POST /cover-letters (the only AI call of the module) on the test's page.
//                          The stub WRITES the row the server would have written, so GET / PATCH / DELETE stay real.
//   coverLetterRawApi      (worker) anonymous client whose throttler 429 is RETURNED instead of waited out (the shared
//                          http client retries a 429 with Retry-After, which would hide the limit under test)

export interface SeededMatch {
  userId: string;
  cvId: string;
  jdId: string;
  runId: string;
  matchId: string;
}

export interface MatchSeedOptions {
  status?: "succeeded" | "failed";
  errorCode?: string | null;
  report?: MatchReport;
  credentialId?: string | null;
  scores?: [number, number, number];
}

export interface LetterSeedOptions {
  tone?: "formal" | "friendly";
  length?: "short" | "standard";
  language?: "en" | "vi";
  content?: string;
  omittedRequirements?: string[];
  status?: "succeeded" | "failed";
  errorCode?: LetterErrorCode | null;
  edited?: boolean;
  credentialId?: string | null;
  /** Older letters first: pass increasing offsets to control the newest-first order. */
  createdAt?: Date | string;
}

export interface LetterRow {
  id: string;
  userId: string;
  matchResultId: string;
  content: string;
  edited: boolean;
  status: string;
  credentialId: string | null;
  tone: string;
  length: string;
  language: string;
}

export interface CoverLetterDb {
  signedInUser(): Promise<SeededUser>;
  guestUser(): Promise<SeededUser>;
  /** A user with no session: "someone else". */
  otherUser(): Promise<string>;
  /** CV + JD documents, a run and one match result in it, all owned by `userId`. */
  match(userId: string, options?: MatchSeedOptions): Promise<SeededMatch>;
  letter(userId: string, matchResultId: string, options?: LetterSeedOptions): Promise<string>;
  /** A credential row with dummy ciphertext (enough for ownership checks; never decrypts). */
  credentialRow(userId: string, label?: string): Promise<string>;
  findLetter(id: string): Promise<LetterRow | null>;
  letterDto(id: string): Promise<CoverLetterDto>;
  countLetters(userId: string): Promise<number>;
  /** Remove a match result row (there is no endpoint for it): its letters must cascade. */
  deleteMatchResult(matchId: string): Promise<void>;
  /** Drop what was seeded for these matches (letters cascade with their match). */
  cleanMatches(matches: SeededMatch[]): Promise<void>;
}

async function letterDto(id: string): Promise<CoverLetterDto> {
  const [row] = await sql(
    `SELECT id, "matchResultId", tone, length, language, content, "omittedRequirements", status, "errorCode", edited,
            "credentialId", provider, "chatModel",
            to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
            to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
       FROM "CoverLetter" WHERE id = $1`,
    [id]
  );
  if (!row) throw new Error(`cover-letter fixture: letter ${id} not found`);
  // timestamp(3) columns hold UTC without a zone (formatted in SQL: node-pg would read them as local time).
  return row as unknown as CoverLetterDto;
}

function createDb(track: { users: string[]; matches: SeededMatch[]; credentials: string[] }): CoverLetterDb {
  const db: CoverLetterDb = {
    async signedInUser() {
      const user = await createSignedInUser();
      track.users.push(user.userId);
      return user;
    },
    async guestUser() {
      const user = await createGuestUser();
      track.users.push(user.userId);
      return user;
    },
    async otherUser() {
      const id = await createUser();
      track.users.push(id);
      return id;
    },
    async match(userId, options = {}) {
      const cvId = await insertDocument({ userId, kind: "CV", title: `CL CV ${randomUUID().slice(0, 6)}`, rawText: SAMPLE_CV });
      const jdId = await insertDocument({ userId, kind: "JD", title: `CL JD ${randomUUID().slice(0, 6)}`, rawText: SAMPLE_JD });
      const runId = await insertMatchRun({ userId, cvDocumentId: cvId, jdDocumentId: jdId });
      const failed = options.status === "failed";
      const matchId = await insertMatchResult({
        userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        runId,
        status: options.status ?? "succeeded",
        errorCode: failed ? (options.errorCode ?? "no_quota") : null,
        scores: failed ? [0, 0, 0] : (options.scores ?? SAMPLE_SCORES),
        report: failed ? { strengths: [], gaps: [], suggestions: [] } : (options.report ?? SAMPLE_REPORT),
        credentialId: options.credentialId ?? null,
      });
      const seeded = { userId, cvId, jdId, runId, matchId };
      track.matches.push(seeded);
      return seeded;
    },
    async letter(userId, matchResultId, options = {}) {
      const failed = options.status === "failed";
      const id = await insertCoverLetter({
        userId,
        matchResultId,
        tone: options.tone,
        length: options.length,
        language: options.language,
        content: options.content ?? (failed ? "" : LETTER_BODY),
        omittedRequirements: options.omittedRequirements ?? [],
        status: options.status ?? "succeeded",
        errorCode: failed ? (options.errorCode ?? "no_quota") : null,
        createdAt: options.createdAt,
      });
      if (options.edited || options.credentialId) {
        await sql(`UPDATE "CoverLetter" SET edited = $2, "credentialId" = $3 WHERE id = $1`, [
          id,
          options.edited ?? false,
          options.credentialId ?? null,
        ]);
      }
      return id;
    },
    async credentialRow(userId, label = `cl-${randomUUID().slice(0, 8)}`) {
      const id = await insertAiCredential({
        userId,
        provider: "openrouter",
        label,
        encryptedKey: Buffer.from("x"),
        keyIv: Buffer.from("x"),
        keyTag: Buffer.from("x"),
        keyLast4: "1234",
      });
      track.credentials.push(id);
      return id;
    },
    async findLetter(id) {
      const [row] = await sql(
        `SELECT id, "userId", "matchResultId", content, edited, status, "credentialId", tone, length, language
           FROM "CoverLetter" WHERE id = $1`,
        [id]
      );
      return (row as unknown as LetterRow) ?? null;
    },
    letterDto,
    async countLetters(userId) {
      const [row] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "CoverLetter" WHERE "userId" = $1`, [userId]);
      return row.n;
    },
    async deleteMatchResult(matchId) {
      await sql(`DELETE FROM "MatchResult" WHERE id = $1`, [matchId]);
    },
    async cleanMatches(matches) {
      const docs = matches.flatMap((m) => [m.cvId, m.jdId]);
      if (!docs.length) return;
      // FK order: letters cascade with results; results and runs (incl. runs a UI test created) block documents.
      await sql(`DELETE FROM "MatchResult" WHERE "cvDocumentId" = ANY($1::text[])`, [docs]);
      await sql(`DELETE FROM "MatchRun" WHERE "cvDocumentId" = ANY($1::text[])`, [docs]);
      await sql(`DELETE FROM "Document" WHERE id = ANY($1::text[])`, [docs]);
    },
  };
  return db;
}

async function dispose(db: CoverLetterDb, track: { users: string[]; matches: SeededMatch[]; credentials: string[] }) {
  await db.cleanMatches(track.matches.splice(0)).catch(() => undefined);
  const credentials = track.credentials.splice(0);
  if (credentials.length)
    await sql(`DELETE FROM "AiCredential" WHERE id = ANY($1::text[])`, [credentials]).catch(() => undefined);
  await deleteUsers(track.users.splice(0)).catch(() => undefined);
}

// ── E2E user seed (UI specs) ───────────────────────────────────────────────
export interface CoverLetterSeed {
  /** Id of the seeded e2e user the browser is signed in as. */
  userId(): string;
  match(options?: MatchSeedOptions): Promise<SeededMatch>;
  letter(match: SeededMatch, options?: LetterSeedOptions): Promise<string>;
  /** Letters seeded one second apart, oldest first, so the list order is the reverse of `options`. */
  letters(match: SeededMatch, options: LetterSeedOptions[]): Promise<string[]>;
  /** A credential row owned by the e2e user (dummy ciphertext, last4 "1234"). */
  credentialRow(label?: string): Promise<string>;
  /** A guest with a run of its own, and the cookie to browse as that guest. */
  guestWithMatch(): Promise<{ guest: SeededUser; match: SeededMatch }>;
  /** Stored row of a letter, to check what a UI action persisted. */
  findLetter(id: string): Promise<LetterRow | null>;
  /** A MatchResultDto shaped like the seeded match: the body of a stubbed POST /match. */
  matchResultBody(match: SeededMatch): MatchResultDto;
}

// ── AI stub (D1) ───────────────────────────────────────────────────────────
export interface GenerateStubOptions {
  /** Letter body of a succeeded generation (default LETTER_BODY). */
  content?: string;
  omittedRequirements?: string[];
  /** Store a failed row with this code instead (what the server does when the provider fails). */
  failWith?: LetterErrorCode;
  /** Answer with this HTTP status and write nothing (e.g. 503 when the system key is missing). */
  httpStatus?: number;
  /** Hold the response back to observe the pending state. */
  delayMs?: number;
}

export interface GenerateRequest {
  matchResultId: string;
  tone: string;
  length: string;
  language: string;
  credentialId?: string;
  [key: string]: unknown;
}

export interface CoverLetterAi {
  /** Answer every POST /cover-letters on this page as the server would, without calling a provider. */
  stubGenerate(options?: GenerateStubOptions): Promise<void>;
  /** Bodies of the POST /cover-letters the page sent (stubbed), in order. */
  requests: GenerateRequest[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function installGenerateStub(
  page: Page,
  userId: string,
  requests: GenerateRequest[],
  options: GenerateStubOptions
): Promise<void> {
  await page.route("**/api/v1/cover-letters", async (route: Route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    const body = request.postDataJSON() as GenerateRequest;
    requests.push(body);
    if (options.delayMs) await sleep(options.delayMs);
    if (options.httpStatus) {
      return route.fulfill({
        status: options.httpStatus,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: options.httpStatus, message: `Stubbed ${options.httpStatus}` }),
      });
    }
    const failed = Boolean(options.failWith);
    const id = await insertCoverLetter({
      userId,
      matchResultId: body.matchResultId,
      tone: body.tone as "formal" | "friendly",
      length: body.length as "short" | "standard",
      language: body.language as "en" | "vi",
      content: failed ? "" : (options.content ?? LETTER_BODY),
      omittedRequirements: failed ? [] : (options.omittedRequirements ?? []),
      status: failed ? "failed" : "succeeded",
      errorCode: options.failWith ?? null,
    });
    if (body.credentialId) {
      await sql(`UPDATE "CoverLetter" SET "credentialId" = $2 WHERE id = $1`, [id, body.credentialId]);
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(await letterDto(id)) });
  });
}

export const test = shared.extend<
  {
    coverLetterPage: CoverLetterPage;
    coverLetterSeed: CoverLetterSeed;
    coverLetterAi: CoverLetterAi;
  },
  { coverLetterDb: CoverLetterDb; coverLetterRawApi: ApiClient }
>({
  coverLetterDb: [
    async ({}, use) => {
      const track = { users: [] as string[], matches: [] as SeededMatch[], credentials: [] as string[] };
      const db = createDb(track);
      await use(db);
      await dispose(db, track);
    },
    { scope: "worker" },
  ],

  coverLetterRawApi: [
    async ({ playwright, env }, use) => {
      const factory = createHttp(playwright.request, getUrls(env).apiUrl, () => {
        // Abort the shared client's "wait out Retry-After" loop: the 429 itself is what the spec asserts.
        throw new ThrottledError();
      });
      await use(createApiClient(factory));
    },
    { scope: "worker" },
  ],

  coverLetterPage: async ({ page }, use) => use(new CoverLetterPage(page)),

  coverLetterSeed: async ({}, use) => {
    const track = { users: [] as string[], matches: [] as SeededMatch[], credentials: [] as string[] };
    const db = createDb(track);
    const userId = readE2eUserId();
    const seed: CoverLetterSeed = {
      userId: () => userId,
      match: (options) => db.match(userId, options),
      letter: (match, options) => db.letter(match.userId, match.matchId, options),
      async letters(match, list) {
        const base = Date.now() - list.length * 1000 - 5000;
        const ids: string[] = [];
        for (const [index, options] of list.entries()) {
          ids.push(await db.letter(match.userId, match.matchId, { createdAt: new Date(base + index * 1000), ...options }));
        }
        return ids;
      },
      credentialRow: (label) => db.credentialRow(userId, label),
      async guestWithMatch() {
        const guest = await db.guestUser();
        return { guest, match: await db.match(guest.userId) };
      },
      findLetter: (id) => db.findLetter(id),
      matchResultBody: (match) => ({
        id: randomUUID(),
        cvDocumentId: match.cvId,
        jdDocumentId: match.jdId,
        overallScore: SAMPLE_SCORES[0],
        semanticScore: SAMPLE_SCORES[1],
        keywordScore: SAMPLE_SCORES[2],
        report: SAMPLE_REPORT,
        credentialId: null,
        provider: "openrouter",
        chatModel: "openai/gpt-4o-mini",
        embedModel: "openai/text-embedding-3-small",
        runId: match.runId,
        status: "succeeded",
        errorCode: null,
        createdAt: new Date().toISOString(),
      }),
    };
    await use(seed);
    await dispose(db, track);
  },

  coverLetterAi: async ({ page }, use) => {
    const requests: GenerateRequest[] = [];
    const userId = readE2eUserId();
    await use({
      requests,
      stubGenerate: (options = {}) => installGenerateStub(page, userId, requests, options),
    });
  },
});

/** Thrown by coverLetterRawApi when the server answers a throttler 429 (Retry-After present). */
export class ThrottledError extends Error {
  constructor() {
    super("throttled: 429 with Retry-After");
    this.name = "ThrottledError";
  }
}
