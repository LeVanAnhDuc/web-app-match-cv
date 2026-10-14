import { randomUUID } from "node:crypto";
import { t } from "@/data/copy";
import { expect, test } from "@/fixtures";

// Load errors and the loading state of /compare (REQ-CVVERSIONCOMPARISON-20). 404 / 400 come from the real server;
// only 5xx, a dropped connection and a slow response are produced in the browser (decision Q1 = a).

const COMPARISONS = "**/api/v1/comparisons/**";

test.describe("cv-version-comparison — errors and loading", () => {
  test(
    "CV không tồn tại báo không tìm thấy và có nút về thư viện",
    { tag: ["@TC-CVVERSIONCOMPARISON-053"] },
    async ({ versionComparePage, page }) => {
      await versionComparePage.goto(randomUUID());

      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.notFound"));
      await versionComparePage.backToLibraryButton().click();
      await expect(page).toHaveURL(/\/cv$/);
    }
  );

  test(
    "CV chưa khai bản trước báo rõ lý do",
    { tag: ["@TC-CVVERSIONCOMPARISON-054"] },
    async ({ versionComparePage, cvcSeed }) => {
      const root = await cvcSeed.cv();

      await versionComparePage.goto(root);

      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.noParent"));
      await expect(versionComparePage.backToLibraryButton()).toBeVisible();
    }
  );

  test(
    "JD được ghim nhưng không so được thì báo đúng lý do",
    { tag: ["@TC-CVVERSIONCOMPARISON-055"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();
      const unmatched = await cvcSeed.jd();

      await versionComparePage.goto(v2, unmatched);

      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.jdNotComparable"));
      await expect(versionComparePage.backToLibraryButton()).toBeVisible();
    }
  );

  test(
    "lỗi server hoặc mất kết nối hiện thông báo chung, không trang trắng",
    { tag: ["@TC-CVVERSIONCOMPARISON-056"] },
    async ({ versionComparePage, cvcSeed, network }) => {
      const { v2 } = await cvcSeed.happyPair();

      await network.failWith(COMPARISONS, 500);
      await versionComparePage.goto(v2);
      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.failed"));
      await expect(versionComparePage.backToLibraryButton()).toBeVisible();

      await network.clear();
      await network.abort(COMPARISONS);
      await versionComparePage.goto(v2);
      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.failed"));
      await expect(versionComparePage.heading()).toBeVisible();
    }
  );

  test(
    "đang tải hiện skeleton aria-busy rồi kết quả trong vùng aria-live",
    { tag: ["@TC-CVVERSIONCOMPARISON-057"] },
    async ({ versionComparePage, cvcSeed, network }) => {
      const { v2 } = await cvcSeed.happyPair();
      // The real body, only delayed, so the loading state is observable.
      const real = await cvcSeed.api.comparisons.get(v2);
      await network.stubJson(COMPARISONS, real.json(), { delayMs: 2_000 });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.busyRegion()).toBeVisible();
      await expect(versionComparePage.liveRegion()).toContainText(t("result.overall"));
      await expect(versionComparePage.busyRegion()).toHaveCount(0);
    }
  );

  test(
    "JD được ghim trên CV chưa có bản trước vẫn báo là chưa có bản trước",
    { tag: ["@TC-CVVERSIONCOMPARISON-058"] },
    async ({ versionComparePage, cvcSeed }) => {
      // BUG: defects/cv-version-comparison.md#bug-cvversioncomparison-03
      test.fail();
      const root = await cvcSeed.cv();
      const jd = await cvcSeed.jd();
      await cvcSeed.match(root, jd);

      await versionComparePage.goto(root, jd);

      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.noParent"));
    }
  );

  test(
    "mở so sánh bằng id của JD không bị báo nhầm là chưa có bản trước",
    { tag: ["@TC-CVVERSIONCOMPARISON-059"] },
    async ({ versionComparePage, cvcSeed }) => {
      // BUG: defects/cv-version-comparison.md#bug-cvversioncomparison-03
      test.fail();
      const jd = await cvcSeed.jd();

      await versionComparePage.goto(jd);

      await expect(versionComparePage.errorMessage()).toBeVisible();
      await expect(versionComparePage.errorMessage()).not.toHaveText(t("compare.err.noParent"));
      await expect(versionComparePage.errorMessage()).not.toHaveText(t("compare.err.jdNotComparable"));
    }
  );
});
