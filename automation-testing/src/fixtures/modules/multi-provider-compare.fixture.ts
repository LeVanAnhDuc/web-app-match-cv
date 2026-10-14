import type { Page, Route } from "@playwright/test";
import type { ApiClient } from "@/api";
import { CompareWizardPage } from "@/pages/multi-provider-compare/compare-wizard.page";
import { credentialLabel, fakeApiKey, SYSTEM, succeededResult } from "@/data/test-data/multi-provider-compare";
import { insertMatchResult } from "@/utils/db";
import { createSignedInUser, deleteUsers, resolveSession, SESSION_COOKIE, type SeededUser } from "@/utils/sessions";
import type { AiCredentialDto, AiProvider } from "#/types/AiCredentials";
import type { MatchResultDto } from "#/types/Matching";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "multi-provider-compare". Names carry the "mpc"/"compare" prefix (unique across modules).
//
//   mpcUser                 a fresh signed-in user for THIS test, its session planted in the page's context (replacing
//                           the seeded e2e user's): no AI keys, documents or runs left by other modules change what
//                           step 3 selects by default. Deleted afterwards (cascades documents, runs, results, keys).
//   mpcApi                  ApiClient as mpcUser
//   compareWizardPage       CompareWizardPage signed in as mpcUser
//   guestCompareWizardPage  CompareWizardPage with no cookie (anonymous); the guest minted by its first POST /documents
//                           is deleted afterwards
//   mpcCredentials          add(provider, name?) → a real AiCredential of mpcUser (fake key: never sent anywhere,
//                           POST /match is stubbed)
//   mpcSeed                 a stored run of mpcUser to reopen through /wizard?runId= (documents and run via the API,
//                           results inserted in the DB — no endpoint writes a result without calling AI)
//   mpcMatchStub            D1 stub of POST /match, scripted PER CARD (keyed by credentialId, "system" = no
//                           credentialId) — the cards fire in parallel, so call order is not deterministic
//   mpcRunReads             GET /match/runs/:id helpers for the reopen path (delay, fail every read after the first)

export type StubOutcome =
  | { result: Partial<MatchResultDto>; delayMs?: number }
  | { status: number; body?: unknown; delayMs?: number };

export interface StubCall {
  key: string;
  body: Record<string, unknown>;
  sentAt: number;
  answeredAt?: number;
}

export interface MatchStub {
  /** Answer POST /match per card: `{ [credentialId | SYSTEM]: outcome | [first, second, …] }` (the last one repeats). */
  script(plan: Record<string, StubOutcome | StubOutcome[]>): Promise<void>;
  /** Every POST /match the page sent while the stub was on, in send order (optionally for one card). */
  calls(key?: string): StubCall[];
  /** The most POST /match requests that were waiting for an answer at the same time. */
  maxInFlight(): number;
}

export interface RunReads {
  /** Hold every GET /match/runs/:id back by `ms` before it goes to the real backend. */
  delay(ms: number): Promise<void>;
  /** The first GET /match/runs/:id goes to the real backend; every later one answers `status`. */
  failAfterFirst(status: number): Promise<void>;
}

export interface SeededRun {
  runId: string;
  cvId: string;
  jdId: string;
}

export interface RunSeeder {
  /** CV + JD (pasted, unsaved) and a run over them, all owned by mpcUser. */
  run(opts?: { cvText?: string; jdText?: string; cvParentText?: string }): Promise<SeededRun>;
  /** A stored result under the run (createdAt spaced by `order` seconds so the read order is fixed). */
  result(run: SeededRun, order: number, overrides?: Partial<Parameters<typeof insertMatchResult>[0]>): Promise<string>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function keyOf(body: Record<string, unknown>): string {
  return typeof body.credentialId === "string" && body.credentialId ? body.credentialId : SYSTEM;
}

async function plantSession(page: Page, webUrl: string, cookie: string): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: cookie.slice(`${SESSION_COOKIE}=`.length),
      domain: new URL(webUrl).hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

function createMatchStub(page: Page): MatchStub & { dispose(): Promise<void> } {
  const calls: StubCall[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let handler: ((route: Route) => Promise<void>) | undefined;
  const url = "**/api/v1/match";

  return {
    async script(plan) {
      const queues = new Map<string, StubOutcome[]>(
        Object.entries(plan).map(([key, outcome]) => [key, Array.isArray(outcome) ? [...outcome] : [outcome]])
      );
      if (handler) await page.unroute(url, handler);
      handler = async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        const key = keyOf(body);
        const call: StubCall = { key, body, sentAt: Date.now() };
        calls.push(call);
        const queue = queues.get(key);
        // Never let an unscripted card through: the real POST /match would call a paid provider (D1).
        if (!queue?.length) return route.abort("failed");
        const outcome = queue.length > 1 ? queue.shift()! : queue[0];
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          if (outcome.delayMs) await sleep(outcome.delayMs);
          if ("result" in outcome) {
            const result = succeededResult({
              cvDocumentId: String(body.cvDocumentId),
              jdDocumentId: String(body.jdDocumentId),
              runId: typeof body.runId === "string" ? body.runId : null,
              credentialId: key === SYSTEM ? null : key,
              ...outcome.result,
            });
            await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(result) });
          } else {
            await route.fulfill({
              status: outcome.status,
              contentType: "application/json",
              body: JSON.stringify(outcome.body ?? { statusCode: outcome.status, message: `Stubbed ${outcome.status}` }),
            });
          }
        } catch {
          // The page navigated away (reload) while the answer was held back: nothing left to answer.
        } finally {
          inFlight -= 1;
          call.answeredAt = Date.now();
        }
      };
      await page.route(url, handler);
    },
    calls: (key) => (key ? calls.filter((c) => c.key === key) : [...calls]),
    maxInFlight: () => maxInFlight,
    async dispose() {
      if (handler) await page.unroute(url, handler).catch(() => undefined);
    },
  };
}

function createRunReads(page: Page): RunReads {
  const url = "**/api/v1/match/runs/*";
  return {
    async delay(ms) {
      await page.route(url, async (route) => {
        if (route.request().method() === "GET") await sleep(ms);
        await route.fallback().catch(() => undefined);
      });
    },
    async failAfterFirst(status) {
      let reads = 0;
      await page.route(url, async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        reads += 1;
        if (reads === 1) return route.fallback();
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ statusCode: status, message: `Stubbed ${status}` }),
        });
      });
    },
  };
}

export const test = shared.extend<{
  mpcUser: SeededUser;
  mpcApi: ApiClient;
  compareWizardPage: CompareWizardPage;
  guestCompareWizardPage: CompareWizardPage;
  mpcCredentials: { add(provider: AiProvider, name?: string): Promise<AiCredentialDto> };
  mpcSeed: RunSeeder;
  mpcMatchStub: MatchStub;
  mpcRunReads: RunReads;
}>({
  mpcUser: async ({ page, urls }, use) => {
    const user = await createSignedInUser();
    await plantSession(page, urls.webUrl, user.cookie);
    await use(user);
    await deleteUsers([user.userId]);
  },

  mpcApi: async ({ apiAs, mpcUser }, use) => {
    await use(apiAs(mpcUser));
  },

  compareWizardPage: async ({ page, mpcUser }, use) => {
    void mpcUser;
    await use(new CompareWizardPage(page));
  },

  guestCompareWizardPage: async ({ page }, use) => {
    const context = page.context();
    await context.clearCookies();
    await use(new CompareWizardPage(page));
    const session = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    if (!session) return;
    const owner = await resolveSession(session.value);
    if (owner?.isGuest) await deleteUsers([owner.userId]);
  },

  mpcCredentials: async ({ mpcApi }, use) => {
    await use({
      async add(provider, name = provider) {
        const res = await mpcApi.aiCredentials.create({ provider, label: credentialLabel(name), apiKey: fakeApiKey() });
        if (res.status !== 201) throw new Error(`seed credential failed: ${res.status} ${JSON.stringify(res.body)}`);
        return res.json();
      },
    });
  },

  mpcSeed: async ({ mpcApi, mpcUser }, use) => {
    await use({
      async run(opts = {}) {
        const doc = async (kind: "CV" | "JD", sourceText: string) => {
          const res = await mpcApi.documents.create({ kind, sourceText, save: false });
          if (res.status !== 201) throw new Error(`seed ${kind} failed: ${res.status}`);
          return res.json().id;
        };
        const cvId = await doc("CV", opts.cvText ?? "Seeded CV: backend engineer, NestJS, PostgreSQL.");
        const jdId = await doc("JD", opts.jdText ?? "Seeded JD: senior backend engineer.");
        if (opts.cvParentText) {
          const parentId = await doc("CV", opts.cvParentText);
          const linked = await mpcApi.documents.setParent(cvId, parentId);
          if (linked.status !== 200) throw new Error(`seed lineage failed: ${linked.status}`);
        }
        const run = await mpcApi.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId });
        if (run.status !== 201) throw new Error(`seed run failed: ${run.status}`);
        return { runId: run.json().id, cvId, jdId };
      },
      async result(run, order, overrides = {}) {
        return insertMatchResult({
          userId: mpcUser.userId,
          cvDocumentId: run.cvId,
          jdDocumentId: run.jdId,
          runId: run.runId,
          createdAt: new Date(Date.now() - 60_000 + order * 1_000),
          ...overrides,
        });
      },
    });
  },

  mpcMatchStub: async ({ page }, use) => {
    const stub = createMatchStub(page);
    await use(stub);
    await stub.dispose();
  },

  mpcRunReads: async ({ page }, use) => {
    await use(createRunReads(page));
  },
});
