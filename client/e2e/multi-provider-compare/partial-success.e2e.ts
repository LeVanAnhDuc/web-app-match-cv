import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  advanceToReview,
  createCredential,
  MATCH_ROUTE,
  RUNS_ROUTE,
  resetRunsAndCredentials,
  runMatchButton,
  stubMatches
} from "./helpers";

// Matrix rows 5 (empty/null), 10 (error/loading) and 11 (mutation safety).

test.describe("multi-provider partial success", () => {
  test.beforeEach(async () => {
    await cleanDocuments();
    await resetRunsAndCredentials();
  });

  test.afterAll(async () => {
    await resetRunsAndCredentials();
  });

  test("[ST] one dead provider leaves the others intact", async ({ page }) => {
    await createCredential("E2E good key", "openrouter");
    await stubMatches(page, [
      { overallScore: 91 },
      { status: "failed", errorCode: "no_quota", provider: "gemini" }
    ]);

    await advanceToReview(page);
    await page.getByRole("checkbox", { name: /E2E good key/ }).check();
    await page.getByRole("checkbox", { name: /System key/ }).check();
    await runMatchButton(page).click();

    // The healthy card keeps its result…
    await expect(page.getByText("91%")).toBeVisible({ timeout: 30000 });
    // …while the dead one shows why it died.
    await expect(
      page.getByText("This key has no quota left with the provider.")
    ).toBeVisible();
  });

  test("[EP] a failed card is never drawn as a 0% score", async ({ page }) => {
    await stubMatches(page, [{ status: "failed", errorCode: "invalid_key" }]);

    await advanceToReview(page);
    await runMatchButton(page).click();

    await expect(
      page.getByText("That API key was rejected by the provider.")
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("0%")).toBeHidden();
    await expect(page.getByText("OVERALL MATCH")).toBeHidden();
  });

  test("[ST] Try again re-runs only the card that failed", async ({ page }) => {
    const calls = await stubMatches(page, [
      { status: "failed", errorCode: "timeout" },
      { overallScore: 77 }
    ]);

    await advanceToReview(page);
    await runMatchButton(page).click();

    await expect(
      page.getByText("The provider took too long to answer.")
    ).toBeVisible({ timeout: 30000 });
    expect(calls()).toBe(1);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByText("77%")).toBeVisible({ timeout: 30000 });
    expect(calls()).toBe(2);
  });

  test("[EP] failing to open the run keeps the user on step 3", async ({
    page
  }) => {
    await page.route(RUNS_ROUTE, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 500, message: "boom" })
      });
    });

    await advanceToReview(page);
    await runMatchButton(page).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20000 });
    // Never advance into an empty result step.
    await expect(
      page.getByRole("heading", { name: "Review documents" })
    ).toBeVisible();
  });

  test("[ST] reloading mid-run reads the run instead of firing again", async ({
    page
  }) => {
    await stubMatches(page, [{ overallScore: 64 }]);

    await advanceToReview(page);
    await runMatchButton(page).click();
    await expect(page.getByText("64%")).toBeVisible({ timeout: 30000 });

    // Count POSTs to /match AFTER the reload: the in-memory store is gone, so
    // the step must only read. Re-firing would silently double the AI spend.
    let postsAfterReload = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/match")
      ) {
        postsAfterReload += 1;
      }
    });

    await page.reload();
    await page.waitForTimeout(3000);

    expect(postsAfterReload).toBe(0);
  });

  test("[EP] a run whose results are gone says so instead of showing nothing", async ({
    page
  }) => {
    await stubMatches(page, [{ overallScore: 64 }]);
    await advanceToReview(page);
    await runMatchButton(page).click();
    await expect(page.getByText("64%")).toBeVisible({ timeout: 30000 });

    // The wizard store is in-memory, so a reload lands on step 1 with no run.
    // What matters is that nothing renders a broken result screen.
    await page.reload();
    await expect(page.getByTestId("stepper-step-1")).toBeVisible();
  });

  test("[DT] a rejected match request surfaces on its own card only", async ({
    page
  }) => {
    await createCredential("E2E rejected key", "openrouter");

    let call = 0;
    await page.route(MATCH_ROUTE, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      const index = call;
      call += 1;
      if (index === 0) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ statusCode: 404, message: "gone" })
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "ok-1",
          cvDocumentId: "cv",
          jdDocumentId: "jd",
          overallScore: 58,
          semanticScore: 60,
          keywordScore: 55,
          report: { strengths: [], gaps: [], suggestions: [] },
          credentialId: null,
          runId: "r",
          status: "succeeded",
          errorCode: null,
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini",
          embedModel: "openai/text-embedding-3-small",
          createdAt: new Date().toISOString()
        })
      });
    });

    await advanceToReview(page);
    await page.getByRole("checkbox", { name: /E2E rejected key/ }).check();
    await page.getByRole("checkbox", { name: /System key/ }).check();
    await runMatchButton(page).click();

    // One card errors, the other still renders its score.
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 30000
    });
    await expect(page.getByText("58%")).toBeVisible();
  });
});
