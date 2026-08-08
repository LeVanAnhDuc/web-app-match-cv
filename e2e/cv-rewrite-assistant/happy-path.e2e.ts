import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  advanceToReview,
  resetRunsAndCredentials,
  runMatchButton,
  stubMatches
} from "../multi-provider-compare/helpers";
import {
  API_BULLET,
  MATCH_ID,
  generateButton,
  gotoRewrite,
  saveButton,
  stubAccept,
  stubGenerate,
  stubPageContext
} from "./helpers";

// Matrix row 1 (happy path) and row 12 (keyboard/labelled controls).

test.describe("cv rewrite — happy path", () => {
  test.beforeEach(async () => {
    await cleanDocuments();
    await resetRunsAndCredentials();
  });

  test("[EP] the result card offers the rewrite assistant", async ({
    page
  }) => {
    await stubMatches(page, [{}]);
    await stubPageContext(page);
    await advanceToReview(page);
    await runMatchButton(page).click();

    const improve = page.getByRole("button", { name: "Improve my CV" });
    await expect(improve).toBeVisible({ timeout: 30000 });

    await improve.click();

    // The stubbed result carries its own id; the entry point routes to it.
    await expect(page).toHaveURL(/\/cv-rewrite\/stub-match-0$/);
    await expect(
      page.getByRole("heading", { name: "Improve this CV" })
    ).toBeVisible();
  });

  test("[EP] reopening a match from history reaches the same entry point", async ({
    page
  }) => {
    await page.route("**/api/v1/match", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: MATCH_ID,
            cvTitle: "Backend Resume",
            jdTitle: "Backend Engineer",
            overallScore: 61,
            createdAt: "2026-08-09T00:00:00.000Z"
          }
        ])
      });
    });
    await stubPageContext(page);

    await page.goto("/");
    await page
      .getByRole("button", { name: /Backend Resume/ })
      .first()
      .click();

    // Reopening a stored result renders the same card, so the entry point is
    // there without a second button anywhere.
    await expect(
      page.getByRole("button", { name: "Improve my CV" })
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("61%")).toBeVisible();
  });

  test("[EP] generate, approve some changes, save as a new CV", async ({
    page
  }) => {
    await stubPageContext(page);
    const generated = await stubGenerate(page, {});
    const accepted = await stubAccept(page);

    await gotoRewrite(page);

    // Nothing is generated until asked: one press of the CV leaving the system.
    expect(generated()).toBe(0);
    await expect(page.getByText("No CI/CD experience mentioned")).toBeVisible();

    await generateButton(page).click();
    await expect(page.getByText("Suggested changes")).toBeVisible();
    expect(generated()).toBe(1);

    // Nothing pre-approved, so saving is impossible yet.
    await expect(saveButton(page)).toBeDisabled();

    await page.getByRole("checkbox", { name: "Experience" }).first().check();
    await expect(saveButton(page)).toBeEnabled();

    await saveButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveValue(
      "Backend Resume (improved)"
    );
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(() => accepted().length, { timeout: 15000 })
      .toBeGreaterThan(0);
    const body = accepted()[0];
    expect(body.title).toBe("Backend Resume (improved)");
    // Only the approved change is sent — the second one was never ticked.
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0].original).toBe(API_BULLET);
    await expect(page).toHaveURL(/\/cv$/);
  });

  test("[EP] the preview shows the result of exactly what is ticked", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});

    await gotoRewrite(page);
    await generateButton(page).click();
    await page.getByRole("checkbox", { name: "Experience" }).first().check();
    await page.getByRole("button", { name: "Preview the result" }).click();

    const preview = page.locator("pre");
    await expect(preview).toContainText(
      "Built, documented and deployed REST APIs."
    );
    // The change that was NOT approved stays exactly as the CV has it.
    await expect(preview).toContainText(
      "Led a monolith migration across three teams."
    );
    await expect(preview).not.toContainText("Automated the release pipeline.");
  });

  test("[a11y] every control is reachable by role and name", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});

    await gotoRewrite(page);
    await expect(
      page.getByLabel("Run with", { exact: false }).first()
    ).toBeVisible();

    await generateButton(page).click();
    const groups = page.getByRole("group", { name: "Experience" });
    await expect(groups).toHaveCount(2);

    const firstBox = page.getByRole("checkbox", { name: "Experience" }).first();
    await firstBox.focus();
    await page.keyboard.press("Space");
    await expect(firstBox).toBeChecked();

    // Announced politely so a screen reader learns the suggestions landed.
    await expect(page.locator("[aria-live='polite']").first()).toBeAttached();
  });
});
