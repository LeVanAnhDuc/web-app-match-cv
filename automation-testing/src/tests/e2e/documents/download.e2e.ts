import { readFileSync } from "node:fs";
import { test, expect } from "@/fixtures";
import { sampleBytes } from "@/data/test-data/documents";
import { FILES, uniqueSuffix } from "@/data/test-data/shared";

// Download the original file (REQ-DOCUMENTS-30): the browser receives GET /documents/:id/file?download=1 as an
// attachment. Titles here are ASCII-safe so the expected filename is the title itself (REQ-DOCUMENTS-14).

test.describe("Tải tài liệu gốc", { tag: ["@creates-data"] }, () => {
  test("tải từ menu hành động nhận đúng file PDF gốc", { tag: ["@TC-DOCUMENTS-080"] }, async ({ docLibraryPage, docOwner }) => {
    const title = `cv_${uniqueSuffix()}`;
    await docOwner.upload("CV", FILES.pdf, { title });
    await docLibraryPage.gotoLoaded("cv");

    const download = await docLibraryPage.downloadFromMenu(title);

    expect(download.suggestedFilename()).toBe(`${title}.pdf`);
    expect(Buffer.compare(readFileSync(await download.path()), sampleBytes("pdf"))).toBe(0);
  });

  test("tải từ footer xem trước nhận đúng file DOCX gốc", { tag: ["@TC-DOCUMENTS-081"] }, async ({ docLibraryPage, docOwner }) => {
    const title = `jd_${uniqueSuffix()}`;
    await docOwner.upload("JD", FILES.docx, { title });
    await docLibraryPage.gotoLoaded("jd");
    await docLibraryPage.openPreview(title);

    const pending = docLibraryPage.page.waitForEvent("download");
    await docLibraryPage.preview.downloadLink().click();
    const download = await pending;

    expect(download.suggestedFilename()).toBe(`${title}.docx`);
    expect(Buffer.compare(readFileSync(await download.path()), sampleBytes("docx"))).toBe(0);
  });
});
