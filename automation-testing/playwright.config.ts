import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { resolveEnv } from "@/config/env";
import { buildGrepInvert, grepFlagsFrom } from "@/config/env-guard";
import { findUrls } from "@/config/urls";

const env = resolveEnv(process.env.ENV);
// Page objects navigate with relative URLs. undefined on an env without a host (fixtures then fail clearly).
const baseURL = findUrls(env)?.webUrl;
// Filtered out of a normal run: @e2e-full (unless FULL=1), @live-ai (unless LIVE_AI=1 — real provider, costs money),
// @creates-data on prd.
const grepInvert = buildGrepInvert(env, grepFlagsFrom(process.env));

// Signed-in runs reuse the session seeded by the "session" project (src/utils/auth-state.ts): a User + Session row and the
// matching mcv_session cookie, so no spec pays the OIDC round-trip. Guest specs run with no cookie at all.
const SIGNED_IN = ".auth/user.json";
const NO_SESSION = { cookies: [], origins: [] };
const GUEST = /e2e\/guest-mode\/.*\.e2e\.ts$/;
const UI = /e2e\/.*\.e2e\.ts$/;
// Three viewport classes (docs/specs/wizard-responsive/design.md §8.2), all chromium on purpose: the iPhone/iPad
// descriptors force webkit, and what the suite asserts is CSS breakpoint behaviour.
const TABLET = { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true };
const MOBILE = { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true };

export default defineConfig({
  reporter: [["list"], ["html", { open: "never" }]],
  // The suite seeds and cleans the shared dev database directly, so it runs serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 60s: the first visit to a route in a run also pays the Vite dev server's compile of that route's chunk.
  timeout: 60_000,
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // "app" first: the playwright-test MCP server (agents) treats the first project as primary.
  // Every project whose name starts with "app" belongs to a normal run (package.json runs --project="app*").
  projects: [
    {
      name: "app",
      dependencies: ["session"],
      testDir: "./src/tests",
      testMatch: [UI, /api\/.*\.api\.ts$/, /seed\.spec\.ts$/],
      testIgnore: GUEST,
      grepInvert,
      use: { ...devices["Desktop Chrome"], baseURL, storageState: SIGNED_IN },
    },
    {
      name: "app-tablet",
      dependencies: ["session"],
      testDir: "./src/tests",
      testMatch: UI,
      testIgnore: [GUEST, /e2e\/infra\//],
      grepInvert,
      use: { ...TABLET, baseURL, storageState: SIGNED_IN },
    },
    {
      name: "app-mobile",
      dependencies: ["session"],
      testDir: "./src/tests",
      testMatch: UI,
      testIgnore: [GUEST, /e2e\/infra\//],
      grepInvert,
      use: { ...MOBILE, baseURL, storageState: SIGNED_IN },
    },
    {
      name: "app-guest",
      dependencies: ["session"],
      testDir: "./src/tests",
      testMatch: GUEST,
      grepInvert,
      use: { ...devices["Desktop Chrome"], baseURL, storageState: NO_SESSION },
    },
    {
      name: "app-guest-mobile",
      dependencies: ["session"],
      testDir: "./src/tests",
      testMatch: GUEST,
      grepInvert,
      use: { ...MOBILE, baseURL, storageState: NO_SESSION },
    },
    // Seeds the e2e user's session before any app* project and cleans up after the last one.
    {
      name: "session",
      testDir: "./src/tests/setup",
      testMatch: /global-setup\.ts$/,
      teardown: "session-teardown",
    },
    { name: "session-teardown", testDir: "./src/tests/setup", testMatch: /global-teardown\.ts$/ },
    // One-off data setup (pnpm provision), never part of a normal run.
    {
      name: "provision",
      testDir: "./src/tests/setup",
      testMatch: /.*\.setup\.ts$/,
      workers: 1,
      use: { baseURL },
    },
    { name: "unit", testDir: "./src", testMatch: /.*\.test\.ts$/ },
  ],
});
