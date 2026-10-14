import { expect, test } from "@/fixtures";
import { LETTER_BODY, LETTER_MAX, MARKUP_BODY, textOfLength } from "@/data/test-data/cover-letter-generator";

// Editing a draft in place, copying and downloading it (REQ-COVERLETTERGENERATOR-21…24). PATCH is the real backend
// except where its failure is the point of the case.

test.describe("cover letter — edit, copy, download", () => {
  test(
    "an edited draft is saved, tagged edited and comes back after a reload",
    { tag: ["@TC-COVERLETTERGENERATOR-051"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      const id = await coverLetterSeed.letter(match, { content: LETTER_BODY });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);

      await modal.editDraft("My own words.");
      await modal.saveDraft();

      await expect(modal.editedTag(modal.draftRows().first())).toBeVisible();
      await expect(modal.saveButton()).toBeDisabled();
      expect((await coverLetterSeed.findLetter(id))?.content).toBe("My own words.");

      await coverLetterPage.openRun(match.runId);
      const reopened = await coverLetterPage.openLetterModal();
      await expect(reopened.draftField()).toHaveValue("My own words.");
      await expect(reopened.editedTag(reopened.draftRows().first())).toBeVisible();
    }
  );

  test(
    "save is enabled only for a changed, non-blank draft and the editor holds at most 20000 characters",
    { tag: ["@TC-COVERLETTERGENERATOR-052"] },
    async ({ coverLetterPage, coverLetterSeed, network }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match, { content: LETTER_BODY });
      const patches = network.recordRequests("**/api/v1/cover-letters/*", { method: "PATCH" });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);

      // unchanged
      await expect(modal.saveButton()).toBeDisabled();
      // empty / whitespace only
      await modal.editDraft("");
      await expect(modal.saveButton()).toBeDisabled();
      await modal.editDraft("   \n ");
      await expect(modal.saveButton()).toBeDisabled();
      // one character
      await modal.editDraft("x");
      await expect(modal.saveButton()).toBeEnabled();
      // back to the stored text = not dirty
      await modal.editDraft(LETTER_BODY);
      await expect(modal.saveButton()).toBeDisabled();
      // over the cap: the field keeps 20000
      await modal.editDraft(textOfLength(LETTER_MAX + 1));
      await expect(modal.draftField()).toHaveValue(textOfLength(LETTER_MAX));
      await expect(modal.saveButton()).toBeEnabled();

      expect(patches).toHaveLength(0);
    }
  );

  test(
    "the letter is plain text: markup is shown as typed",
    { tag: ["@TC-COVERLETTERGENERATOR-053"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match, { content: MARKUP_BODY });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await expect(modal.draftField()).toHaveValue(MARKUP_BODY);
      await expect(modal.boldElements()).toHaveCount(0);
    }
  );

  test(
    "a failed save keeps the text the user typed",
    { tag: ["@TC-COVERLETTERGENERATOR-054"] },
    async ({ coverLetterPage, coverLetterSeed, network }) => {
      const match = await coverLetterSeed.match();
      const id = await coverLetterSeed.letter(match, { content: LETTER_BODY });
      await network.failWith("**/api/v1/cover-letters/*", 500, { method: "PATCH" });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);

      await modal.editDraft("Words I do not want to lose.");
      await modal.saveDraft();

      await expect(modal.errorAlert("save")).toBeVisible();
      await expect(modal.draftField()).toHaveValue("Words I do not want to lose.");
      await expect(modal.saveButton()).toBeEnabled();
      expect((await coverLetterSeed.findLetter(id))?.content).toBe(LETTER_BODY);
    }
  );

  test(
    "copy puts the text on screen on the clipboard",
    { tag: ["@TC-COVERLETTERGENERATOR-055"] },
    async ({ page, baseURL, coverLetterPage, coverLetterSeed }) => {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match, { content: LETTER_BODY });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);

      // Unsaved edits included: Copy takes what the user sees.
      await modal.editDraft("Copied, not yet saved.");
      await modal.copy();

      await expect.poll(() => modal.clipboardText()).toBe("Copied, not yet saved.");
      await expect(modal.errorAlert("copy")).toHaveCount(0);
    }
  );

  test(
    "without a clipboard, copy says to copy by hand",
    { tag: ["@TC-COVERLETTERGENERATOR-056"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toBeVisible();

      await modal.disableClipboard();
      await modal.copy();

      await expect(modal.errorAlert("copy")).toBeVisible();
    }
  );

  test(
    "download saves cover-letter-<id>.txt with the text on screen",
    { tag: ["@TC-COVERLETTERGENERATOR-057"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      const id = await coverLetterSeed.letter(match, { content: LETTER_BODY });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);
      await modal.editDraft(`${LETTER_BODY}\n\nP.S. edited before download.`);

      const file = await modal.download();

      expect(file.filename).toBe(`cover-letter-${id}.txt`);
      expect(file.text).toBe(`${LETTER_BODY}\n\nP.S. edited before download.`);
    }
  );
});
