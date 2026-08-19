import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  draftRow,
  letterDialog,
  openLetterButton,
  openLetterModal,
  resetLetters,
  segmentedOption,
  stubCoverLetters
} from "./helpers";

// Matrix row 1 — happy path, including the reason drafts are stored at all:
// generating a second version must not destroy the first.

test.describe("cover letter — happy path", () => {
  test.beforeEach(async () => {
    await resetLetters();
    await cleanDocuments();
  });

  test.afterAll(async () => {
    await resetLetters();
  });

  test("[1a] a succeeded result offers to write a letter", async ({ page }) => {
    await stubCoverLetters(page);
    await openLetterModal(page);

    await expect(
      letterDialog(page).getByText("Cover letter", { exact: true })
    ).toBeVisible();
    await expect(segmentedOption(letterDialog(page), "Formal")).toBeVisible();
  });

  test("[1b] generating puts the draft in an editable field and in the list", async ({
    page
  }) => {
    await stubCoverLetters(page);
    await openLetterModal(page);

    const dialog = letterDialog(page);
    await dialog.getByRole("button", { name: /Generate/ }).click();

    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveValue(
      /Dear hiring manager/,
      { timeout: 15000 }
    );
    await expect(draftRow(dialog, "Formal · Standard · English")).toHaveCount(
      1
    );
  });

  test("[1c] a second draft does not replace the first — both stay readable", async ({
    page
  }) => {
    await stubCoverLetters(page);
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await dialog.getByRole("button", { name: /Generate/ }).click();
    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveValue(
      /Dear hiring manager/,
      { timeout: 15000 }
    );

    // Different knobs, second run.
    await segmentedOption(dialog, "Friendly").click();
    await segmentedOption(dialog, "Short").click();
    await segmentedOption(dialog, "Vietnamese").click();
    await dialog.getByRole("button", { name: /Generate/ }).click();

    const first = draftRow(dialog, "Formal · Standard · English");
    const second = draftRow(dialog, "Friendly · Short · Vietnamese");
    await expect(second).toHaveCount(1, { timeout: 15000 });
    await expect(first).toHaveCount(1);

    // Switching back and forth keeps each draft's own text — the whole point
    // of persisting every generation.
    await first.click();
    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveValue(
      /Dear hiring manager/
    );
    await second.click();
    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveValue(
      /Dear hiring manager/
    );
  });

  test("[1d] the draft can be copied and downloaded", async ({ page }) => {
    await stubCoverLetters(page, {
      seed: [{ content: "A letter worth copying." }]
    });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveValue(
      "A letter worth copying.",
      { timeout: 15000 }
    );
    await expect(dialog.getByRole("button", { name: "Copy" })).toBeEnabled();

    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download .txt" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.txt$/);
  });

  test("[1e] the entry point is absent while the card is still running", async ({
    page
  }) => {
    await stubCoverLetters(page);
    // Never open a result: the button belongs to a succeeded card only.
    await page.goto("/wizard");
    await expect(openLetterButton(page)).toHaveCount(0);
  });
});
