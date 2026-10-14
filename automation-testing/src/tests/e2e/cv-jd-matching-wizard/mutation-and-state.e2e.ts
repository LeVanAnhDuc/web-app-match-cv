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

// design.md §7 row 11 (Mutation/state) — [ST] transitions + Back button.
// Gate: A only (per matrix) — this file stays read/navigation-only, no
// second-user contamination risk regardless.
//
// N/A (documented in e2e.md): "invalid transition: jump straight to step 4"
// — the wizard is a single client-side route (`/wizard`) driven entirely by
// in-memory Zustand `step` state (client/src/features/wizard/store.ts), not
// per-step URLs. There is no address a user could navigate to that skips
// ahead, so this class of bug is structurally impossible here.
// Double-submit "Match" idempotency is also N/A — Match (step 4) is a Plan 2
// placeholder, not built yet.
test.describe("mutation / state transitions", () => {
  test("[ST] step1 -> step2 -> Back returns to step1 without crashing", async ({
    page
  }) => {
    await gotoWizard(page);
    await expect(stepperStep(page, 1)).toHaveAttribute("data-status", "active");

    await switchToPasteTab(page);
    await pasteText(page, "JD text for the state-transition check.");
    await turnSaveOff(page);
    await nextButton(page).click();

    await expect(
      page.getByRole("heading", { name: "Candidate CV / Resume" })
    ).toBeVisible();
    await expect(stepperStep(page, 2)).toHaveAttribute("data-status", "active");
    await expect(stepperStep(page, 1)).toHaveAttribute("data-status", "done");

    await backButton(page).click();

    await expect(
      page.getByRole("heading", { name: "Input Job Description" })
    ).toBeVisible();
    await expect(stepperStep(page, 1)).toHaveAttribute("data-status", "active");
    // First step has no Back again.
    await expect(backButton(page)).toBeDisabled();
  });

  test("[ST] repeated forward/back cycles remain stable (no duplicate advance)", async ({
    page
  }) => {
    await gotoWizard(page);

    for (let i = 0; i < 2; i++) {
      await switchToPasteTab(page);
      await pasteText(page, `JD text attempt ${i}.`);
      await turnSaveOff(page);
      await nextButton(page).click();
      await expect(
        page.getByRole("heading", { name: "Candidate CV / Resume" })
      ).toBeVisible();
      await backButton(page).click();
      await expect(
        page.getByRole("heading", { name: "Input Job Description" })
      ).toBeVisible();
    }
  });
});
