import { expect, test } from "@playwright/test";
import { gotoWizard, nextButton } from "./helpers";

// design.md §7 row 4 ([EP] file classes) + row 6 ([BVA] file size boundary).
// Files are built in-memory (Playwright setInputFiles accepts a buffer) so no
// binary fixtures need to live in the repo. Client-side validation only
// checks extension + byte size (DocumentInputStep.handleFileChange) — it
// never reads file content — so fake buffers are sufficient here.
//
// Deferred (not covered by this suite, documented in e2e.md):
// - valid pdf/docx upload, corrupt-file parse-error: require real
//   parseable/corrupt binaries and hit the server parser — covered by BE
//   `server/test/documents.e2e-spec.ts` (Task C2); redundant + heavier to
//   duplicate here given the paste-text priority for this round.
// - empty (0-byte) file: DocumentInputStep does not special-case 0-byte
//   files client-side (only extension + max-size); would require a real
//   POST round trip for a rawText-empty rejection — lower priority than the
//   paste-text empty case already covered in validation.e2e.ts.

test.describe("file validation", () => {
  test("[EP] wrong file type (.exe) is rejected client-side", async ({
    page
  }) => {
    await gotoWizard(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: "malware.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a real executable")
    });

    await expect(page.getByRole("alert")).toContainText(/only pdf or docx/i);
    await expect(nextButton(page)).toBeDisabled();
  });

  test("[EP] wrong file type (.png) is rejected client-side", async ({
    page
  }) => {
    await gotoWizard(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });

    await expect(page.getByRole("alert")).toContainText(/only pdf or docx/i);
    await expect(nextButton(page)).toBeDisabled();
  });

  test("[BVA] file over the 10MB limit is rejected (valid extension)", async ({
    page
  }) => {
    await gotoWizard(page);

    const overLimit = Buffer.alloc(10 * 1024 * 1024 + 1);
    await page.locator('input[type="file"]').setInputFiles({
      name: "huge.pdf",
      mimeType: "application/pdf",
      buffer: overLimit
    });

    await expect(page.getByRole("alert")).toContainText(/10MB/i);
    await expect(nextButton(page)).toBeDisabled();
  });

  test("[DT] wrong-type + oversize: type error takes precedence over size", async ({
    page
  }) => {
    await gotoWizard(page);

    const overLimit = Buffer.alloc(10 * 1024 * 1024 + 1);
    await page.locator('input[type="file"]').setInputFiles({
      name: "huge.exe",
      mimeType: "application/octet-stream",
      buffer: overLimit
    });

    // handleFileChange checks the extension pattern before the size check.
    await expect(page.getByRole("alert")).toContainText(/only pdf or docx/i);
    await expect(nextButton(page)).toBeDisabled();
  });

  test("valid-sized .pdf name under the limit is accepted (no error, Next enabled)", async ({
    page
  }) => {
    await gotoWizard(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(1024, "a")
    });

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(nextButton(page)).toBeEnabled();
  });
});
