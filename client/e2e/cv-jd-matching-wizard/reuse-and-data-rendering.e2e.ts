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

// Shared backend + single stub user → isolate each test with a clean DB so
// empty-state and reuse-count assertions are deterministic across the suite.
test.beforeEach(async () => {
  await cleanDocuments();
});

// design.md §7 row 5 (Empty/null — reuse empty state), row 8 (data
// rendering), row 11 (reuse radio-select + saved-doc appears in list).
// Per-user isolation (also row 11) is BE-only in this MVP: the client always
// runs as the single stub current-user (server/prisma/seed.ts, Task C1), so
// there is no second identity the FE could exercise here — it's covered by
// `server/test/documents.e2e-spec.ts` (Task C3, two-user assertion). See
// e2e.md for the full N/A rationale.

test.describe("reuse list — empty state", () => {
  test('shows "No saved job descriptions yet" on step 1 with nothing saved', async ({
    page
  }) => {
    await gotoWizard(page);
    await expect(page.getByText("No saved job descriptions yet")).toBeVisible();
  });

  test('shows "No saved CVs yet" on step 2 with nothing saved', async ({
    page
  }) => {
    await gotoWizard(page);
    await switchToPasteTab(page);
    await pasteText(page, "JD text just to advance past step 1.");
    await nextButton(page).click();

    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();
    await expect(page.getByText("No saved CVs yet")).toBeVisible();
  });
});

test.describe("reuse list — saved doc appears + radio-select flow", () => {
  test("a saved JD appears in the step-1 reuse list, renders formatted fields, and can be reused", async ({
    page
  }) => {
    const title = uniqueTitle("JD");

    await gotoWizard(page);
    await switchToPasteTab(page);
    await pasteText(page, "Reusable JD: hiring a platform engineer.");
    // Explicit save via the button + modal (name required).
    await saveForReuse(page, title);
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();

    // Reload to reset the in-memory wizard store back to step 1, then verify
    // the saved JD now shows up in the reuse radio list.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Input Job Description" })
    ).toBeVisible();

    const radio = page.getByRole("radio", { name: new RegExp(title) });
    await expect(radio).toBeVisible();

    // Data rendering (design.md §7 row 8): sourceFormat must render as the
    // mapped label ("Text"), NOT the raw enum ("text"). Case-sensitive so the
    // two are actually distinguished (the old /text/i matched both).
    const radioContainer = page.locator("label", { hasText: title });
    await expect(radioContainer).toContainText("Text");
    await expect(radioContainer).not.toContainText("text");

    // Selecting the saved item enables Next without any new input.
    await radio.check();
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();
  });
});
