import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { expect, test } from "@playwright/test";
import { gotoWizard, nextButton } from "./helpers";

// Regression: after the yarn → pnpm move the pdf.js worker URL stopped
// resolving and every PDF preview showed "Failed to load PDF file." The unit
// test mocks react-pdf, so only a real browser rendering a real PDF can catch
// the worker failing to load. Reuses the server's parser fixture.
const SAMPLE_PDF = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../server/test/fixtures/sample.pdf"
);

test("[happy] review step renders an uploaded PDF instead of failing", async ({
  page
}) => {
  await gotoWizard(page);
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
  await nextButton(page).click();
  await expect(
    page.getByRole("heading", { name: /candidate cv/i })
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
  await nextButton(page).click();
  await expect(
    page.getByRole("heading", { name: /review documents/i })
  ).toBeVisible();
  await expect(page.locator(".react-pdf__Page canvas")).toHaveCount(2, {
    timeout: 30_000
  });
  await expect(page.getByText("Failed to load PDF file.")).toHaveCount(0);
});
