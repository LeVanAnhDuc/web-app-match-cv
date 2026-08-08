import { expect, test } from "@playwright/test";
import {
  BASE_GAP,
  CLOSED_GAP,
  JD2_ID,
  JD_ID,
  NEW_GAP,
  REVISION_GAP,
  SAVED_CVS,
  V2_ID,
  gotoCompare,
  openSelect,
  stubComparison,
  stubSavedDocs
} from "./helpers";

// design.md §7 rows 1 (happy path), 7 (JD selector + URL) and 12 (a11y).

test.describe("cv-version-comparison — happy path", () => {
  test("[EP] the library offers the comparison from a CV that has a previous version", async ({
    page
  }) => {
    await stubSavedDocs(page);
    await stubComparison(page);

    await page.goto("/cv");
    await expect(
      page.getByRole("heading", { name: "Curriculum Vitae" })
    ).toBeVisible();

    // Exactly one row descends from another, so exactly one row offers it.
    const compare = page.getByRole("button", { name: "Compare versions" });
    await expect(compare).toHaveCount(1);
    await compare.click();

    await expect(page).toHaveURL(new RegExp(`/compare/${V2_ID}`));
    await expect(page.getByText("Version 1")).toBeVisible();
    await expect(page.getByText("Version 2")).toBeVisible();
  });

  test("[EP] the delta leads, with both scores and a signed change", async ({
    page
  }) => {
    await stubComparison(page);
    await gotoCompare(page);

    await expect(page.getByText("61%")).toBeVisible();
    await expect(page.getByText("75%")).toBeVisible();
    await expect(page.getByText("+14")).toBeVisible();
    await expect(page.getByText("+8")).toBeVisible();
    await expect(page.getByText("+23")).toBeVisible();
  });

  test("[EP] every gap is shown verbatim, in the right bucket", async ({
    page
  }) => {
    await stubComparison(page);
    await gotoCompare(page);

    await expect(
      page.getByRole("list", { name: "Closed" }).getByText(CLOSED_GAP)
    ).toBeVisible();
    // A reworded gap appears ONCE, as still open — with both wordings, so the
    // user can see that it narrowed rather than closed.
    const stillOpen = page.getByRole("list", { name: "Still open" });
    await expect(stillOpen.getByText(BASE_GAP)).toBeVisible();
    await expect(stillOpen.getByText(REVISION_GAP)).toBeVisible();
    await expect(
      page.getByRole("list", { name: "New" }).getByText(NEW_GAP)
    ).toBeVisible();

    // It never claims to be exact.
    await expect(page.getByText(/matched by topic overlap/)).toBeVisible();
  });

  test("[EP] the chosen job description lives in the URL and survives a reload", async ({
    page
  }) => {
    const calls = await stubComparison(page);
    await gotoCompare(page);

    await openSelect(page, "Job description");
    await page.getByTitle("Platform Engineer").click();

    await expect(page).toHaveURL(new RegExp(`jd=${JD2_ID}`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`jd=${JD2_ID}`));
    // The server, not the client, is asked about that job description.
    expect(calls().some((url) => url.includes(JD2_ID))).toBe(true);
  });

  test("[EP] a pinned job description is preselected when the link is opened cold", async ({
    page
  }) => {
    const calls = await stubComparison(page, { jdDocumentId: JD_ID });
    await gotoCompare(page, V2_ID, `?jd=${JD_ID}`);

    // The combobox role sits on antd's hidden search input, which holds no
    // text — the rendered selection is the sibling label. Assert the rendered
    // outcome first: `gotoCompare` returns once the heading is up, which is
    // before the query has necessarily resolved.
    await expect(page.getByTitle("Senior Backend Engineer")).toBeVisible();
    expect(calls()[0]).toContain(JD_ID);
  });

  test("[a11y] every control and every gap bucket is reachable by role and name", async ({
    page
  }) => {
    await stubComparison(page);
    await gotoCompare(page);

    await expect(
      page.getByRole("combobox", { name: "Job description" })
    ).toBeVisible();
    // The buckets are told apart by name, not only by colour.
    await expect(page.getByRole("list", { name: "Closed" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Still open" })).toBeVisible();
    await expect(page.getByRole("list", { name: "New" })).toBeVisible();
    // Direction is spelled out for a screen reader, not carried by hue alone.
    await expect(
      page.getByText("better than the previous version").first()
    ).toBeAttached();
  });

  test("[EP] the library still lists documents that have no previous version", async ({
    page
  }) => {
    await stubSavedDocs(page, [SAVED_CVS[0]]);

    await page.goto("/cv");
    await expect(page.getByText("Backend Resume")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Compare versions" })
    ).toHaveCount(0);
  });
});
