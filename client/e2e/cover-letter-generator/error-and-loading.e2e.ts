import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  letterDialog,
  openLetterModal,
  resetLetters,
  stubCoverLetters
} from "./helpers";

// Matrix row 10 — error and loading.

test.describe("cover letter — errors and loading", () => {
  test.beforeEach(async () => {
    await resetLetters();
    await cleanDocuments();
  });

  test.afterAll(async () => {
    await resetLetters();
  });

  test("[10] a provider failure is stored and shown, with a retry", async ({
    page
  }) => {
    await stubCoverLetters(page, { failNextGenerate: "no_quota" });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await dialog.getByRole("button", { name: /Generate/ }).click();

    await expect(
      dialog.getByText("This key has no quota left with the provider.")
    ).toBeVisible({ timeout: 15000 });
    await expect(
      dialog.getByRole("button", { name: "Try again" })
    ).toBeVisible();
    // A failed row is NOT drawn as an empty letter.
    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveCount(0);
    // and it is still listed, so a reload would show it too
    await expect(dialog.getByText("Failed")).toBeVisible();
  });

  test("[10] a failed list load says so instead of showing nothing", async ({
    page
  }) => {
    await stubCoverLetters(page, { listStatus: 500 });
    await openLetterModal(page);

    await expect(
      letterDialog(page).getByText("Could not load your drafts.")
    ).toBeVisible({ timeout: 15000 });
  });

  test("[10] a failed save keeps the text the user typed", async ({ page }) => {
    await stubCoverLetters(page, { seed: [{}], patchStatus: 500 });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    const field = dialog.getByLabel("Draft", { exact: true });
    await expect(field).toBeVisible({ timeout: 15000 });
    await field.fill("Words I do not want to lose.");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(
      dialog.getByText(
        "Could not save your changes. Your text is still here — try again."
      )
    ).toBeVisible({ timeout: 15000 });
    await expect(field).toHaveValue("Words I do not want to lose.");
  });

  test("[10] the draft area reports itself busy while generating", async ({
    page
  }) => {
    await stubCoverLetters(page, { generateDelayMs: 3000 });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await dialog.getByRole("button", { name: /Generate/ }).click();

    await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(dialog.getByLabel("Draft", { exact: true })).toBeVisible({
      timeout: 20000
    });
    await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0);
  });
});
