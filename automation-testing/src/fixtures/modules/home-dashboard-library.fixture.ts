import type { Page } from "@playwright/test";
import { CV_TEXT, JD_TEXT, titles, type HdlReport } from "@/data/test-data/home-dashboard-library";
import { HomeDashboardPage } from "@/pages/home-dashboard-library/home-dashboard.page";
import { insertDocument, insertMatchResult } from "@/utils/db";
import { urlMatches, type UrlMatcher } from "@/utils/glob";
import {
  SESSION_COOKIE,
  createGuestUser,
  createSignedInUser,
  createUser,
  deleteUsers,
  type SeededUser,
} from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "home-dashboard-library" — owned by that module: its page objects, seeded data, AI stubs.
// Add fixtures here, never in the shared files; this slot is already merged in fixtures/index.ts.
// Fixture names must be unique across ALL modules (mergeTests merges them into one test): prefix generic names.
//
//   homeDashboardPage  HomeDashboardPage on `page`
//   homeData           throwaway users (signed in / guest / bare) + documents and match results seeded in the DB
//                      (decisions Q3). Every user it made is deleted after the test (cascade).
//   homeSession        who the BROWSER is: swaps the project's mcv_session cookie for a homeData user, or clears it
//   homeLatency        delays matching requests and then lets them reach the real backend (loading states, Q6)

export interface HomePair {
  cvId: string;
  jdId: string;
  cvTitle: string;
  jdTitle: string;
}

export interface HomeResultInput {
  cvId: string;
  jdId: string;
  /** Overall score; semantic/keyword default to the same value. */
  score?: number;
  scores?: [overall: number, semantic: number, keyword: number];
  status?: "succeeded" | "failed";
  createdAt?: Date | string;
  report?: HdlReport;
}

export interface HomeData {
  signedIn(): Promise<SeededUser>;
  guest(): Promise<SeededUser>;
  /** A user with no session: owns data the caller must never see. */
  bareUser(): Promise<string>;
  document(userId: string, kind: "CV" | "JD", opts?: { title?: string; saved?: boolean }): Promise<string>;
  /** A saved CV + a saved JD with unique titles. */
  pair(userId: string, label?: string): Promise<HomePair>;
  result(userId: string, input: HomeResultInput): Promise<string>;
}

export interface HomeSession {
  /** The browser now runs as `user` (signed in or guest). Call before navigating. */
  use(user: SeededUser): Promise<void>;
  /** No session cookie at all (anonymous visitor). */
  anonymous(): Promise<void>;
}

async function setSessionCookie(page: Page, baseURL: string | undefined, user: SeededUser | null): Promise<void> {
  const context = page.context();
  await context.clearCookies({ name: SESSION_COOKIE });
  if (!user) return;
  const token = user.cookie.slice(`${SESSION_COOKIE}=`.length);
  // Host-only cookie for the web host: cookies ignore ports, so the API on :5200 (same host) receives it too.
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, url: baseURL ?? "http://localhost", httpOnly: true, sameSite: "Lax" },
  ]);
}

export const test = shared.extend<{
  homeDashboardPage: HomeDashboardPage;
  homeData: HomeData;
  homeSession: HomeSession;
  homeLatency: (url: UrlMatcher, delayMs: number, opts?: { method?: string }) => Promise<void>;
}>({
  homeDashboardPage: async ({ page }, use) => use(new HomeDashboardPage(page)),

  homeData: async ({}, use) => {
    const users: string[] = [];
    const data: HomeData = {
      async signedIn() {
        const user = await createSignedInUser();
        users.push(user.userId);
        return user;
      },
      async guest() {
        const user = await createGuestUser();
        users.push(user.userId);
        return user;
      },
      async bareUser() {
        const id = await createUser();
        users.push(id);
        return id;
      },
      document(userId, kind, opts = {}) {
        return insertDocument({
          userId,
          kind,
          title: opts.title ?? titles(kind)[kind === "CV" ? "cv" : "jd"],
          rawText: kind === "CV" ? CV_TEXT : JD_TEXT,
          isSaved: opts.saved ?? true,
        });
      },
      async pair(userId, label) {
        const { cv, jd } = titles(label);
        const cvId = await data.document(userId, "CV", { title: cv });
        const jdId = await data.document(userId, "JD", { title: jd });
        return { cvId, jdId, cvTitle: cv, jdTitle: jd };
      },
      result(userId, input) {
        const score = input.score ?? 60;
        return insertMatchResult({
          userId,
          cvDocumentId: input.cvId,
          jdDocumentId: input.jdId,
          scores: input.scores ?? [score, score, score],
          status: input.status ?? "succeeded",
          errorCode: input.status === "failed" ? "unreachable" : null,
          report: input.report,
          createdAt: input.createdAt,
        });
      },
    };
    await use(data);
    await deleteUsers(users).catch(() => undefined);
  },

  homeSession: async ({ page, baseURL }, use) => {
    await use({
      use: (user) => setSessionCookie(page, baseURL, user),
      anonymous: () => setSessionCookie(page, baseURL, null),
    });
  },

  homeLatency: async ({ page }, use) => {
    await use(async (url, delayMs, opts = {}) => {
      const method = opts.method?.toUpperCase();
      await page.route(
        (u) => urlMatches(url, u.toString()),
        async (route) => {
          if (method && route.request().method() !== method) return route.fallback();
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          await route.fallback();
        }
      );
    });
  },
});
