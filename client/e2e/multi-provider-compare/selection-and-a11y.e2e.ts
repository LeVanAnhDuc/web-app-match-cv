import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  advanceToReview,
  createCredential,
  MATCH_ROUTE,
  resetRunsAndCredentials,
  runMatchButton,
  setLanguage,
  stubMatches
} from "./helpers";

// Matrix rows 4 (validation), 6 (boundary 0), 9 (i18n) and 12 (accessibility).

test.describe("multi-provider selection", () => {
  test.beforeEach(async () => {
    await cleanDocuments();
    await resetRunsAndCredentials();
  });

  test.afterAll(async () => {
    await resetRunsAndCredentials();
  });

  test("[BVA 0] unticking everything disables Run match and sends nothing", async ({
    page
  }) => {
    await createCredential("E2E only key", "openrouter");

    let posts = 0;
    await page.route(MATCH_ROUTE, async (route) => {
      if (route.request().method() === "POST") posts += 1;
      await route.fallback();
    });

    await advanceToReview(page);
    // The credential is the default pick; unticking it leaves nothing selected.
    await page.getByRole("checkbox", { name: /E2E only key/ }).uncheck();

    await expect(runMatchButton(page)).toBeDisabled();
    await expect(
      page.getByText("Select at least one key to run the match.")
    ).toBeVisible();
    expect(posts).toBe(0);
  });

  test("[EP] the privacy notice names every provider that will receive the documents", async ({
    page
  }) => {
    await createCredential("E2E gemini key", "gemini");
    await advanceToReview(page);

    await page.getByRole("checkbox", { name: /E2E gemini key/ }).check();
    await page.getByRole("checkbox", { name: /System key/ }).check();

    await expect(
      page.getByText(
        "Your CV and JD text will be sent to: Google Gemini, System key."
      )
    ).toBeVisible();
  });

  test("[EP] an untested credential is warned about, not blocked", async ({
    page
  }) => {
    await createCredential("E2E untested key", "openrouter");
    await advanceToReview(page);

    await expect(
      page.getByText("1 selected credential has not passed a connection test.")
    ).toBeVisible();
    await expect(runMatchButton(page)).toBeEnabled();
  });

  test("[a11y] the provider list is a named group of keyboard checkboxes", async ({
    page
  }) => {
    await createCredential("E2E a11y key", "openrouter");
    await advanceToReview(page);

    await expect(page.getByLabel("Run with")).toBeVisible();

    const systemKey = page.getByRole("checkbox", { name: /System key/ });
    await systemKey.focus();
    await page.keyboard.press("Space");
    await expect(systemKey).toBeChecked();
  });

  test("[a11y] the results region announces cards politely", async ({
    page
  }) => {
    await stubMatches(page, [{}]);
    await advanceToReview(page);
    await runMatchButton(page).click();

    await expect(page.locator("[aria-live='polite']")).toHaveCount(1);
    await expect(page.getByText("80%")).toBeVisible({ timeout: 30000 });
  });

  test("[i18n] step 3 and step 4 render in Vietnamese without raw keys", async ({
    page
  }) => {
    await stubMatches(page, [{ status: "failed", errorCode: "no_quota" }]);
    await advanceToReview(page);
    await setLanguage(page, "vi");

    await expect(page.getByText("Chạy bằng")).toBeVisible();
    // "Key hệ thống" appears on the checkbox and again in the privacy notice.
    await expect(page.getByText("Key hệ thống").first()).toBeVisible();
    await expect(
      page.getByText("Nội dung CV và JD của bạn sẽ được gửi tới: Key hệ thống.")
    ).toBeVisible();

    await page.getByRole("button", { name: /Chạy so khớp/ }).click();
    await expect(
      page.getByText("Key này đã hết hạn mức ở nhà cung cấp.")
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();

    expect(await page.locator("body").innerText()).not.toMatch(
      /result\.[a-zA-Z.]+|credentials\.[a-zA-Z.]+/
    );
  });

  test("[i18n] the same states render in English without raw keys", async ({
    page
  }) => {
    await stubMatches(page, [{ status: "failed", errorCode: "unreachable" }]);
    await advanceToReview(page);
    await setLanguage(page, "en");

    await expect(page.getByText("Run with")).toBeVisible();
    await runMatchButton(page).click();

    await expect(page.getByText("Could not reach the provider.")).toBeVisible({
      timeout: 30000
    });
    expect(await page.locator("body").innerText()).not.toMatch(
      /result\.[a-zA-Z.]+|credentials\.[a-zA-Z.]+/
    );
  });
});
