import { expect, test } from "@/fixtures";
import { LETTER_ERROR_CODES, OMITTED } from "@/data/test-data/cover-letter-generator";

// The saved-drafts list and what a draft shows (REQ-COVERLETTERGENERATOR-15, -17, -19, -20). Drafts are seeded in the
// DB; GET /cover-letters is the real backend except where a failure is the point of the case.

test.describe("cover letter — saved drafts", () => {
  test(
    "with no drafts yet the dialog shows a meaningful empty state",
    { tag: ["@TC-COVERLETTERGENERATOR-045"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await expect(modal.draftsHeading()).toBeVisible();
      await expect(modal.emptyState()).toBeVisible();
      await expect(modal.draftRows()).toHaveCount(0);
      await expect(modal.draftField()).toHaveCount(0);
    }
  );

  test(
    "rows read as human labels with edited and failed tags, and the newest is open",
    { tag: ["@TC-COVERLETTERGENERATOR-046"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letters(match, [
        { tone: "formal", length: "standard", language: "en", edited: true, content: "Edited by hand." },
        { tone: "friendly", length: "short", language: "vi", status: "failed", errorCode: "timeout" },
        { tone: "formal", length: "short", language: "en", content: "Newest letter." },
      ]);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      const rows = modal.draftRows();

      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText(modal.describe({ tone: "formal", length: "short", language: "en" }));
      await expect(rows.nth(1)).toContainText(modal.describe({ tone: "friendly", length: "short", language: "vi" }));
      await expect(rows.nth(2)).toContainText(modal.describe({ tone: "formal", length: "standard", language: "en" }));
      await expect(modal.exactText("friendly · short · vi")).toHaveCount(0);

      await expect(modal.failedTag(rows.nth(1))).toBeVisible();
      await expect(modal.editedTag(rows.nth(2))).toBeVisible();
      await expect(modal.editedTag(rows.nth(0))).toHaveCount(0);
      await expect(modal.failedTag(rows.nth(0))).toHaveCount(0);

      // The newest draft is loaded on open and marked current.
      await expect(modal.draftField()).toHaveValue("Newest letter.");
      await expect(modal.openRowButton(rows.nth(0))).toHaveAttribute("aria-current", "true");
      await expect(modal.openRowButton(rows.nth(2))).not.toHaveAttribute("aria-current", "true");

      await modal.openDraft(rows.nth(2));
      await expect(modal.draftField()).toHaveValue("Edited by hand.");
      await expect(modal.openRowButton(rows.nth(2))).toHaveAttribute("aria-current", "true");
      await expect(modal.openRowButton(rows.nth(0))).not.toHaveAttribute("aria-current", "true");
    }
  );

  test(
    "each row shows when the draft was generated, so drafts with the same options can be told apart",
    { tag: ["@TC-COVERLETTERGENERATOR-047"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      // BUG: defects/cover-letter-generator.md#bug-coverlettergenerator-02
      test.fail();
      const match = await coverLetterSeed.match();
      const now = Date.now();
      await coverLetterSeed.letter(match, { createdAt: new Date(now - 26 * 3_600_000) });
      await coverLetterSeed.letter(match, { createdAt: new Date(now - 60_000) });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      const rows = modal.draftRows();
      await expect(rows).toHaveCount(2);

      const first = (await modal.openRowButton(rows.nth(0)).innerText()).trim();
      const second = (await modal.openRowButton(rows.nth(1)).innerText()).trim();
      expect(first).not.toBe(second);
      expect(first).toMatch(/\d/);
      expect(second).toMatch(/\d/);
    }
  );

  test(
    "the requirements a letter does not claim are listed, and the block is hidden when there are none",
    { tag: ["@TC-COVERLETTERGENERATOR-048"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letters(match, [
        { tone: "friendly", omittedRequirements: [] },
        { tone: "formal", omittedRequirements: OMITTED },
      ]);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await expect(modal.omittedTitle()).toBeVisible();
      await expect(modal.omittedHint()).toBeVisible();
      for (const item of OMITTED) await expect(modal.omittedItem(item)).toBeVisible();

      await modal.openDraft(modal.draftRowsLike(modal.describe({ tone: "friendly", length: "standard", language: "en" })));
      await expect(modal.draftField()).toBeVisible();
      await expect(modal.omittedTitle()).toHaveCount(0);
      await expect(modal.omittedHint()).toHaveCount(0);
    }
  );

  test(
    "every failure code reads as a translated message, never a raw code or null",
    { tag: ["@TC-COVERLETTERGENERATOR-049"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letters(match, [
        { content: "A letter that worked." },
        ...LETTER_ERROR_CODES.map((errorCode) => ({ status: "failed" as const, errorCode })),
      ]);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      const rows = modal.draftRows();
      await expect(rows).toHaveCount(LETTER_ERROR_CODES.length + 1);

      // Newest first: the codes in reverse, then the succeeded letter.
      const newestFirst = [...LETTER_ERROR_CODES].reverse();
      for (const [index, code] of newestFirst.entries()) {
        await modal.openDraft(rows.nth(index));
        await expect(modal.failureAlert(code)).toBeVisible();
        await expect(modal.exactText(code)).toHaveCount(0);
      }

      await modal.openDraft(rows.nth(LETTER_ERROR_CODES.length));
      await expect(modal.draftField()).toHaveValue("A letter that worked.");
      await expect(modal.exactText("null")).toHaveCount(0);
      await expect(modal.alerts()).toHaveCount(0);
    }
  );

  test(
    "a failed drafts request shows an error instead of an empty list",
    { tag: ["@TC-COVERLETTERGENERATOR-050"] },
    async ({ coverLetterPage, coverLetterSeed, network }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match);
      await network.failWith("**/api/v1/cover-letters*", 500, { method: "GET" });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      // React Query retries a failed GET three times (~7 s) before it reports the error.
      await expect(modal.errorAlert("list")).toBeVisible({ timeout: 20_000 });
      await expect(modal.emptyState()).toHaveCount(0);
      await expect(modal.draftRows()).toHaveCount(0);
    }
  );
});
