import { expect, test } from "@/fixtures";

// Where the generator can be opened from (REQ-COVERLETTERGENERATOR-01): only a succeeded result card of a signed-in
// user. Runs are seeded in the DB and reopened with /wizard?runId= (the same card Home reopens), so no AI is called.

test.describe("cover letter — entry point", () => {
  test(
    "a succeeded result card opens the cover letter dialog",
    { tag: ["@TC-COVERLETTERGENERATOR-030", "@smoke"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();

      await coverLetterPage.openRun(match.runId);
      await expect(coverLetterPage.writeLetterButton()).toBeVisible();
      const modal = await coverLetterPage.openLetterModal();

      await expect(modal.root()).toBeVisible();
      await expect(modal.title()).toBeVisible();
      await expect(modal.generateButton()).toBeEnabled();
    }
  );

  test(
    "a failed result card offers no cover letter",
    { tag: ["@TC-COVERLETTERGENERATOR-031"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match({ status: "failed", errorCode: "no_quota" });

      await coverLetterPage.openRun(match.runId);

      await expect(coverLetterPage.failedCardAlert("no_quota")).toBeVisible();
      await expect(coverLetterPage.writeLetterButton()).toHaveCount(0);
    }
  );

  test(
    "a result card still running offers no cover letter until its result lands",
    { tag: ["@TC-COVERLETTERGENERATOR-032"] },
    async ({ coverLetterPage, coverLetterSeed, network }) => {
      const match = await coverLetterSeed.match();
      // D1: the re-run's POST /match is stubbed (held back, then a succeeded result); POST /match/runs is real.
      await network.stubJson("**/api/v1/match", coverLetterSeed.matchResultBody(match), {
        method: "POST",
        status: 201,
        delayMs: 4_000,
      });

      await coverLetterPage.openRun(match.runId);
      await coverLetterPage.rerunFromReview();

      await expect(coverLetterPage.pendingCard()).toBeVisible();
      await expect(coverLetterPage.writeLetterButton()).toHaveCount(0);
      await expect(coverLetterPage.writeLetterButton()).toBeVisible({ timeout: 15_000 });
    }
  );

  test(
    "a guest's result card offers no cover letter",
    { tag: ["@TC-COVERLETTERGENERATOR-033"] },
    async ({ page, baseURL, coverLetterPage, coverLetterSeed }) => {
      const { guest, match } = await coverLetterSeed.guestWithMatch();
      // Browse as that guest instead of the signed-in e2e user.
      const [name, value] = guest.cookie.split("=");
      await page.context().clearCookies();
      await page.context().addCookies([{ name, value, domain: new URL(baseURL!).hostname, path: "/" }]);

      await coverLetterPage.openRun(match.runId);

      await expect(coverLetterPage.overallScoreLabel()).toBeVisible();
      await expect(coverLetterPage.writeLetterButton()).toHaveCount(0);
    }
  );
});
