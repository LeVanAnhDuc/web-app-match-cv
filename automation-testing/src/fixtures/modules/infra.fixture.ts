import { createApiClient, type ApiClient } from "@/api";
import { createHttp, type HttpMethod } from "@/api/http.client";
import { getUrls } from "@/config/urls";
import { WebRootPage } from "@/pages/infra/web-root.page";
import { createGuestUser, createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "infra" — health, Swagger and the HTTP plumbing every route shares (prefix, helmet, CORS,
// throttler, ValidationPipe, i18n resolver). Names are prefixed `infra` / module-specific (all slots merge into one test).

/** One HTTP exchange exactly as the server answered it: no throttle retry, any method (OPTIONS for CORS preflight). */
export interface InfraProbeResponse {
  status: number;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  setCookies: string[];
  text: string;
}

export type InfraProbe = (
  method: HttpMethod | "OPTIONS" | "HEAD",
  path: string,
  options?: { headers?: Record<string, string> }
) => Promise<InfraProbeResponse>;

/** Throwaway callers for one test, deleted (with everything they own) when the test ends. */
export interface InfraUsers {
  signedIn(): Promise<SeededUser>;
  guest(): Promise<SeededUser>;
}

export const test = shared.extend<
  { webRootPage: WebRootPage; infraUsers: InfraUsers },
  { infraRootApi: ApiClient; infraProbe: InfraProbe }
>({
  webRootPage: async ({ page }, use) => use(new WebRootPage(page)),

  infraUsers: async ({}, use) => {
    const ids: string[] = [];
    const track = async (user: Promise<SeededUser>) => {
      const seeded = await user;
      ids.push(seeded.userId);
      return seeded;
    };
    await use({ signedIn: () => track(createSignedInUser()), guest: () => track(createGuestUser()) });
    await deleteUsers(ids);
  },

  // The same typed client, rooted at the API ORIGIN instead of `<origin>/api/v1`: proves which paths live outside
  // the global prefix (REQ-INFRA-02). `infraRootApi.raw.get("/health")` → GET http://host:5200/health.
  infraRootApi: [
    async ({ playwright, env }, use) => {
      const origin = new URL(getUrls(env).apiUrl).origin;
      await use(createApiClient(createHttp(playwright.request, origin)));
    },
    { scope: "worker" },
  ],

  // The shared http client waits out a throttler 429 (Retry-After) and retries, and only knows GET/POST/PATCH/DELETE.
  // The rate-limit and CORS-preflight cases must see the server's first answer, so they use this single-shot probe
  // (paths relative to the API base, like the api clients). Missing from src/api: a no-retry option + OPTIONS.
  infraProbe: [
    async ({ playwright, env }, use) => {
      const root = getUrls(env).apiUrl.replace(/\/$/, "");
      await use(async (method, path, options = {}) => {
        const context = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
        try {
          const res = await context.fetch(`${root}${path}`, {
            method,
            headers: options.headers,
            maxRedirects: 0,
            failOnStatusCode: false,
          });
          const headers: Record<string, string> = {};
          const setCookies: string[] = [];
          for (const { name, value } of res.headersArray()) {
            const key = name.toLowerCase();
            if (key === "set-cookie") setCookies.push(value);
            headers[key] = value;
          }
          return { status: res.status(), headers, setCookies, text: (await res.body()).toString("utf8") };
        } finally {
          await context.dispose();
        }
      });
    },
    { scope: "worker" },
  ],
});
