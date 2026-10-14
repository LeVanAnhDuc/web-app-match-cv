import { test } from "@/fixtures";

// Seed for the playwright-test agents (planner / generator): an anonymous browser on the home page.
// Point it at the screen the next module starts from (e.g. a page object's goto()).
test("seed", async ({ page }) => {
  await page.goto("/");
});
