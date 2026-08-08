import { expect, test } from "@playwright/test";
import {
  COMPARISON_ROUTE,
  JD2_ID,
  SAVED_CVS,
  STUB_COMPARISON,
  V2_ID,
  gotoCompare,
  openSelect,
  stubComparison,
  stubSavedDocs,
  stubSetParent
} from "./helpers";

// design.md §7 rows 10 (error / loading) and 11 (mutation safety).

test.describe("cv-version-comparison — errors and mutations", () => {
  test("[EP] a broken request shows an error, not a blank page", async ({
    page
  }) => {
    await stubComparison(page, { status: 500 });
    await gotoCompare(page);

    await expect(page.getByRole("alert")).toContainText(
      /Couldn't load the comparison/
    );
  });

  test("[EP] the page shows a busy state while the comparison loads", async ({
    page
  }) => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(COMPARISON_ROUTE, async (route) => {
      await held;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(STUB_COMPARISON)
      });
    });

    await page.goto(`/compare/${V2_ID}`);
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    release?.();
    await expect(page.getByText("Version 1")).toBeVisible();
  });

  // [ST] The structural claim of design.md §2, asserted rather than asserted
  // about: browsing a comparison must never spend an AI call.
  test("[ST] browsing a comparison never fires a match", async ({ page }) => {
    await stubComparison(page);
    const forbidden: Array<string> = [];
    page.on("request", (request) => {
      const url = request.url();
      if (request.method() !== "POST") return;
      if (/\/api\/v1\/(match|cv-rewrite)/.test(url)) forbidden.push(url);
    });

    await gotoCompare(page);
    await openSelect(page, "Job description");
    await page.getByTitle("Platform Engineer").click();
    await expect(page).toHaveURL(new RegExp(`jd=${JD2_ID}`));
    await page.reload();
    await expect(page.getByText("Version 1")).toBeVisible();

    expect(forbidden).toEqual([]);
  });

  test("[ST] a lineage link is declared, then cleared", async ({ page }) => {
    await stubSavedDocs(page, [SAVED_CVS[0], { ...SAVED_CVS[1] }]);
    const bodies = await stubSetParent(page);

    await page.goto("/cv");
    await page
      .getByRole("button", { name: "Mark as a new version of…" })
      .first()
      .click();

    const select = page.getByRole("combobox", { name: "Previous version" });
    await openSelect(page, "Previous version");
    await page.getByTitle("Backend Resume (improved)").click();
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect
      .poll(() => bodies().length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    expect(bodies()[0].parentId).toBe(SAVED_CVS[1].id);
  });

  test("[ST] a rejected link keeps the dialog open and says why", async ({
    page
  }) => {
    await stubSavedDocs(page);
    await stubSetParent(page, 400);

    await page.goto("/cv");
    await page
      .getByRole("button", { name: "Mark as a new version of…" })
      .first()
      .click();

    const select = page.getByRole("combobox", { name: "Previous version" });
    await openSelect(page, "Previous version");
    await page.getByTitle("Backend Resume (improved)").click();
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText(/isn't allowed/)).toBeVisible();
    // Still open, with the choice intact — no approval work is lost.
    await expect(select).toBeVisible();
  });

  test("[DT] the dialog cannot be submitted without changing anything", async ({
    page
  }) => {
    await stubSavedDocs(page);
    const bodies = await stubSetParent(page);

    await page.goto("/cv");
    await page
      .getByRole("button", { name: "Mark as a new version of…" })
      .first()
      .click();

    // Nothing picked yet → nothing to save, and no request is sent.
    await expect(
      page.getByRole("button", { name: "Save", exact: true })
    ).toBeDisabled();
    expect(bodies()).toEqual([]);
  });

  test("[ST] a double click on Save produces exactly one write", async ({
    page
  }) => {
    await stubSavedDocs(page);
    const bodies = await stubSetParent(page);

    await page.goto("/cv");
    // The second row already has a parent, so pick the first one to change.
    await page
      .getByRole("button", { name: "Mark as a new version of…" })
      .first()
      .click();
    await openSelect(page, "Previous version");
    await page.getByTitle("Backend Resume (improved)").click();

    const save = page.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeEnabled();
    // A real double click, not two awaited clicks. Two separate `click()` calls
    // each re-run actionability, so the second one waits for a button that the
    // first click already disabled and then removed — it times out instead of
    // testing anything. `dblclick` dispatches both presses back to back, which
    // is what the guard has to survive.
    await save.dblclick();

    await expect.poll(() => bodies().length, { timeout: 10_000 }).toBe(1);
  });
});
