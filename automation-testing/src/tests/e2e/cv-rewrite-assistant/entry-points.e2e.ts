import { test, expect } from "@/fixtures";

// How a user reaches /cv-rewrite/:id (REQ-01, REQ-02) and who is turned away at the door (REQ-03). Nothing here
// generates, so no AI stub is needed: every request goes to the real backend on rows seeded for the test.

const PAGE_APIS = ["**/api/v1/match/*", "**/api/v1/documents/*", "**/api/v1/ai-credentials**", "**/api/v1/cv-rewrite**"];

test.describe("cv rewrite — entry points", () => {
  test(
    "card kết quả thành công mở trợ lý viết lại",
    { tag: ["@TC-CVREWRITEASSISTANT-032", "@smoke", "@creates-data"] },
    async ({ rewriteData, rewriteWizard, rewritePage, page }) => {
      const succeeded = await rewriteData.match({ withRun: true });
      await rewriteData.match({ documentsOf: succeeded, runId: succeeded.runId!, status: "failed" });

      await rewriteWizard.gotoRun(succeeded.runId!);

      await expect(rewriteWizard.failedCardAlert()).toBeVisible();
      await expect(rewriteWizard.improveButtons()).toHaveCount(1);
      await rewriteWizard.improve();
      expect(new URL(page.url()).pathname).toBe(`/cv-rewrite/${succeeded.matchId}`);
      await expect(rewritePage.heading()).toBeVisible();
      await expect(rewritePage.setupHeading(succeeded.cvTitle)).toBeVisible();
    }
  );

  test(
    "card kết quả của khách không có nút viết lại",
    { tag: ["@TC-CVREWRITEASSISTANT-033", "@creates-data"] },
    async ({ rewriteUsers, rewriteData, rewriteBrowser, rewriteWizard }) => {
      const guest = await rewriteUsers.guest();
      const seed = await rewriteData.match({ userId: guest.userId, withRun: true });
      await rewriteBrowser.as(guest);

      await rewriteWizard.gotoRun(seed.runId!);

      await expect(rewriteWizard.overallLabel().first()).toBeVisible();
      await expect(rewriteWizard.improveButtons()).toHaveCount(0);
    }
  );

  test(
    "mở lại match từ Recent matches thấy đúng một card có nút viết lại",
    { tag: ["@TC-CVREWRITEASSISTANT-034", "@creates-data"] },
    async ({ rewriteData, rewriteHome, rewriteWizard, page }) => {
      // Newest row of the e2e user, so it is inside the five "Recent matches" rows whatever else the DB holds.
      const seed = await rewriteData.match({ createdAt: new Date(Date.now() + 60 * 60 * 1000) });

      await rewriteHome.goto();
      await rewriteHome.openMatch(seed.cvTitle, seed.jdTitle);

      await expect(rewriteWizard.overallLabel()).toHaveCount(1);
      await expect(rewriteWizard.improveButtons()).toHaveCount(1);
      await rewriteWizard.improve();
      expect(new URL(page.url()).pathname).toBe(`/cv-rewrite/${seed.matchId}`);
    }
  );

  test(
    "người chưa đăng nhập mở thẳng trang thấy cổng đăng nhập",
    { tag: ["@TC-CVREWRITEASSISTANT-035", "@smoke", "@creates-data"] },
    async ({ rewriteData, rewriteBrowser, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await rewriteBrowser.signOut();
      const recorders = PAGE_APIS.map((url) => network.recordRequests(url));

      await rewritePage.goto(seed.matchId);

      await expect(rewritePage.gateHeading()).toBeVisible();
      await expect(rewritePage.gateDescription()).toBeVisible();
      await expect(rewritePage.heading()).toHaveCount(0);
      await expect(rewritePage.generateButton()).toHaveCount(0);
      expect(recorders.flat().map((c) => `${c.method} ${c.url}`)).toEqual([]);
    }
  );

  test(
    "khách mở thẳng trang thấy cổng đăng nhập",
    { tag: ["@TC-CVREWRITEASSISTANT-036", "@creates-data"] },
    async ({ rewriteUsers, rewriteData, rewriteBrowser, rewritePage, network }) => {
      const guest = await rewriteUsers.guest();
      const seed = await rewriteData.match({ userId: guest.userId });
      await rewriteBrowser.as(guest);
      const recorders = PAGE_APIS.map((url) => network.recordRequests(url));

      await rewritePage.goto(seed.matchId);

      await expect(rewritePage.gateHeading()).toBeVisible();
      await expect(rewritePage.gateDescription()).toBeVisible();
      await expect(rewritePage.heading()).toHaveCount(0);
      expect(recorders.flat().map((c) => `${c.method} ${c.url}`)).toEqual([]);
    }
  );
});
