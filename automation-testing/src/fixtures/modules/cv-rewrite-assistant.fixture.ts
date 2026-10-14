import type { BrowserContext } from "@playwright/test";
import type { ApiClient } from "@/api";
import { CvRewritePage } from "@/pages/cv-rewrite-assistant/cv-rewrite.page";
import { HomeRecentMatchesPage, SavedCvsPage, WizardResultPage } from "@/pages/cv-rewrite-assistant/rewrite-entry.page";
import { CV_TEXT, JD_TEXT, REPORT, type ProposalTarget } from "@/data/test-data/cv-rewrite-assistant";
import { uniqueSuffix } from "@/data/test-data/shared";
import { readE2eUserId } from "@/utils/auth-state";
import {
  insertAiCredential,
  insertDocument,
  insertMatchResult,
  insertMatchRun,
  sql,
  type DocumentRow,
  type MatchReport,
} from "@/utils/db";
import { createGuestUser, createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "cv-rewrite-assistant" (src/docs/requirements/cv-rewrite-assistant.md). Every name starts
// with `rewrite` so nothing collides when the 13 slots are merged into one `test`.
//
//   rewritePage          CvRewritePage (/cv-rewrite/:matchResultId) on the test's page
//   rewriteWizard        WizardResultPage — the result card entry point (/wizard?runId=)
//   rewriteHome          HomeRecentMatchesPage — reopening a match from "Recent matches"
//   rewriteLibrary       SavedCvsPage — /cv, where a saved rewrite must show up
//   rewriteData          seeds CV/JD/match/run/credential rows straight into the dev DB for ANY owner (default: the
//                        seeded e2e user the browser is signed in as) and removes them after the test
//   rewriteUsers         throwaway signed-in / guest users (+ a typed client bound to them), deleted after the test
//   rewriteBrowser       who the browser tab is: signOut() (anonymous) or as(user) (a guest / another user's cookie)
//   rewriteRoutes        slowDown(url): delay a REAL backend response to observe a loading state (no stub)
//   rewriteOnce          one POST with NO throttler retry (http.client waits out 429s; the throttle TCs must see them)

export interface RewriteSeed extends ProposalTarget {
  userId: string;
  jdId: string;
  jdTitle: string;
  runId: string | null;
}

export interface SeedOptions {
  /** Owner of every row. Default: the seeded e2e user (the browser's session). */
  userId?: string;
  cvText?: string;
  cvTitle?: string;
  jdText?: string;
  report?: MatchReport;
  status?: "succeeded" | "failed";
  credentialId?: string | null;
  /** Group the match in a MatchRun (what /wizard?runId= reopens). */
  withRun?: boolean;
  /** Reuse documents of an earlier seed instead of creating new ones. */
  documentsOf?: Pick<RewriteSeed, "cvId" | "jdId" | "cvTitle" | "jdTitle">;
  runId?: string;
  createdAt?: Date;
}

export interface RewriteData {
  /** Id of the e2e user the signed-in projects browse as. */
  e2eUserId(): string;
  /** CV + JD documents and a match result on them (succeeded by default). */
  match(options?: SeedOptions): Promise<RewriteSeed>;
  /** A credential row (fake ciphertext: listing never decrypts it). `lastTestStatus` null = never tested. */
  credential(options?: {
    userId?: string;
    label?: string;
    keyLast4?: string;
    provider?: "openrouter" | "openai" | "gemini";
    lastTestStatus?: "ok" | "failed" | null;
  }): Promise<{ id: string; label: string; keyLast4: string; provider: string }>;
  /** A lone saved CV document (no match), optionally a version of `parentId`. */
  cv(options: { userId?: string; title?: string; text?: string; parentId?: string | null }): Promise<string>;
  /** Documents whose parentId is `cvId` (accepted rewrites), oldest first. */
  childrenOf(cvId: string): Promise<DocumentRow[]>;
  /** The Document row as stored, or null. */
  document(id: string): Promise<DocumentRow | null>;
  /** Delete a match row (e.g. "deleted in another tab"). */
  deleteMatch(matchId: string): Promise<void>;
}

export interface RewriteUsers {
  signedIn(): Promise<SeededUser & { api: ApiClient }>;
  guest(): Promise<SeededUser & { api: ApiClient }>;
}

export interface RewriteBrowser {
  /** Drop every cookie: the tab becomes an anonymous visitor. */
  signOut(): Promise<void>;
  /** Replace the tab's session with `user`'s cookie (a guest, or another signed-in user). */
  as(user: SeededUser): Promise<void>;
}

export interface RewriteRoutes {
  /** Let matching requests reach the real backend, but only after `ms` (observing a loading state). */
  slowDown(url: string, ms: number, options?: { method?: string }): Promise<void>;
}

export interface OnceResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type RewriteOnce = (path: string, data: unknown, cookie?: string) => Promise<OnceResponse>;

async function setSessionCookie(context: BrowserContext, cookie: string, hosts: string[]): Promise<void> {
  const [name, ...rest] = cookie.split("=");
  const value = rest.join("=");
  await context.addCookies(
    [...new Set(hosts)].map((domain) => ({ name, value, domain, path: "/", httpOnly: true, sameSite: "Lax" as const }))
  );
}

export const test = shared.extend<{
  rewritePage: CvRewritePage;
  rewriteWizard: WizardResultPage;
  rewriteHome: HomeRecentMatchesPage;
  rewriteLibrary: SavedCvsPage;
  rewriteData: RewriteData;
  rewriteUsers: RewriteUsers;
  rewriteBrowser: RewriteBrowser;
  rewriteRoutes: RewriteRoutes;
  rewriteOnce: RewriteOnce;
}>({
  rewritePage: async ({ page }, use) => use(new CvRewritePage(page)),
  rewriteWizard: async ({ page }, use) => use(new WizardResultPage(page)),
  rewriteHome: async ({ page }, use) => use(new HomeRecentMatchesPage(page)),
  rewriteLibrary: async ({ page }, use) => use(new SavedCvsPage(page)),

  rewriteData: async ({}, use) => {
    const documents: string[] = [];
    const matches: string[] = [];
    const runs: string[] = [];
    const credentials: string[] = [];
    let e2eUser: string | undefined;
    const e2eUserId = () => (e2eUser ??= readE2eUserId());

    const data: RewriteData = {
      e2eUserId,
      async match(options = {}) {
        const userId = options.userId ?? e2eUserId();
        const suffix = uniqueSuffix();
        let docs = options.documentsOf;
        if (!docs) {
          const cvTitle = options.cvTitle ?? `Rewrite CV ${suffix}`;
          const jdTitle = `Rewrite JD ${suffix}`;
          const cvId = await insertDocument({
            userId,
            kind: "CV",
            title: cvTitle,
            rawText: options.cvText ?? CV_TEXT,
            isSaved: true,
          });
          documents.push(cvId);
          const jdId = await insertDocument({
            userId,
            kind: "JD",
            title: jdTitle,
            rawText: options.jdText ?? JD_TEXT,
            isSaved: true,
          });
          documents.push(jdId);
          docs = { cvId, jdId, cvTitle, jdTitle };
        }
        let runId: string | null = options.runId ?? null;
        if (!runId && options.withRun) {
          runId = await insertMatchRun({ userId, cvDocumentId: docs.cvId, jdDocumentId: docs.jdId });
          runs.push(runId);
        }
        const status = options.status ?? "succeeded";
        const matchId = await insertMatchResult({
          userId,
          cvDocumentId: docs.cvId,
          jdDocumentId: docs.jdId,
          status,
          errorCode: status === "failed" ? "unreachable" : null,
          scores: status === "failed" ? [0, 0, 0] : [61, 70, 48],
          report: status === "failed" ? { strengths: [], gaps: [], suggestions: [] } : (options.report ?? REPORT),
          credentialId: options.credentialId ?? null,
          runId,
          createdAt: options.createdAt,
        });
        matches.push(matchId);
        return { userId, matchId, runId, ...docs };
      },
      async credential(options = {}) {
        const label = options.label ?? `Rewrite key ${uniqueSuffix()}`;
        const keyLast4 = options.keyLast4 ?? "7Q2z";
        const provider = options.provider ?? "openrouter";
        const id = await insertAiCredential({
          userId: options.userId ?? e2eUserId(),
          provider,
          label,
          encryptedKey: Buffer.from("not-a-real-ciphertext"),
          keyIv: Buffer.alloc(12),
          keyTag: Buffer.alloc(16),
          keyLast4,
        });
        credentials.push(id);
        if (options.lastTestStatus) {
          await sql(`UPDATE "AiCredential" SET "lastTestStatus" = $2, "lastTestedAt" = now() WHERE id = $1`, [
            id,
            options.lastTestStatus,
          ]);
        }
        return { id, label, keyLast4, provider };
      },
      async cv(options) {
        const id = await insertDocument({
          userId: options.userId ?? e2eUserId(),
          kind: "CV",
          title: options.title ?? `Rewrite CV ${uniqueSuffix()}`,
          rawText: options.text ?? CV_TEXT,
          isSaved: true,
          parentId: options.parentId ?? null,
        });
        documents.push(id);
        return id;
      },
      childrenOf: (cvId) =>
        sql<DocumentRow & Record<string, unknown>>(
          `SELECT id, "userId", kind, title, "sourceFormat", "rawText", "fileData", "fileMime", "isSaved", "parentId"
             FROM "Document" WHERE "parentId" = $1 ORDER BY "createdAt", id`,
          [cvId]
        ),
      async document(id) {
        const [row] = await sql<DocumentRow & Record<string, unknown>>(
          `SELECT id, "userId", kind, title, "sourceFormat", "rawText", "fileData", "fileMime", "isSaved", "parentId"
             FROM "Document" WHERE id = $1`,
          [id]
        );
        return row ?? null;
      },
      deleteMatch: async (matchId) => {
        await sql(`DELETE FROM "MatchResult" WHERE id = $1`, [matchId]);
      },
    };

    await use(data);

    // Accepted rewrites are children of the seeded CVs: remove them, then the matches/runs that reference the
    // documents, then the documents and credentials. Rows of a throwaway user are already gone by cascade.
    if (documents.length) await sql(`DELETE FROM "Document" WHERE "parentId" = ANY($1::text[])`, [documents]);
    if (matches.length) await sql(`DELETE FROM "MatchResult" WHERE id = ANY($1::text[])`, [matches]);
    if (documents.length) {
      await sql(`DELETE FROM "MatchResult" WHERE "cvDocumentId" = ANY($1::text[]) OR "jdDocumentId" = ANY($1::text[])`, [
        documents,
      ]);
    }
    if (runs.length) await sql(`DELETE FROM "MatchRun" WHERE id = ANY($1::text[])`, [runs]);
    if (documents.length) await sql(`DELETE FROM "Document" WHERE id = ANY($1::text[])`, [documents]);
    if (credentials.length) await sql(`DELETE FROM "AiCredential" WHERE id = ANY($1::text[])`, [credentials]);
  },

  rewriteUsers: async ({ apiAs }, use) => {
    const ids: string[] = [];
    const track = (user: SeededUser) => {
      ids.push(user.userId);
      return { ...user, api: apiAs(user) };
    };
    await use({
      signedIn: async () => track(await createSignedInUser()),
      guest: async () => track(await createGuestUser()),
    });
    await deleteUsers(ids);
  },

  rewriteBrowser: async ({ page, urls }, use) => {
    const hosts = [new URL(urls.webUrl).hostname, new URL(urls.apiUrl).hostname];
    await use({
      signOut: () => page.context().clearCookies(),
      async as(user) {
        await page.context().clearCookies();
        await setSessionCookie(page.context(), user.cookie, hosts);
      },
    });
  },

  rewriteRoutes: async ({ page }, use) => {
    const routes: Array<{ url: string; handler: Parameters<typeof page.route>[1] }> = [];
    await use({
      async slowDown(url, ms, options = {}) {
        const method = options.method?.toUpperCase();
        const handler: Parameters<typeof page.route>[1] = async (route) => {
          if (method && route.request().method() !== method) return route.fallback();
          await new Promise((resolve) => setTimeout(resolve, ms));
          return route.fallback();
        };
        routes.push({ url, handler });
        await page.route(url, handler);
      },
    });
    for (const { url, handler } of routes) await page.unroute(url, handler).catch(() => undefined);
  },

  rewriteOnce: async ({ playwright, urls }, use) => {
    const root = urls.apiUrl.replace(/\/$/, "");
    await use(async (path, data, cookie) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
        extraHTTPHeaders: cookie ? { Cookie: cookie } : {},
      });
      try {
        const res = await context.post(`${root}${path}`, { data, failOnStatusCode: false, maxRedirects: 0 });
        const text = await res.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        const headers: Record<string, string> = {};
        for (const { name, value } of res.headersArray()) headers[name.toLowerCase()] = value;
        return { status: res.status(), headers, body };
      } finally {
        await context.dispose();
      }
    });
  },
});
