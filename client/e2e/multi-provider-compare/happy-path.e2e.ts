import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  advanceToReview,
  createCredential,
  resetRunsAndCredentials,
  runMatchButton,
  stubMatches
} from "./helpers";

// Matrix rows 1 (happy path), 6 (boundary on provider count) and 8 (rendering).

test.describe("multi-provider compare", () => {
  test.beforeEach(async () => {
    await cleanDocuments();
    await resetRunsAndCredentials();
  });

  test.afterAll(async () => {
    await resetRunsAndCredentials();
  });

  test("[BVA 1] a single provider still looks like a normal result", async ({
    page
  }) => {
    await stubMatches(page, [{}]);
    await advanceToReview(page);

    // No credentials exist, so the system key is the sole default selection.
    await runMatchButton(page).click();

    await expect(page.getByText("80%")).toBeVisible({ timeout: 30000 });
    // Sole card → the report is open, not hidden behind a toggle.
    await expect(page.getByText("Stub strength 0")).toBeVisible();
    await expect(page.getByText("Show full report")).toBeHidden();
  });

  test("[BVA 2] two providers give two cards, each naming its own model", async ({
    page
  }) => {
    await createCredential("E2E openrouter key", "openrouter");
    await createCredential("E2E gemini key", "gemini");
    await stubMatches(page, [
      { provider: "openrouter", chatModel: "openai/gpt-4o-mini" },
      { provider: "gemini", chatModel: "gemini-2.5-flash" }
    ]);

    await advanceToReview(page);
    await page.getByRole("checkbox", { name: /E2E openrouter key/ }).check();
    await page.getByRole("checkbox", { name: /E2E gemini key/ }).check();

    await runMatchButton(page).click();

    await expect(page.getByText("OpenRouter · openai/gpt-4o-mini")).toBeVisible(
      { timeout: 30000 }
    );
    await expect(
      page.getByText("Google Gemini · gemini-2.5-flash")
    ).toBeVisible();
    // Two cards → reports collapse so the scores can be compared at a glance.
    await expect(page.getByText("Show full report")).toHaveCount(2);
  });

  test("[progressive] a fast provider renders while a slow one is still a skeleton", async ({
    page
  }) => {
    await createCredential("E2E fast key", "openrouter");
    await stubMatches(page, [
      { overallScore: 88 },
      { overallScore: 55, delayMs: 4000 }
    ]);

    await advanceToReview(page);
    // The credential is already the default pick, so tick the system key as
    // well to get a second card.
    await page.getByRole("checkbox", { name: /E2E fast key/ }).check();
    await page.getByRole("checkbox", { name: /System key/ }).check();

    await runMatchButton(page).click();

    // The first card lands well before the second.
    await expect(page.getByText("88%")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("55%")).toBeHidden();
    await expect(page.getByText("55%")).toBeVisible({ timeout: 30000 });
  });

  test("[EP] the CTA states how many providers will run", async ({ page }) => {
    await createCredential("E2E counted key", "openrouter");
    await advanceToReview(page);

    await page.getByRole("checkbox", { name: /E2E counted key/ }).check();
    await page.getByRole("checkbox", { name: /System key/ }).check();

    await expect(
      page.getByRole("button", { name: /Run match · 2 providers/ })
    ).toBeVisible();
  });
});
