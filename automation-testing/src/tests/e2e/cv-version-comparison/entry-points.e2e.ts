import { t } from "@/data/copy";
import { expect, test } from "@/fixtures";

// Where a comparison is opened from, and who may open it (REQ-CVVERSIONCOMPARISON-01/02/03). Every test seeds its own
// user and rows (cvcSeed) and the browser is signed in as that user by the page fixtures.

test.describe("cv-version-comparison — entry points", () => {
  test(
    "thư viện CV chỉ mời so sánh ở CV có bản trước và mở đúng trang so sánh",
    { tag: ["@TC-CVVERSIONCOMPARISON-032", "@smoke"] },
    async ({ versionLibraryPage, versionComparePage, cvcSeed, page }) => {
      const { v2, titles } = await cvcSeed.happyPair();
      await versionLibraryPage.goto("cv");

      await versionLibraryPage.openActions(titles.v1);
      await expect(versionLibraryPage.setLineageItem()).toBeVisible();
      await expect(versionLibraryPage.compareItem()).toHaveCount(0);
      await versionLibraryPage.closeActions();

      await versionLibraryPage.openActions(titles.v2);
      await expect(versionLibraryPage.setLineageItem()).toBeVisible();
      await versionLibraryPage.openCompare(titles.v2);

      await expect(page).toHaveURL(new RegExp(`/compare/${v2}$`));
      await expect(versionComparePage.versionLabel(1)).toBeVisible();
      await expect(versionComparePage.versionLabel(2)).toBeVisible();
    }
  );

  test(
    "thư viện JD không bao giờ mời so sánh, kể cả JD có bản trước",
    { tag: ["@TC-CVVERSIONCOMPARISON-033"] },
    async ({ versionLibraryPage, cvcSeed }) => {
      const oldTitle = cvcSeed.title("Platform JD v1");
      const newTitle = cvcSeed.title("Platform JD v2");
      const j1 = await cvcSeed.jd({ title: oldTitle });
      await cvcSeed.jd({ title: newTitle, parentId: j1 });
      await versionLibraryPage.goto("jd");

      for (const title of [oldTitle, newTitle]) {
        await versionLibraryPage.openActions(title);
        await expect(versionLibraryPage.setLineageItem()).toBeVisible();
        await expect(versionLibraryPage.compareItem()).toHaveCount(0);
        await versionLibraryPage.closeActions();
      }
    }
  );

  test(
    "card kết quả step 4 của CV có bản trước mời so sánh, đứng cuối, mở kèm JD",
    { tag: ["@TC-CVVERSIONCOMPARISON-034"] },
    async ({ versionWizardPage, versionComparePage, cvcSeed, network, page }) => {
      const matches = network.recordRequests("**/api/v1/match", { method: "POST" });
      await network.failWith("**/api/v1/match", 500, { method: "POST" });
      const { v2, jd, titles } = await cvcSeed.happyPair();
      const runId = await cvcSeed.run(v2, jd);
      await cvcSeed.match(v2, jd, { scores: [80, 80, 80], runId });

      await versionWizardPage.gotoRun(runId);

      await expect(versionWizardPage.compareButton()).toBeVisible();
      // Improve and cover letter (always there) first, the conditional comparison last.
      await expect(versionWizardPage.resultActions()).toHaveText([
        t("action.improveCv"),
        t("coverLetter.open"),
        t("action.compareVersions"),
      ]);
      await versionWizardPage.compareButton().click();

      await expect(page).toHaveURL(new RegExp(`/compare/${v2}\\?jd=${jd}$`));
      await expect(versionComparePage.jdTitle(titles.jd).first()).toBeVisible();
      expect(matches).toEqual([]);
    }
  );

  test(
    "card kết quả step 4 không có nút so sánh khi CV chưa có bản trước hoặc người xem là khách",
    { tag: ["@TC-CVVERSIONCOMPARISON-035"] },
    async ({ versionWizardPage, cvcSeed, cvcSignIn, network }) => {
      await network.failWith("**/api/v1/match", 500, { method: "POST" });
      const root = await cvcSeed.cv();
      const jd = await cvcSeed.jd();
      const runId = await cvcSeed.run(root, jd);
      await cvcSeed.match(root, jd, { runId });

      await versionWizardPage.gotoRun(runId);
      await expect(versionWizardPage.coverLetterButton()).toBeVisible();
      await expect(versionWizardPage.compareButton()).toHaveCount(0);

      // A guest whose CV does have a previous version still gets no action at all.
      const guest = await cvcSeed.guest();
      const g1 = await cvcSeed.cv({ owner: guest.userId });
      const g2 = await cvcSeed.cv({ owner: guest.userId, parentId: g1 });
      const gJd = await cvcSeed.jd({ owner: guest.userId });
      const guestRun = await cvcSeed.run(g2, gJd, guest.userId);
      await cvcSeed.match(g2, gJd, { owner: guest.userId, runId: guestRun });
      await cvcSignIn(guest.cookie);

      await versionWizardPage.gotoRun(guestRun);
      await expect(versionWizardPage.signedOutResultMarker().first()).toBeVisible();
      await expect(versionWizardPage.compareButton()).toHaveCount(0);
    }
  );

  test(
    "người chưa đăng nhập thấy cổng đăng nhập và không có request so sánh nào",
    { tag: ["@TC-CVVERSIONCOMPARISON-036", "@smoke"] },
    async ({ versionComparePage, cvcSeed, cvcSignIn, network }) => {
      const { v2 } = await cvcSeed.happyPair();
      const comparisons = network.recordRequests("**/api/v1/comparisons/**");
      await cvcSignIn(undefined);

      await versionComparePage.goto(v2);

      await expect(versionComparePage.signInGate()).toBeVisible();
      await expect(versionComparePage.heading()).toHaveCount(0);
      expect(comparisons).toEqual([]);
    }
  );
});
