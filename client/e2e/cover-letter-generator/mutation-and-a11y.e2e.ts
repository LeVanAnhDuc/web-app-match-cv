import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  deleteDraftButton,
  draftRow,
  letterDialog,
  openLetterButton,
  openLetterModal,
  resetLetters,
  segmentedOption,
  stubCoverLetters
} from "./helpers";

// Matrix rows 11 (mutation safety, incl. an invalid transition) and 12 (a11y).

test.describe("cover letter — mutation safety and accessibility", () => {
  test.beforeEach(async () => {
    await resetLetters();
    await cleanDocuments();
  });

  test.afterAll(async () => {
    await resetLetters();
  });

  test("[ST] generate → edit → generate again → delete", async ({ page }) => {
    const stub = await stubCoverLetters(page);
    await openLetterModal(page);
    const dialog = letterDialog(page);

    // generate
    await dialog.getByRole("button", { name: /Generate/ }).click();
    const first = draftRow(dialog, "Formal · Standard · English");
    await expect(first).toHaveCount(1, { timeout: 15000 });

    // edit + save → the row is marked as hand-edited
    await dialog.getByLabel("Draft", { exact: true }).fill("My own words.");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByText("Edited")).toBeVisible({ timeout: 15000 });

    // generate again → the edited one survives untouched
    await segmentedOption(dialog, "Friendly").click();
    await dialog.getByRole("button", { name: /Generate/ }).click();
    await expect(draftRow(dialog, "Friendly · Standard · English")).toHaveCount(
      1,
      { timeout: 15000 }
    );
    await expect(dialog.getByText("Edited")).toBeVisible();

    // delete the newer one → the edited one is still there
    await deleteDraftButton(dialog, "Friendly · Standard · English").click();
    await expect(draftRow(dialog, "Friendly · Standard · English")).toHaveCount(
      0,
      { timeout: 15000 }
    );
    await expect(dialog.getByText("Edited")).toBeVisible();
    expect(stub.deleteCount()).toBe(1);
  });

  // Invalid transition: acting on a row that no longer exists.
  test("[ST invalid] deleting the draft being edited clears the editor", async ({
    page
  }) => {
    const stub = await stubCoverLetters(page, { seed: [{}] });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await expect(dialog.getByLabel("Draft", { exact: true })).toBeVisible({
      timeout: 15000
    });
    const patchesBefore = stub.patchCount();

    await deleteDraftButton(dialog, "Formal · Standard · English").click();

    // The editor must let go rather than keep offering to PATCH a dead id.
    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveCount(0, {
      timeout: 15000
    });
    await expect(
      dialog.getByText("No drafts yet.", { exact: false })
    ).toBeVisible();
    expect(stub.patchCount()).toBe(patchesBefore);
  });

  test("[11] double-clicking Generate fires exactly one request", async ({
    page
  }) => {
    const stub = await stubCoverLetters(page, { generateDelayMs: 2000 });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    const generate = dialog.getByRole("button", { name: /Generate/ });
    await generate.click();
    // The button goes into its loading state, so the second click is a no-op.
    await generate.click({ force: true });

    await expect(dialog.getByLabel("Draft", { exact: true })).toBeVisible({
      timeout: 20000
    });
    expect(stub.postCount()).toBe(1);
  });

  test("[12] the modal is keyboard-operable and labelled", async ({ page }) => {
    await stubCoverLetters(page, { seed: [{}] });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    // Each option group carries an accessible name.
    await expect(dialog.getByRole("group", { name: "Tone" })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Length" })).toBeVisible();
    await expect(
      dialog.getByRole("group", { name: "Letter language" })
    ).toBeVisible();
    // The editor is reachable by its label, not by a CSS selector.
    await expect(dialog.getByLabel("Draft", { exact: true })).toBeVisible({
      timeout: 15000
    });

    // Esc closes it, and the trigger is still there to reopen. The key is
    // pressed on an element INSIDE the modal so the event bubbles to the
    // wrapper antd listens on, rather than landing on the document.
    await dialog.getByLabel("Draft", { exact: true }).press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openLetterButton(page)).toBeVisible();
  });
});
