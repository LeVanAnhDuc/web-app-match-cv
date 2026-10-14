import { expect, test } from "@/fixtures";
import { LETTER_BODY, SECOND_LETTER_BODY } from "@/data/test-data/cover-letter-generator";

// Deleting drafts (REQ-COVERLETTERGENERATOR-25): one step, no confirmation, and the editor never keeps a dead id.

test.describe("cover letter — delete", () => {
  test(
    "deleting another draft keeps the open one, without asking for confirmation",
    { tag: ["@TC-COVERLETTERGENERATOR-058"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      const [older] = await coverLetterSeed.letters(match, [
        { tone: "friendly", content: SECOND_LETTER_BODY },
        { tone: "formal", content: LETTER_BODY },
      ]);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);
      await modal.editDraft(`${LETTER_BODY} (unsaved)`);
      const friendly = modal.describe({ tone: "friendly", length: "standard", language: "en" });

      await modal.deleteDraft(modal.draftRowsLike(friendly));

      await expect(modal.draftRows()).toHaveCount(1);
      await expect(modal.draftRowsLike(friendly)).toHaveCount(0);
      await expect(modal.allDialogs()).toHaveCount(1);
      await expect(modal.draftField()).toHaveValue(`${LETTER_BODY} (unsaved)`);
      await expect(modal.openRowButton(modal.draftRows().first())).toHaveAttribute("aria-current", "true");
      expect(await coverLetterSeed.findLetter(older)).toBeNull();
    }
  );

  test(
    "deleting the open draft releases the editor and never saves to the deleted id",
    { tag: ["@TC-COVERLETTERGENERATOR-059"] },
    async ({ coverLetterPage, coverLetterSeed, network }) => {
      const match = await coverLetterSeed.match();
      const id = await coverLetterSeed.letter(match, { content: LETTER_BODY });
      const patches = network.recordRequests("**/api/v1/cover-letters/*", { method: "PATCH" });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);
      await modal.editDraft("Typed, then deleted.");

      await modal.deleteDraft(modal.draftRows().first());

      await expect(modal.draftField()).toHaveCount(0);
      await expect(modal.saveButton()).toHaveCount(0);
      await expect(modal.emptyState()).toBeVisible();
      expect(patches).toHaveLength(0);
      expect(await coverLetterSeed.findLetter(id)).toBeNull();
    }
  );

  test(
    "a failed delete says so and keeps the draft",
    { tag: ["@TC-COVERLETTERGENERATOR-060"] },
    async ({ coverLetterPage, coverLetterSeed, network }) => {
      const match = await coverLetterSeed.match();
      const id = await coverLetterSeed.letter(match, { content: LETTER_BODY });
      await network.failWith("**/api/v1/cover-letters/*", 500, { method: "DELETE" });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);

      await modal.deleteDraft(modal.draftRows().first());

      await expect(modal.errorAlert("delete")).toBeVisible();
      await expect(modal.draftRows()).toHaveCount(1);
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);
      expect(await coverLetterSeed.findLetter(id)).not.toBeNull();
    }
  );
});
