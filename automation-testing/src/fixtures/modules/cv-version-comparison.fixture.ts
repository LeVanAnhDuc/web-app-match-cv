import type { BrowserContext } from "@playwright/test";
import type { ApiClient } from "@/api";
import { BASE_SCORES, HAPPY_GAPS, MODELS, REVISION_SCORES } from "@/data/test-data/cv-version-comparison";
import { uniqueSuffix } from "@/data/test-data/shared";
import { VersionComparePage } from "@/pages/cv-version-comparison/version-compare.page";
import { VersionLibraryPage } from "@/pages/cv-version-comparison/version-library.page";
import { VersionWizardPage } from "@/pages/cv-version-comparison/version-wizard.page";
import { findDocument, insertDocument, insertMatchResult, insertMatchRun } from "@/utils/db";
import { createGuestUser, createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "cv-version-comparison".
//
// Decision Q1 = (a): comparisons are read from stored MatchResult rows and never call a provider, so every spec of this
// module — API and UI — runs LIVE against rows seeded straight into the dev DB. Each test gets its own throwaway
// signed-in user (`cvcSeed`), so the libraries it looks at hold only that test's documents; the user (and, by cascade,
// its sessions, documents, runs and matches) is deleted afterwards. UI page fixtures sign the browser in as that user.

export interface MatchSeed {
  scores?: [overall: number, semantic: number, keyword: number];
  gaps?: string[];
  status?: "succeeded" | "failed";
  chatModel?: string;
  embedModel?: string;
  /** ISO time; default: a module clock that moves forward one minute per seeded match. */
  at?: string;
  runId?: string;
  /** userId owning the row; default: the seeded user. */
  owner?: string;
}

export interface DocSeed {
  title?: string;
  parentId?: string | null;
  saved?: boolean;
  text?: string;
  /** userId owning the row; default: the seeded user. */
  owner?: string;
}

export interface HappyPair {
  v1: string;
  v2: string;
  jd: string;
  titles: { v1: string; v2: string; jd: string };
  /** rawText of v1 / v2 / jd — must never reach the comparison page or response. */
  texts: { v1: string; v2: string; jd: string };
}

export interface CvcSeed {
  readonly userId: string;
  /** Cookie header of the seeded user. */
  readonly cookie: string;
  /** Typed API client signed in as the seeded user. */
  readonly api: ApiClient;
  /** A unique, human-readable title. */
  title(prefix: string): string;
  cv(doc?: DocSeed): Promise<string>;
  jd(doc?: DocSeed): Promise<string>;
  /** `length` saved CVs, each the parent of the next: [v1, v2, …]. */
  chain(length: number, prefix?: string): Promise<string[]>;
  match(cvId: string, jdId: string, seed?: MatchSeed): Promise<string>;
  /** A MatchRun row (what `/wizard?runId=` reopens). */
  run(cvId: string, jdId: string, owner?: string): Promise<string>;
  /** v1 → v2 (v2.parent = v1) and a JD, both versions matched on it (61/70/48 → 75/78/71, HAPPY_GAPS). */
  happyPair(gaps?: { base: string[]; revision: string[] }): Promise<HappyPair>;
  /** parentId of any document as stored in the DB (undefined when the row is gone). */
  parentOf(documentId: string): Promise<string | null | undefined>;
  /** Another signed-in user (deleted with this one). */
  otherUser(): Promise<SeededUser>;
  /** A guest session (deleted with this one). */
  guest(): Promise<SeededUser>;
}

const CLOCK_START = Date.parse("2026-01-01T00:00:00.000Z");

async function createSeed(apiAs: (identity: SeededUser) => ApiClient): Promise<{ seed: CvcSeed; cleanup: () => Promise<void> }> {
  const owner = await createSignedInUser();
  const extraUsers: string[] = [];
  let tick = 0;
  const nextAt = () => new Date(CLOCK_START + ++tick * 60_000).toISOString();

  const doc = (kind: "CV" | "JD") => async (input: DocSeed = {}) =>
    insertDocument({
      userId: input.owner ?? owner.userId,
      kind,
      title: input.title ?? `${kind} ${uniqueSuffix()}`,
      rawText: input.text ?? `raw-${kind}-${uniqueSuffix()}`,
      isSaved: input.saved ?? true,
      parentId: input.parentId ?? null,
    });

  const seed: CvcSeed = {
    userId: owner.userId,
    cookie: owner.cookie,
    api: apiAs(owner),
    title: (prefix) => `${prefix} ${uniqueSuffix()}`,
    cv: doc("CV"),
    jd: doc("JD"),
    async chain(length, prefix = "Chain") {
      const ids: string[] = [];
      for (let i = 0; i < length; i += 1) {
        ids.push(await seed.cv({ title: `${prefix} v${i + 1} ${uniqueSuffix()}`, parentId: ids[i - 1] ?? null }));
      }
      return ids;
    },
    match: (cvId, jdId, input = {}) =>
      insertMatchResult({
        userId: input.owner ?? owner.userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        scores: input.scores ?? [50, 50, 50],
        report: { strengths: [], gaps: input.gaps ?? [], suggestions: [] },
        status: input.status ?? "succeeded",
        errorCode: input.status === "failed" ? "unreachable" : null,
        chatModel: input.chatModel ?? MODELS.chat,
        embedModel: input.embedModel ?? MODELS.embed,
        createdAt: input.at ?? nextAt(),
        runId: input.runId ?? null,
      }),
    run: (cvId, jdId, runOwner) =>
      insertMatchRun({ userId: runOwner ?? owner.userId, cvDocumentId: cvId, jdDocumentId: jdId }),
    async happyPair(gaps) {
      const titles = { v1: seed.title("Backend Resume v1"), v2: seed.title("Backend Resume v2"), jd: seed.title("Senior Backend JD") };
      const texts = { v1: `cv-one-${uniqueSuffix()}`, v2: `cv-two-${uniqueSuffix()}`, jd: `jd-text-${uniqueSuffix()}` };
      const v1 = await seed.cv({ title: titles.v1, text: texts.v1 });
      const v2 = await seed.cv({ title: titles.v2, text: texts.v2, parentId: v1 });
      const jd = await seed.jd({ title: titles.jd, text: texts.jd });
      const g = gaps ?? HAPPY_GAPS;
      await seed.match(v1, jd, { scores: BASE_SCORES, gaps: g.base });
      await seed.match(v2, jd, { scores: REVISION_SCORES, gaps: g.revision });
      return { v1, v2, jd, titles, texts };
    },
    parentOf: async (documentId) => (await findDocument(documentId))?.parentId,
    async otherUser() {
      const user = await createSignedInUser();
      extraUsers.push(user.userId);
      return user;
    },
    async guest() {
      const user = await createGuestUser();
      extraUsers.push(user.userId);
      return user;
    },
  };
  return { seed, cleanup: () => deleteUsers([owner.userId, ...extraUsers]) };
}

/** Replace the project's signed-in storage state with `cookie` (a Cookie header), or sign out when undefined. */
async function signBrowserIn(context: BrowserContext, cookie: string | undefined, webUrl: string): Promise<void> {
  await context.clearCookies();
  if (!cookie) return;
  const [name, ...rest] = cookie.split("=");
  await context.addCookies([
    { name, value: rest.join("="), domain: new URL(webUrl).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

export const test = shared.extend<{
  cvcSeed: CvcSeed;
  versionComparePage: VersionComparePage;
  versionLibraryPage: VersionLibraryPage;
  versionWizardPage: VersionWizardPage;
  /** Re-sign this test's browser in as another session (a Cookie header), or sign it out with undefined. */
  cvcSignIn: (cookie: string | undefined) => Promise<void>;
}>({
  cvcSeed: async ({ apiAs }, use) => {
    const { seed, cleanup } = await createSeed((user) => apiAs(user));
    try {
      await use(seed);
    } finally {
      await cleanup();
    }
  },
  versionComparePage: async ({ page, context, cvcSeed, urls }, use) => {
    await signBrowserIn(context, cvcSeed.cookie, urls.webUrl);
    await use(new VersionComparePage(page));
  },
  versionLibraryPage: async ({ page, context, cvcSeed, urls }, use) => {
    await signBrowserIn(context, cvcSeed.cookie, urls.webUrl);
    await use(new VersionLibraryPage(page));
  },
  versionWizardPage: async ({ page, context, cvcSeed, urls }, use) => {
    await signBrowserIn(context, cvcSeed.cookie, urls.webUrl);
    await use(new VersionWizardPage(page));
  },
  cvcSignIn: async ({ context, urls }, use) => {
    await use((cookie) => signBrowserIn(context, cookie, urls.webUrl));
  },
});
