import { expect, test } from "@/fixtures";
import { LETTER_BODY, SECOND_LETTER_BODY } from "@/data/test-data/cover-letter-generator";

// Generating letters (REQ-COVERLETTERGENERATOR-10, -11, -14, -17, -18, -19). POST /cover-letters is stubbed (D1):
// coverLetterAi writes the row the server would have written, so the list, edit and delete calls stay real.

test.describe("cover letter — generate", () => {
  test(
    "generating puts the letter in the editor and saves it to the list",
    { tag: ["@TC-COVERLETTERGENERATOR-039", "@smoke"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      await coverLetterAi.stubGenerate({ content: LETTER_BODY });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      const description = modal.describe({ tone: "formal", length: "standard", language: "en" });

      await modal.generate();

      await expect(modal.draftField()).toHaveValue(LETTER_BODY);
      await expect(modal.draftRows()).toHaveCount(1);
      await expect(modal.draftRowsLike(description)).toHaveCount(1);
      await expect(modal.emptyState()).toHaveCount(0);

      // Stored without a "save" step: a fresh page shows it again.
      await coverLetterPage.openRun(match.runId);
      const reopened = await coverLetterPage.openLetterModal();
      await expect(reopened.draftField()).toHaveValue(LETTER_BODY);
    }
  );

  test(
    "a second draft does not replace the first, and each row reopens its own text",
    { tag: ["@TC-COVERLETTERGENERATOR-040"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match, { content: LETTER_BODY });
      await coverLetterAi.stubGenerate({ content: SECOND_LETTER_BODY });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      const first = modal.describe({ tone: "formal", length: "standard", language: "en" });
      const second = modal.describe({ tone: "friendly", length: "short", language: "vi" });
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);

      await modal.chooseOptions({ tone: "friendly", length: "short", language: "vi" });
      await modal.generate();

      await expect(modal.draftRows()).toHaveCount(2);
      await expect(modal.draftField()).toHaveValue(SECOND_LETTER_BODY);
      await expect(modal.draftRows().first()).toContainText(second);
      await expect(modal.draftRows().nth(1)).toContainText(first);

      await modal.openDraft(modal.draftRowsLike(first));
      await expect(modal.draftField()).toHaveValue(LETTER_BODY);
      await modal.openDraft(modal.draftRowsLike(second));
      await expect(modal.draftField()).toHaveValue(SECOND_LETTER_BODY);
    }
  );

  test(
    "while generating the draft area is busy, and a double click sends one request",
    { tag: ["@TC-COVERLETTERGENERATOR-041"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      await coverLetterAi.stubGenerate({ delayMs: 3_000 });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await modal.generateButton().dblclick();

      await expect(modal.draftRegion()).toHaveAttribute("aria-busy", "true");
      await expect(modal.draftField()).toBeVisible({ timeout: 15_000 });
      await expect(modal.draftRegion()).toHaveAttribute("aria-busy", "false");
      expect(coverLetterAi.requests).toHaveLength(1);
      await expect(modal.draftRows()).toHaveCount(1);
    }
  );

  test(
    "a provider failure shows a translated error with try again, not an empty letter",
    { tag: ["@TC-COVERLETTERGENERATOR-042"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      await coverLetterAi.stubGenerate({ failWith: "no_quota" });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await modal.generate();

      await expect(modal.failureAlert("no_quota")).toBeVisible();
      await expect(modal.tryAgainButton()).toBeVisible();
      await expect(modal.draftField()).toHaveCount(0);
      await expect(modal.copyButton()).toHaveCount(0);
      await expect(modal.saveButton()).toHaveCount(0);
      await expect(modal.exactText("no_quota")).toHaveCount(0);
      await expect(modal.failedTag(modal.draftRows().first())).toBeVisible();
    }
  );

  test(
    "try again regenerates with the failed draft's own options",
    { tag: ["@TC-COVERLETTERGENERATOR-043"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match, {
        tone: "friendly",
        length: "short",
        language: "vi",
        status: "failed",
        errorCode: "timeout",
      });
      await coverLetterAi.stubGenerate();
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.failureAlert("timeout")).toBeVisible();

      await modal.tryAgainButton().click();

      await expect(modal.draftRows()).toHaveCount(2);
      expect(coverLetterAi.requests[0]).toMatchObject({ tone: "friendly", length: "short", language: "vi" });
    }
  );

  test(
    "a rejected generate request says so and adds no draft",
    { tag: ["@TC-COVERLETTERGENERATOR-044"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      // 503 is what the server answers when the system key / encryption key is not configured.
      await coverLetterAi.stubGenerate({ httpStatus: 503 });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await modal.generate();

      await expect(modal.errorAlert("generate")).toBeVisible();
      await expect(modal.emptyState()).toBeVisible();
      await expect(modal.draftRows()).toHaveCount(0);
    }
  );
});
