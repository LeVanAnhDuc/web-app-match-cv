import { expect, test, type Page } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import { gotoWizard } from "./helpers";

// Shared backend + single stub user → other specs' saved docs would leak into
// this spec's empty-state assertions. Start each test from a clean DB.
test.beforeEach(async () => {
  await cleanDocuments();
});

// design.md §7 row 9 (i18n — EN default + VI). There is no in-app language
// switcher yet (Plan 2), so this drives i18next directly through a dev-only
// hook exposed at client/src/i18n/index.ts (`window.__i18n`, DEV-guarded —
// never present in production builds).
async function changeLanguage(page: Page, lng: "en" | "vi"): Promise<void> {
  await page.evaluate(
    (l) =>
      (
        window as unknown as { __i18n: { changeLanguage: (l: string) => void } }
      ).__i18n.changeLanguage(l),
    lng
  );
}

test.describe("i18n", () => {
  test("defaults to EN copy", async ({ page }) => {
    await gotoWizard(page);
    await expect(
      page.getByRole("heading", { name: "Input Job Description" })
    ).toBeVisible();
    await expect(page.getByText("No saved job descriptions yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  });

  test("switching to VI renders VI copy for stepper, step title, and empty state", async ({
    page
  }) => {
    await gotoWizard(page);
    await changeLanguage(page, "vi");

    await expect(
      page.getByRole("heading", { name: "Nhập mô tả công việc" })
    ).toBeVisible();
    await expect(page.getByText("Chưa có JD nào được lưu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tiếp" })).toBeVisible();

    // No missing-message fallback keys leaked into the DOM.
    await expect(page.locator("body")).not.toContainText("wizard.stepJd.title");
  });

  test("switching back to EN restores EN copy (round-trip, no stuck state)", async ({
    page
  }) => {
    await gotoWizard(page);
    await changeLanguage(page, "vi");
    await expect(
      page.getByRole("heading", { name: "Nhập mô tả công việc" })
    ).toBeVisible();

    await changeLanguage(page, "en");
    await expect(
      page.getByRole("heading", { name: "Input Job Description" })
    ).toBeVisible();
  });
});
