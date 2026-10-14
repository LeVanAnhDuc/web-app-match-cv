import { expect, test } from "@playwright/test";
import {
  backButton,
  gotoWizard,
  nextButton,
  pasteText,
  stepperStep,
  switchToPasteTab,
  turnSaveOff
} from "./helpers";

// design.md §7 row 1 (Happy path, paste-text variant) + row 6 (wizard step
// guard: no Back on step 1). Step 3+ real-content coverage (Plan 2) lives in
// review-and-result.e2e.ts; this file stays step 1-2 (Plan 1 scope) plus the
// step-3 arrival smoke below.
test.describe("happy path — paste JD then paste CV", () => {
  test("advances step 1 -> 2 -> 3 (Review) via paste text", async ({
    page
  }) => {
    await gotoWizard(page);

    // Step 1 (JD): first-step guard — no Back available.
    await expect(
      page.getByRole("heading", { name: "Input Job Description" })
    ).toBeVisible();
    await expect(backButton(page)).toBeDisabled();
    await expect(nextButton(page)).toBeDisabled();

    await switchToPasteTab(page);
    await pasteText(
      page,
      "We are hiring a senior backend engineer with NestJS experience."
    );
    await turnSaveOff(page); // keep this run DB-neutral; save+reuse covered separately

    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();

    // Step 2 (CV): Back is now enabled.
    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();
    await expect(backButton(page)).toBeEnabled();
    await expect(nextButton(page)).toBeDisabled();

    await switchToPasteTab(page);
    await pasteText(
      page,
      "Senior backend engineer, 6 years experience with Node.js and NestJS."
    );
    await turnSaveOff(page);

    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();

    // Step 3 (Review): both original documents rendered read-only.
    await expect(
      page.getByRole("heading", { name: "Review documents" })
    ).toBeVisible();
    await expect(stepperStep(page, 3)).toHaveAttribute("data-status", "active");
    await expect(stepperStep(page, 4)).toHaveAttribute("data-status", "idle");
  });
});
