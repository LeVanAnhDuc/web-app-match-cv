import { randomBytes } from "node:crypto";
import type { AiProvider, AiTestStatus } from "#/types/AiCredentials";
import type { ApiClient } from "@/api";
import { getUrls } from "@/config/urls";
import type { UrlMatcher } from "@/utils/glob";
import { AiCredentialsPage } from "@/pages/ai-credentials/ai-credentials.page";
import { RunWithStepPage } from "@/pages/ai-credentials/run-with-step.page";
import {
  deleteDocuments,
  deleteMatchResults,
  findAiCredential,
  findMatchResult,
  insertAiCredential,
  insertDocument,
  insertMatchResult,
  sql,
  utc,
} from "@/utils/db";
import {
  SESSION_COOKIE,
  createGuestUser,
  createSignedInUser,
  createUser,
  deleteUsers,
  type SeededUser,
} from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "ai-credentials" — owned by that module: its page objects, seeded data, AI stubs.
// Fixture names must be unique across ALL modules (mergeTests merges them into one test): every name here starts
// with "aiCred" or names an ai-credentials page object.
//
//   aiCredentialsPage   page object of /ai-credentials
//   runWithStep         wizard step 3 "Run with" block, as this module sees it
//   aiCredUser          (UI) a throwaway signed-in user; the test's browser context is switched to their session, so
//                       a spec sees ONLY its own credentials (the shared e2e user is never touched). Deleted after the
//                       test (cascades to credentials, documents, matches).
//   aiCredData          (worker) DB/session helpers the API specs need: users, foreign credential rows, verdict and
//                       lastUsedAt stamps, match-result snapshots. Wraps src/utils so specs import nothing but @/fixtures.
//   aiCredDelay         hold matching browser requests for `ms`, then let them through to the REAL backend (the
//                       shared `network` fixture can only answer with a stub) — to observe a loading state.
//   aiCredProbe         (worker) ONE request with no throttle retry, for the rate-limit spec (the shared http client
//                       waits out a 429 that carries Retry-After, which is exactly what that spec must observe).

export interface AiCredUser extends SeededUser {
  /** Typed client signed in as this user. */
  api: ApiClient;
}

export interface ProbeResponse {
  status: number;
  retryAfterSeconds: number | null;
}

export interface AiCredData {
  createSignedInUser(): Promise<SeededUser>;
  createGuestUser(): Promise<SeededUser>;
  /** A bare user with no session ("someone else"). */
  createUser(): Promise<string>;
  deleteUsers(ids: string[]): Promise<void>;
  /**
   * A credential row owned by `userId`, inserted directly. The ciphertext is opaque random bytes of the right shape:
   * only ever used to prove the row is unreachable, which never decrypts it.
   */
  insertForeignCredential(userId: string, label?: string, provider?: AiProvider): Promise<string>;
  /** Raw row (ciphertext, IV, tag, verdict). */
  findCredential: typeof findAiCredential;
  /** Stamp a connection-test verdict as POST /:id/test would have stored it. */
  setVerdict(id: string, status: AiTestStatus | null, testedAt: Date | null): Promise<void>;
  /** Stamp lastUsedAt as a match run with this credential would have. */
  markUsed(id: string, at: Date): Promise<void>;
  lastUsedAt(id: string): Promise<Date | null>;
  insertDocument: typeof insertDocument;
  deleteDocuments: typeof deleteDocuments;
  insertMatchResult: typeof insertMatchResult;
  findMatchResult: typeof findMatchResult;
  deleteMatchResults: typeof deleteMatchResults;
  /** MatchResult rows of a user (to prove a rejected /match wrote nothing). */
  countMatchResults(userId: string): Promise<number>;
}

const data: AiCredData = {
  createSignedInUser: () => createSignedInUser(),
  createGuestUser: () => createGuestUser(),
  createUser: () => createUser(),
  deleteUsers,
  insertForeignCredential: (userId, label = "belongs to someone else", provider = "openai") =>
    insertAiCredential({
      userId,
      provider,
      label,
      encryptedKey: randomBytes(32),
      keyIv: randomBytes(12),
      keyTag: randomBytes(16),
      keyLast4: "0000",
    }),
  findCredential: findAiCredential,
  async setVerdict(id, status, testedAt) {
    await sql(
      `UPDATE "AiCredential"
          SET "lastTestStatus" = $2::"AiTestStatus",
              "lastTestedAt" = $3::timestamptz AT TIME ZONE 'UTC'
        WHERE id = $1`,
      [id, status, testedAt ? utc(testedAt) : null]
    );
  },
  async markUsed(id, at) {
    await sql(`UPDATE "AiCredential" SET "lastUsedAt" = $2::timestamptz AT TIME ZONE 'UTC' WHERE id = $1`, [id, utc(at)]);
  },
  async lastUsedAt(id) {
    const [row] = await sql<{ lastUsedAt: Date | null }>(`SELECT "lastUsedAt" FROM "AiCredential" WHERE id = $1`, [id]);
    return row?.lastUsedAt ?? null;
  },
  insertDocument,
  deleteDocuments,
  insertMatchResult,
  findMatchResult,
  deleteMatchResults,
  async countMatchResults(userId) {
    const [row] = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM "MatchResult" WHERE "userId" = $1`, [userId]);
    return Number(row?.n ?? 0);
  },
};

export const test = shared.extend<
  {
    aiCredentialsPage: AiCredentialsPage;
    runWithStep: RunWithStepPage;
    aiCredUser: AiCredUser;
    aiCredDelay: (url: UrlMatcher, ms: number, method?: string) => Promise<void>;
  },
  {
    aiCredData: AiCredData;
    aiCredProbe: (method: "GET" | "POST" | "PATCH" | "DELETE", path: string, cookie?: string) => Promise<ProbeResponse>;
  }
>({
  aiCredentialsPage: async ({ page }, use) => use(new AiCredentialsPage(page)),
  runWithStep: async ({ page }, use) => use(new RunWithStepPage(page)),

  aiCredUser: async ({ page, urls, apiAs }, use) => {
    const user = await createSignedInUser();
    try {
      const context = page.context();
      await context.clearCookies();
      await context.addCookies([
        {
          name: SESSION_COOKIE,
          value: user.cookie.slice(user.cookie.indexOf("=") + 1),
          domain: new URL(urls.apiUrl).hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await use({ ...user, api: apiAs(user) });
    } finally {
      await deleteUsers([user.userId]).catch(() => undefined);
    }
  },

  aiCredDelay: async ({ page }, use) => {
    await use(async (url, ms, method) => {
      await page.route(url, async (route) => {
        if (method && route.request().method() !== method.toUpperCase()) return route.fallback();
        await new Promise((resolve) => setTimeout(resolve, ms));
        await route.fallback();
      });
    });
  },

  aiCredData: [async ({}, use) => use(data), { scope: "worker" }],

  aiCredProbe: [
    async ({ playwright, env }, use) => {
      const apiUrl = getUrls(env).apiUrl.replace(/\/$/, "");
      await use(async (method, path, cookie) => {
        const context = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
          extraHTTPHeaders: cookie ? { Cookie: cookie } : {},
        });
        try {
          const res = await context.fetch(`${apiUrl}${path}`, { method, failOnStatusCode: false, maxRedirects: 0 });
          const retryAfter = Number(res.headers()["retry-after"]);
          return { status: res.status(), retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null };
        } finally {
          await context.dispose();
        }
      });
    },
    { scope: "worker" },
  ],
});
