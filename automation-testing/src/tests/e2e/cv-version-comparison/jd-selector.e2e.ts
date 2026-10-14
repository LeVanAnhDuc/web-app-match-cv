import { expect, test } from "@/fixtures";
import type { CvcSeed } from "@/fixtures/modules/cv-version-comparison.fixture";

// The job-description selector, the URL as source of truth, and the promise that browsing never spends an AI call
// (REQ-CVVERSIONCOMPARISON-11/14/28).

/** v1 → v2 matched on two JDs: `older` (+10 everywhere) and `newer` (the happy +14/+8/+23), both complete. */
async function twoJdPair(seed: CvcSeed) {
  const v1 = await seed.cv();
  const v2 = await seed.cv({ parentId: v1 });
  const olderTitle = seed.title("Older JD");
  const newerTitle = seed.title("Newer JD");
  const older = await seed.jd({ title: olderTitle });
  const newer = await seed.jd({ title: newerTitle });
  await seed.match(v1, older, { scores: [40, 40, 40] });
  await seed.match(v2, older, { scores: [50, 50, 50] });
  await seed.match(v1, newer, { scores: [61, 70, 48] });
  await seed.match(v2, newer, { scores: [75, 78, 71] });
  return { v2, older, newer, olderTitle, newerTitle };
}

test.describe("cv-version-comparison — job description selector", () => {
  test(
    "đổi JD ghi vào URL và giữ nguyên sau khi tải lại",
    { tag: ["@TC-CVVERSIONCOMPARISON-050"] },
    async ({ versionComparePage, cvcSeed, network, page }) => {
      const { v2, older, olderTitle, newerTitle } = await twoJdPair(cvcSeed);
      const comparisons = network.recordRequests("**/api/v1/comparisons/**");

      await versionComparePage.goto(v2);
      await expect(versionComparePage.jdTitle(newerTitle).first()).toBeVisible();
      await expect(versionComparePage.deltaValues()).toHaveText(["+14", "+8", "+23"]);

      await versionComparePage.chooseJd(olderTitle);
      await expect(page).toHaveURL(new RegExp(`[?&]jd=${older}$`));
      await expect(versionComparePage.deltaValues()).toHaveText(["+10", "+10", "+10"]);

      await page.reload();
      await expect(page).toHaveURL(new RegExp(`[?&]jd=${older}$`));
      await expect(versionComparePage.jdTitle(olderTitle).first()).toBeVisible();
      await expect(versionComparePage.deltaValues()).toHaveText(["+10", "+10", "+10"]);
      // The server, not the client, is asked about that job description.
      expect(comparisons.some((request) => request.url.includes(`jdDocumentId=${older}`))).toBe(true);
    }
  );

  test(
    "mở thẳng link có jd thì JD đó được chọn sẵn",
    { tag: ["@TC-CVVERSIONCOMPARISON-051"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2, older, olderTitle } = await twoJdPair(cvcSeed);

      await versionComparePage.goto(v2, older);

      await expect(versionComparePage.jdTitle(olderTitle).first()).toBeVisible();
      await expect(versionComparePage.deltaValues()).toHaveText(["+10", "+10", "+10"]);
    }
  );

  test(
    "duyệt màn so sánh không bao giờ gửi request match",
    { tag: ["@TC-CVVERSIONCOMPARISON-052", "@smoke"] },
    async ({ versionComparePage, cvcSeed, network, page }) => {
      const forbidden = network.recordRequests(/\/api\/v1\/(match|cv-rewrite)/, { method: "POST" });
      // Defence in depth (D1): even a regression could not reach a provider from this test.
      await network.failWith(/\/api\/v1\/(match|cv-rewrite)/, 500, { method: "POST" });
      const { v2, olderTitle, older } = await twoJdPair(cvcSeed);

      await versionComparePage.goto(v2);
      await expect(versionComparePage.versionLabel(2)).toBeVisible();
      await versionComparePage.chooseJd(olderTitle);
      await expect(page).toHaveURL(new RegExp(`[?&]jd=${older}$`));
      await page.reload();
      await expect(versionComparePage.versionLabel(2)).toBeVisible();

      expect(forbidden).toEqual([]);
    }
  );

  test(
    "Select JD dùng được bằng bàn phím và Tab đi tiếp tới nút hành động",
    { tag: ["@TC-CVVERSIONCOMPARISON-070"] },
    async ({ versionComparePage, cvcSeed, page }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const completeTitle = cvcSeed.title("Complete JD");
      const complete = await cvcSeed.jd({ title: completeTitle });
      const halfTitle = cvcSeed.title("Half JD");
      const half = await cvcSeed.jd({ title: halfTitle });
      await cvcSeed.match(v1, complete);
      await cvcSeed.match(v2, complete);
      await cvcSeed.match(v2, half); // newest → listed first; only the new version was matched on it

      await versionComparePage.goto(v2);
      await expect(versionComparePage.jdTitle(completeTitle).first()).toBeVisible();
      // Options: [half, complete]; the active option starts on the selected one.
      await versionComparePage.openJdSelect();
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`[?&]jd=${half}$`));

      await versionComparePage.goto(v2, half);
      await expect(versionComparePage.missingAlert("base")).toBeVisible();
      await versionComparePage.jdSelect().focus();
      await page.keyboard.press("Tab");
      await expect(versionComparePage.matchThisVersionButton()).toBeFocused();
    }
  );
});
