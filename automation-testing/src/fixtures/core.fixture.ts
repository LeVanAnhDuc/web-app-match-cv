import { test as base } from "@playwright/test";
import { resolveEnv, type EnvName } from "@/config/env";
import { assertAllowed } from "@/config/env-guard";
import { getUrls, type SiteUrls } from "@/config/urls";

// Fixtures every other fixture file builds on: which environment, its URLs, and the prd guard.
export const test = base.extend<
  { urls: SiteUrls; guard: void },
  { env: EnvName }
>({
  env: [
    async ({}, use) => use(resolveEnv(process.env.ENV)),
    { scope: "worker" },
  ],
  urls: async ({ env }, use) => use(getUrls(env)),
  guard: [
    async ({ env }, use, testInfo) => {
      assertAllowed(env, testInfo.tags);
      await use();
    },
    { auto: true },
  ],
});
