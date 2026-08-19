import { expect, test, type Page } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import { gotoWizard, nextButton, pasteText, stubMatchApi } from "./helpers";

// Responsive layout invariants for the wizard, reconciled for
// home-dashboard-library: the wizard now lives INSIDE the app shell (the
// sidebar/drawer nav is the shell's — covered by
// e2e/home-dashboard-library), so this file only asserts the wizard's own
// per-viewport invariants (no horizontal overflow, primary CTA reachable,
// single stepper, step-3 panes rendered). Runs in all three projects
// (desktop / tablet / mobile); assertions hold for every class.

const JD_TEXT = "JD text for the responsive step-3 layout check.";
const CV_TEXT = "CV text for the responsive step-3 layout check.";

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    // +1 tolerance: sub-pixel layout rounding must not read as an overflow.
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
}

/** Walk step 1 -> 2 -> 3, waiting on each arrival (render-based review). */
async function advanceToReview(page: Page): Promise<void> {
  await gotoWizard(page);

  await pasteText(page, JD_TEXT);
  await nextButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Candidate CV / Resume" })
  ).toBeVisible();

  await pasteText(page, CV_TEXT);
  await nextButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Review documents" })
  ).toBeVisible();
  await expect(page.getByText(JD_TEXT)).toBeVisible();
  await expect(page.getByText(CV_TEXT)).toBeVisible();
}

test.beforeEach(async () => {
  await cleanDocuments();
});

test.describe("wizard responsive layout", () => {
  test("step 1 has no horizontal scroll and keeps the primary CTA in view", async ({
    page
  }) => {
    await gotoWizard(page);

    expect(await hasHorizontalScroll(page)).toBe(false);
    await expect(nextButton(page)).toBeInViewport();
  });

  test("the stepper renders exactly once at every viewport", async ({
    page
  }) => {
    await gotoWizard(page);

    // Single-markup stepper (no duplicated desktop/mobile variants) — the
    // Playwright strict-mode locators depend on there being exactly one.
    await expect(page.getByTestId("stepper-step-1")).toHaveCount(1);
    await expect(page.getByTestId("stepper-step-4")).toHaveCount(1);
  });

  test("advancing a step brings the new step header into view", async ({
    page
  }) => {
    await gotoWizard(page);
    await pasteText(page, "JD text for the responsive scroll-reset check.");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await nextButton(page).click();

    const heading = page.getByRole("heading", {
      name: "Candidate CV / Resume"
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
  });

  test("step 3 renders both panes with no horizontal scroll and Run match reachable", async ({
    page
  }) => {
    await stubMatchApi(page);
    await advanceToReview(page);

    // Both original documents rendered read-only.
    await expect(page.getByText(JD_TEXT)).toBeVisible();
    await expect(page.getByText(CV_TEXT)).toBeVisible();

    expect(await hasHorizontalScroll(page)).toBe(false);
    await expect(
      page.getByRole("button", { name: "Run match" })
    ).toBeInViewport();
  });

  test("step 4 result fits the viewport width with the footer reachable", async ({
    page
  }) => {
    await stubMatchApi(page);
    await advanceToReview(page);

    await page.getByRole("button", { name: "Run match" }).click();

    await expect(page.getByText("Overall match")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    // Reconciled for multi-provider-compare: step 4 became a scrollable list of
    // result cards with the actions below it, rather than one card with a
    // sticky footer. Reachable now means "scrolls into view", not "always on
    // screen" — pinning a footer above N cards would cost more room than it
    // saves once several providers are compared.
    const startOver = page.getByRole("button", { name: "Start over" });
    await startOver.scrollIntoViewIfNeeded();
    await expect(startOver).toBeInViewport();
  });
});
