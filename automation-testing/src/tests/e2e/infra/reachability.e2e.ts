import { test, expect } from "@/fixtures";

// Infrastructure smoke: the site answers at all. No test case — not product behaviour.
test("INFRA-01 web is reachable", { tag: ["@smoke"] }, async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
});
