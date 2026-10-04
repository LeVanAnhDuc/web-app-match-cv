import "dotenv/config"; // load client/.env (E2E_DATABASE_URL for db-cleanup) into node process
import { defineConfig, devices } from "@playwright/test";

// Gate A of the §4.3 dual-gate (docs/specs/cv-jd-matching-wizard/e2e.md).
// Runs against the ALREADY-RUNNING dev servers (server :5200, client :5300)
// — this config intentionally has no `webServer` block; it never starts or
// stops anything itself.
// globalSetup seeds a User + Session row and writes this storage state with
// the matching `mcv_session` cookie (e2e/auth-state.ts), so every signed-in
// project runs as the e2e user without the OIDC round-trip.
const SIGNED_IN = "e2e/.auth/user.json";
const NO_SESSION = { cookies: [], origins: [] };
const GUEST_SPECS = "guest-mode/**";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  // 60s, raised from 30s once the suite passed 170 serial tests. Nothing here
  // is slow by design; the budget covers the FIRST visit to a route in a run,
  // which against a Vite dev server also pays to compile that route's chunk.
  // A cold run lost six wizard specs to that compile while the identical warm
  // re-run passed all 176 — a timeout that only fails when the machine is cold
  // is reporting on the machine, not on the code.
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    // Override when the dev server runs on another port — e.g. a git worktree
    // running in parallel with the main checkout that already owns :5300.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5300",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  // Three viewport classes per docs/specs/wizard-responsive/design.md §8.2.
  // All chromium on purpose: the `iPhone 13` / `iPad (gen 7)` descriptors force
  // `defaultBrowserType: "webkit"`, which means installing another browser for
  // no gain when what we assert is CSS breakpoint behaviour.
  projects: [
    {
      name: "desktop",
      testIgnore: GUEST_SPECS,
      use: { ...devices["Desktop Chrome"], storageState: SIGNED_IN }
    },
    {
      name: "tablet",
      testIgnore: GUEST_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        storageState: SIGNED_IN,
        viewport: { width: 820, height: 1180 },
        hasTouch: true
      }
    },
    {
      name: "mobile",
      testIgnore: GUEST_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        storageState: SIGNED_IN,
        viewport: { width: 390, height: 844 },
        hasTouch: true
      }
    },
    // Guest mode (FR-18 / FR-21): no session cookie. Only guest-mode/** runs
    // here; everything else is signed-in.
    {
      name: "guest-desktop",
      testMatch: GUEST_SPECS,
      use: { ...devices["Desktop Chrome"], storageState: NO_SESSION }
    },
    {
      name: "guest-mobile",
      testMatch: GUEST_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        storageState: NO_SESSION,
        viewport: { width: 390, height: 844 },
        hasTouch: true
      }
    }
  ]
});
