import { expect, test } from "@playwright/test";
import {
  STUB_COMPARISON,
  V2_ID,
  gotoCompare,
  setLanguage,
  stubComparison
} from "./helpers";

// design.md §7 rows 4 (validation), 5 (empty/null), 6 (boundary),
// 8 (data rendering) and 9 (i18n).

test.describe("cv-version-comparison — validation, edges and rendering", () => {
  test("[EP] a CV with no declared previous version is named, not blanked", async ({
    page
  }) => {
    await stubComparison(page, { status: 400 });
    await gotoCompare(page);

    await expect(page.getByRole("alert")).toContainText(
      /not marked as a new version/
    );
    await expect(
      page.getByRole("button", { name: "Back to the library" })
    ).toBeVisible();
  });

  test("[EP] a stale pinned job description is reported as such", async ({
    page
  }) => {
    await stubComparison(page, { status: 400 });
    await gotoCompare(page, V2_ID, "?jd=99999999-9999-9999-9999-999999999999");

    // Different sentence from the "no previous version" 400 above.
    await expect(page.getByRole("alert")).toContainText(
      /Neither version has been matched against that job description/
    );
  });

  test("[EP] an unknown CV says so instead of failing generically", async ({
    page
  }) => {
    await stubComparison(page, { status: 404 });
    await gotoCompare(page);

    await expect(page.getByRole("alert")).toContainText(/doesn't exist/);
  });

  test("[EP] a version that was never matched gets a call to action, not zeroes", async ({
    page
  }) => {
    await stubComparison(page, {
      revisionResult: null,
      delta: null,
      gapDiff: null,
      jdOptions: [
        {
          id: STUB_COMPARISON.jdOptions[0].id,
          title: "Senior Backend Engineer",
          hasBase: true,
          hasRevision: false
        }
      ]
    });
    await gotoCompare(page);

    await expect(
      page.getByRole("button", { name: "Match this version" })
    ).toBeVisible();
    // The dangerous rendering: a 0 → 0 (0) table reading as "no improvement".
    await expect(page.getByText("+14")).toHaveCount(0);
    await expect(page.getByTestId("score-before")).toHaveCount(0);
    // And it says out loud that opening this page never sent the CV anywhere.
    await expect(page.getByText(/never runs a match on its own/)).toBeVisible();
  });

  test("[EP] neither version matched at all → an empty state with a way forward", async ({
    page
  }) => {
    await stubComparison(page, {
      jdDocumentId: null,
      jdOptions: [],
      baseResult: null,
      revisionResult: null,
      delta: null,
      gapDiff: null
    });
    await gotoCompare(page);

    await expect(
      page.getByText("Neither version has been matched yet")
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Job description" })
    ).toHaveCount(0);
  });

  test("[EP] empty gap buckets are labelled rather than left blank", async ({
    page
  }) => {
    await stubComparison(page, {
      gapDiff: { closed: [], persisted: [], introduced: [] }
    });
    await gotoCompare(page);

    await expect(page.getByText("None")).toHaveCount(3);
  });

  test("[BVA] a zero delta is not dressed up as an improvement", async ({
    page
  }) => {
    await stubComparison(page, {
      delta: { overall: 0, semantic: -1, keyword: 1 }
    });
    await gotoCompare(page);

    const values = page.getByTestId("delta-value");
    await expect(values).toHaveText(["0", "-1", "+1"]);
    await expect(page.getByText("+0")).toHaveCount(0);
  });

  test("[BVA] a three-generation chain reads as 2 → 3, not 1 → 2", async ({
    page
  }) => {
    await stubComparison(page, {
      base: { ...STUB_COMPARISON.base, version: 2 },
      revision: { ...STUB_COMPARISON.revision, version: 3 }
    });
    await gotoCompare(page);

    await expect(page.getByText("Version 2")).toBeVisible();
    await expect(page.getByText("Version 3")).toBeVisible();
    await expect(page.getByText("Version 1")).toHaveCount(0);
  });

  test("[EP] gap text is rendered as text, never as markup", async ({
    page
  }) => {
    const hostile = "<script>window.__pwned = 1</script>Missing Docker";
    await stubComparison(page, {
      gapDiff: {
        closed: [hostile],
        persisted: [{ base: hostile, revision: hostile }],
        introduced: []
      }
    });
    await gotoCompare(page);

    await expect(page.getByText(hostile).first()).toBeVisible();
    expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
  });

  test("[EP] the persisting bucket renders two sentences, not [object Object]", async ({
    page
  }) => {
    await stubComparison(page);
    await gotoCompare(page);

    await expect(page.getByText("[object Object]")).toHaveCount(0);
  });

  test("[EP] a cross-model comparison is flagged instead of quietly shown", async ({
    page
  }) => {
    await stubComparison(page, { sameEmbedModel: false });
    await gotoCompare(page);

    await expect(
      page.getByText("The two matches used different AI models")
    ).toBeVisible();
  });

  test("[i18n] the whole page renders in Vietnamese too", async ({ page }) => {
    await stubComparison(page);
    await gotoCompare(page);
    await setLanguage(page, "vi");

    await expect(
      page.getByRole("heading", { name: "So sánh phiên bản" })
    ).toBeVisible();
    await expect(page.getByText("Phiên bản 1")).toBeVisible();
    await expect(page.getByText("Đã đóng")).toBeVisible();
    await expect(page.getByText("Còn tồn tại")).toBeVisible();
    await expect(page.getByText("Mới phát sinh")).toBeVisible();
    await expect(page.getByText(/độ trùng chủ đề/)).toBeVisible();
    // No untranslated key leaked through.
    await expect(page.getByText(/^compare\./)).toHaveCount(0);
  });

  test("[i18n] the Vietnamese empty and error states are translated too", async ({
    page
  }) => {
    await stubComparison(page, { status: 400 });
    await gotoCompare(page);
    await setLanguage(page, "vi");

    await expect(page.getByRole("alert")).toContainText(
      /chưa được khai là phiên bản mới/
    );
    await expect(
      page.getByRole("button", { name: "Về thư viện" })
    ).toBeVisible();
  });
});
