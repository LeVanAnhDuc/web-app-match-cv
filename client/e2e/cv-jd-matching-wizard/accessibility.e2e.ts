import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  gotoWizard,
  nextButton,
  pasteText,
  saveForReuse,
  switchToPasteTab,
  uniqueTitle
} from "./helpers";

// design.md §7 row 12 (Accessibility) — selectors below are role/label based
// throughout the whole suite; this file additionally asserts the structural
// a11y properties (roles, aria-current, radiogroup) explicitly.
test.beforeEach(async () => {
  await cleanDocuments();
});

test.describe("accessibility", () => {
  test("Next/Back are real buttons with accessible names", async ({ page }) => {
    await gotoWizard(page);
    await expect(nextButton(page)).toHaveRole("button");
    await expect(page.getByRole("button", { name: "Back" })).toHaveRole(
      "button"
    );
  });

  test('active stepper step exposes aria-current="step"', async ({ page }) => {
    await gotoWizard(page);
    await expect(page.getByTestId("stepper-step-1")).toHaveAttribute(
      "aria-current",
      "step"
    );
    await expect(page.getByTestId("stepper-step-2")).not.toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  test("saved-doc reuse list exposes a radiogroup with labeled options", async ({
    page
  }) => {
    const title = uniqueTitle("A11y JD");

    await gotoWizard(page);
    await switchToPasteTab(page);
    await pasteText(page, "JD text for the accessibility radiogroup check.");
    await saveForReuse(page, title);
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole("radiogroup")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(title) })
    ).toBeVisible();
  });

  test("upload dropzone exposes discoverable instruction text (not icon-only)", async ({
    page
  }) => {
    await gotoWizard(page);
    await expect(page.getByText(/drop your file here/i)).toBeVisible();
    await expect(page.getByText(/supports pdf, docx/i)).toBeVisible();
  });
});
