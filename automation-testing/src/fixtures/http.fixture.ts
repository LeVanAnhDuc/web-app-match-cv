import { test as base } from "@playwright/test";
import { createHttp, type HttpFactory } from "@/api/http.client";
import { getUrls } from "@/config/urls";
import { test as core } from "./core.fixture";

// `http(cookie?)`: HTTP client on the API base URL for tests/api/**. Worker-scoped so `test.beforeAll` can seed
// through the API too. Each call opens and disposes its own request context, so there is nothing to clean up here.
export const test = core.extend<{}, { http: HttpFactory }>({
  http: [
    async ({ playwright, env }, use) => {
      await use(
        createHttp(playwright.request, getUrls(env).apiUrl, (ms) => {
          // A throttler wait must not eat the test's own budget.
          try {
            const info = base.info();
            info.setTimeout(info.timeout + ms);
          } catch {
            // Outside a test (worker-level hook): nothing to extend.
          }
        })
      );
    },
    { scope: "worker" },
  ],
});
