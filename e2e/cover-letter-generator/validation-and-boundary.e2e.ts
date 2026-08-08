import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  draftRow,
  letterDialog,
  openLetterModal,
  resetLetters,
  segmentedOption,
  stubCoverLetters
} from "./helpers";

// Matrix rows 4 (validation) and 6 (boundary).
//
// The [DT] pairs of row 4 (a failed match combined with someone else's
// credential) are NOT reachable from the UI: the entry point only exists on a
// succeeded card, and a second user cannot be created through the browser.
// They are covered in server/test/cover-letters.e2e-spec.ts instead.

const MAX = 20_000;

test.describe("cover letter — validation and boundary", () => {
  test.beforeEach(async () => {
    await resetLetters();
    await cleanDocuments();
  });

  test.afterAll(async () => {
    await resetLetters();
  });

  test("[EP] emptying the draft disables Save and sends nothing", async ({
    page
  }) => {
    const stub = await stubCoverLetters(page, { seed: [{}] });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    const field = dialog.getByLabel("Draft", { exact: true });
    await expect(field).toBeVisible({ timeout: 15000 });
    const save = dialog.getByRole("button", { name: "Save changes" });

    await field.fill("");
    await expect(save).toBeDisabled();

    await field.fill("   ");
    await expect(save).toBeDisabled();

    expect(stub.patchCount()).toBe(0);
  });

  test("[BVA] content 0 rejected, 1 accepted", async ({ page }) => {
    const stub = await stubCoverLetters(page, { seed: [{}] });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    const field = dialog.getByLabel("Draft", { exact: true });
    await expect(field).toBeVisible({ timeout: 15000 });
    const save = dialog.getByRole("button", { name: "Save changes" });

    await field.fill("");
    await expect(save).toBeDisabled();

    await field.fill("x");
    await expect(save).toBeEnabled();
    await save.click();
    await expect.poll(() => stub.patchCount()).toBe(1);
  });

  test("[BVA] content is capped at the server maximum", async ({ page }) => {
    await stubCoverLetters(page, { seed: [{}] });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    const field = dialog.getByLabel("Draft", { exact: true });
    await expect(field).toBeVisible({ timeout: 15000 });

    // The field refuses to hold more than the server would accept, so a
    // guaranteed-400 request is never even composed.
    await field.fill("a".repeat(MAX + 1));
    const value = await field.inputValue();
    expect(value.length).toBe(MAX);
  });

  test("[BVA] draft count 0 / 1 / 2 — comparison only becomes possible at 2", async ({
    page
  }) => {
    await stubCoverLetters(page);
    await openLetterModal(page);
    const dialog = letterDialog(page);

    // 0
    await expect(
      dialog.getByText("No drafts yet.", { exact: false })
    ).toBeVisible();

    // 1
    await dialog.getByRole("button", { name: /Generate/ }).click();
    await expect(draftRow(dialog, "Formal · Standard · English")).toHaveCount(
      1,
      {
        timeout: 15000
      }
    );

    // 2 — two entries to switch between
    await segmentedOption(dialog, "Friendly").click();
    await dialog.getByRole("button", { name: /Generate/ }).click();
    await expect(draftRow(dialog, "Friendly · Standard · English")).toHaveCount(
      1,
      { timeout: 15000 }
    );
    await expect(draftRow(dialog, "Formal · Standard · English")).toHaveCount(
      1
    );
  });
});
