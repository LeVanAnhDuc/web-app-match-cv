import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  MATCH_ID,
  generateButton,
  gotoRewrite,
  saveButton,
  stubAccept,
  stubGenerate,
  stubPageContext
} from "./helpers";

// Matrix rows 10 (error / loading) and 11 (mutation safety, incl. an invalid
// state transition).

test.describe("cv rewrite — errors and mutation safety", () => {
  test.beforeEach(async () => {
    await cleanDocuments();
  });

  test("[EP] a dead provider is reported without losing the page", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, { status: 503 });

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(
      page.getByText("Couldn't generate suggestions. Please try again.")
    ).toBeVisible();
    // The page is still usable — the user can just press again.
    await expect(generateButton(page)).toBeEnabled();
  });

  test("[EP] a match deleted in another tab is named, not swallowed", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, { status: 404 });

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(page.getByText("That match no longer exists.")).toBeVisible();
  });

  test("[EP] a missing match result shows an error, not a blank page", async ({
    page
  }) => {
    await page.route("**/api/v1/match/*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "not found" })
      });
    });

    await page.goto(`/cv-rewrite/${MATCH_ID}`);

    // TanStack Query retries a failed read three times with backoff, so the
    // error UI is a few seconds out — the point is that it arrives at all.
    await expect(page.getByRole("alert")).toContainText(
      "That match no longer exists.",
      { timeout: 20_000 }
    );
  });

  test("[ST] regenerating clears approvals made against the old proposal", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});

    await gotoRewrite(page);
    await generateButton(page).click();

    await page.getByRole("checkbox", { name: "Select all" }).check();
    await expect(saveButton(page)).toBeEnabled();

    // Invalid transition: an approval refers to an anchor in the proposal it
    // came from. Carrying it across a regeneration would approve a different
    // edit than the one the user read.
    await page.getByRole("button", { name: "Generate again" }).click();

    await expect(saveButton(page)).toBeDisabled();
    const boxes = page.getByRole("checkbox");
    for (let index = 0; index < (await boxes.count()); index += 1) {
      await expect(boxes.nth(index)).not.toBeChecked();
    }
  });

  test("[ST] a double-click on Save creates exactly one document", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});
    const accepted = await stubAccept(page);

    await gotoRewrite(page);
    await generateButton(page).click();
    await page.getByRole("checkbox", { name: "Select all" }).check();
    await saveButton(page).click();

    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "Save" });
    await confirm.click();
    await confirm.click({ force: true }).catch(() => undefined);

    await expect
      .poll(() => accepted().length, { timeout: 15000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(500);
    expect(accepted()).toHaveLength(1);
  });

  test("[DT] a rejected save keeps the approvals so no work is lost", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});
    await stubAccept(page, 400);

    await gotoRewrite(page);
    await generateButton(page).click();
    await page.getByRole("checkbox", { name: "Select all" }).check();
    await saveButton(page).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save" })
      .click();

    await expect(
      page.getByText(
        "One of the approved changes no longer matches your CV. Generate the suggestions again."
      )
    ).toBeVisible();
    // Losing an approval pass to a rejected request would be the worst part of
    // this flow, so the ticks survive.
    await expect(
      page.getByRole("checkbox", { name: "Select all" })
    ).toBeChecked();
  });
});
