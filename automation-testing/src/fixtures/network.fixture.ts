import type { Page, Route } from "@playwright/test";
import { urlMatches, type UrlMatcher } from "@/utils/glob";
import { test as core } from "./core.fixture";

// `network`: browser-side stubs on the test's `page` (D1: UI specs stub the AI endpoints, everything else hits the
// real backend). Generic on purpose: the AI response bodies live in each module's test data, not here.
// Matchers follow page.route(): a glob over the FULL URL ("**/api/v1/match", "**/api/v1/match/runs/*") or a RegExp.
// A stub with `method` falls through (route.fallback) for any other method, so stubbing POST /match leaves the real
// GET /match history alone. Routes go away with the page; `network.clear()` removes them earlier.

export interface StubOptions {
  status?: number;
  /** Delay before the response is fulfilled, to observe loading states. */
  delayMs?: number;
  /** Only this HTTP method is stubbed (case-insensitive). Default: every method. */
  method?: string;
  headers?: Record<string, string>;
  /** How many matching requests to answer; later ones fall through to the real backend. Default: all. */
  times?: number;
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  /** Parsed JSON body, raw text when not JSON, null when there is none. */
  body: unknown;
}

export interface Network {
  /** Answer matching requests with `body` as JSON (default status 200). */
  stubJson(url: UrlMatcher, body: unknown, options?: StubOptions): Promise<void>;
  /** stubJson for the next matching request only. */
  stubOnce(url: UrlMatcher, body: unknown, options?: Omit<StubOptions, "times">): Promise<void>;
  /** Answer with an error status and a Nest-shaped body ({ statusCode, message }) unless `body` is given. */
  failWith(url: UrlMatcher, status: number, options?: Omit<StubOptions, "status"> & { body?: unknown }): Promise<void>;
  /** Abort matching requests at the network level (connection error, not an HTTP status). */
  abort(url: UrlMatcher, options?: Pick<StubOptions, "method" | "times">): Promise<void>;
  /**
   * Capture every matching request the page sends (stubbed or not) into the returned array, which fills live.
   * Observes through page.on("request"), so the order relative to stubs does not matter.
   */
  recordRequests(url: UrlMatcher, options?: Pick<StubOptions, "method">): RecordedRequest[];
  /** Remove every route this fixture registered. */
  clear(): Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseBody(text: string | null): unknown {
  if (text === null || text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createNetwork(page: Page): Network {
  const registered: Array<{ url: UrlMatcher; handler: (route: Route) => Promise<void> }> = [];

  async function intercept(url: UrlMatcher, options: StubOptions, answer: (route: Route) => Promise<void>) {
    const method = options.method?.toUpperCase();
    let left = options.times ?? Infinity;
    const handler = async (route: Route) => {
      if ((method && route.request().method() !== method) || left <= 0) {
        await route.fallback();
        return;
      }
      left -= 1;
      if (options.delayMs) await sleep(options.delayMs);
      await answer(route);
    };
    registered.push({ url, handler });
    await page.route(url, handler);
  }

  const json = (route: Route, status: number, body: unknown, headers?: Record<string, string>) =>
    route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

  return {
    stubJson: (url, body, options = {}) =>
      intercept(url, options, (route) => json(route, options.status ?? 200, body, options.headers)),
    stubOnce: (url, body, options = {}) =>
      intercept(url, { ...options, times: 1 }, (route) => json(route, options.status ?? 200, body, options.headers)),
    failWith: (url, status, options = {}) =>
      intercept(url, options, (route) =>
        json(route, status, options.body ?? { statusCode: status, message: `Stubbed ${status}` }, options.headers)
      ),
    abort: (url, options = {}) => intercept(url, options, (route) => route.abort("failed")),
    recordRequests(url, options = {}) {
      const method = options.method?.toUpperCase();
      const captured: RecordedRequest[] = [];
      page.on("request", (request) => {
        if (method && request.method() !== method) return;
        if (!urlMatches(url, request.url())) return;
        captured.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers(),
          body: parseBody(request.postData()),
        });
      });
      return captured;
    },
    async clear() {
      for (const { url, handler } of registered.splice(0)) await page.unroute(url, handler).catch(() => undefined);
    },
  };
}

export const test = core.extend<{ network: Network }>({
  network: async ({ page }, use) => {
    const network = createNetwork(page);
    await use(network);
    await network.clear();
  },
});
