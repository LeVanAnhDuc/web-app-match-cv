import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import { gotoWizard, nextButton, pasteText, switchToPasteTab } from "./helpers";

// design.md §7 row 4 (Validation) + row 6 (BVA: paste length 0 vs 1) + save-for-reuse modal.
// The save test persists a doc → start each test from a clean DB.
test.beforeEach(async () => {
  await cleanDocuments();
});

test.describe("validation", () => {
  test("[BVA] empty paste text keeps Next disabled", async ({ page }) => {
    await gotoWizard(page);
    await switchToPasteTab(page);

    await expect(nextButton(page)).toBeDisabled();

    // Whitespace-only input must not count as content either.
    await pasteText(page, "   ");
    await expect(nextButton(page)).toBeDisabled();
  });

  test("[BVA] a single non-whitespace character enables Next", async ({
    page
  }) => {
    await gotoWizard(page);
    await switchToPasteTab(page);

    await pasteText(page, "x");
    await expect(nextButton(page)).toBeEnabled();
  });

  test("Save-for-reuse modal requires a name; explains the action; saves on confirm", async ({
    page
  }) => {
    await gotoWizard(page);
    await switchToPasteTab(page);
    await pasteText(page, "A job description to save for reuse.");

    // Open the save modal via the clearly-labelled button.
    await page.getByRole("button", { name: "Save for reuse" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Description explains what saving does (avoids misunderstanding).
    await expect(dialog).toContainText(/reuse list/i);

    // Confirm with no name → inline error, modal stays open.
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/name/i);
    await expect(dialog).toBeVisible();

    // Enter a name → saves, modal closes, confirmation shows.
    await dialog
      .getByPlaceholder("Enter a title for this document")
      .fill("Saved JD name");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/saved for reuse/i)).toBeVisible();

    // Next still proceeds to step 2.
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();
  });
});
