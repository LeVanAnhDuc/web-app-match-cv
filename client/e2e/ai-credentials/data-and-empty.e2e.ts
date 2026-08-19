import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  gotoWizard,
  nextButton,
  pasteText
} from "../cv-jd-matching-wizard/helpers";
import {
  createCredential,
  gotoCredentials,
  resetCredentials,
  VALID_KEY
} from "./helpers";

// Matrix rows 5 (empty / null) and 8 (data rendering). Read-only → gate A+B.

test.describe("ai-credentials rendering", () => {
  test.beforeEach(async () => {
    await resetCredentials();
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("[EP] null model overrides render as 'Default', never blank or null", async ({
    page
  }) => {
    await createCredential({ label: "E2E defaults" });
    await gotoCredentials(page);

    await expect(page.getByText("Default · Default")).toBeVisible();
    await expect(page.getByText("null")).toBeHidden();
  });

  test("[EP] a stored override is shown verbatim", async ({ page }) => {
    await createCredential({
      label: "E2E override",
      chatModel: "gpt-4o",
      embedModel: "text-embedding-3-large"
    });
    await gotoCredentials(page);

    await expect(
      page.getByText("gpt-4o · text-embedding-3-large")
    ).toBeVisible();
  });

  test("[EP] a never-tested credential shows no timestamp and no Invalid Date", async ({
    page
  }) => {
    await createCredential({ label: "E2E untested" });
    await gotoCredentials(page);

    await expect(page.getByText("Not tested")).toBeVisible();
    await expect(page.getByText("Invalid Date")).toBeHidden();
    await expect(page.getByText("NaN")).toBeHidden();
  });

  test("[EP] the provider enum renders as a human label", async ({ page }) => {
    await createCredential({ label: "E2E gemini", provider: "gemini" });
    await createCredential({ label: "E2E openai", provider: "openai" });
    await gotoCredentials(page);

    await expect(page.getByText("Google Gemini")).toBeVisible();
    await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
    // The raw enum value must never reach the screen.
    await expect(page.getByText("gemini", { exact: true })).toBeHidden();
    await expect(page.getByText("openai", { exact: true })).toBeHidden();
  });

  test("[security] the full key never appears in the DOM", async ({ page }) => {
    await createCredential({ label: "E2E masked" });
    await gotoCredentials(page);

    await expect(page.getByText("••••1234")).toBeVisible();
    expect(await page.content()).not.toContain(VALID_KEY);
    expect(await page.content()).not.toContain("sk-e2e-playwright");
  });

  test("[EP] with no credentials, step 3 defaults to the system key", async ({
    page
  }) => {
    await cleanDocuments();
    await gotoWizard(page);
    await pasteText(page, "JD text for the empty-credentials case.");
    await nextButton(page).click();
    await pasteText(page, "CV text for the empty-credentials case.");
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Review documents" })
    ).toBeVisible();

    // Reconciled for multi-provider-compare: the single Select became a
    // checkbox list, so the system key is now a checked checkbox.
    await expect(
      page.getByRole("checkbox", { name: /System key/ })
    ).toBeChecked();
    await expect(
      page.getByText("Your CV and JD text will be sent to: System key.")
    ).toBeVisible();
    // Only the system key is selected, so no credential warning should appear.
    await expect(
      page.getByText(/has not passed a connection test/)
    ).toBeHidden();
  });
});
