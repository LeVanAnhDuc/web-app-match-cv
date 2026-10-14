import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { HTML_TEXT, SAMPLE_TEXT, docTitle, multiPagePdf, multiPageText } from "@/data/test-data/documents";
import { FILES } from "@/data/test-data/shared";

// Client-side preview from the library (REQ-DOCUMENTS-26…28, 35, 36; ADR-0019). Real backend, except the two
// failure cases that make one request fail on purpose (decision Q11).

const FILE_URL = /\/api\/v1\/documents\/[^/]+\/file(\?.*)?$/;
const EXTERNAL = /^https?:\/\/(?!(localhost|127\.0\.0\.1)[:/])/;
const LOAD_TIMEOUT = 20_000;

test.describe("Xem trước tài liệu", { tag: ["@creates-data"] }, () => {
  test("xem trước tài liệu dán text hiện chữ thuần không render HTML và chỉ có nút đóng", { tag: ["@TC-DOCUMENTS-063"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.paste("CV", { text: HTML_TEXT });
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openPreview(doc.title);

    const preview = docLibraryPage.preview;
    await expect(preview.dialog(doc.title)).toBeVisible();
    await expect(preview.text()).toHaveText(HTML_TEXT);
    await expect(preview.renderedMarkup()).toHaveCount(0);
    expect(await docLibraryPage.page.evaluate(() => "__xss" in window)).toBe(false);
    await expect(preview.downloadLink()).toHaveCount(0);
    await expect(preview.closeButton()).toBeVisible();
  });

  test("xem trước PDF vẽ trang trên canvas và có nút tải xuống, đóng", { tag: ["@TC-DOCUMENTS-064", "@smoke"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.upload("CV", FILES.pdf);
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openPreview(doc.title);

    const preview = docLibraryPage.preview;
    await expect(preview.dialog(doc.title)).toBeVisible();
    await expect(preview.pdfCanvases().first()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(preview.downloadLink()).toHaveAttribute("href", new RegExp(`/documents/${doc.id}/file\\?download=1$`));
    await expect(preview.closeButton()).toBeVisible();
  });

  test("xem trước DOCX dựng nội dung file trong trang", { tag: ["@TC-DOCUMENTS-065"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.upload("CV", FILES.docx);
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openPreview(doc.title);

    await expect(docLibraryPage.preview.docx()).toContainText(SAMPLE_TEXT.docx, { timeout: LOAD_TIMEOUT });
    await expect(docLibraryPage.preview.downloadLink()).toBeVisible();
  });

  test("xem trước PDF nhiều trang hiện đủ mọi trang", { tag: ["@TC-DOCUMENTS-066"] }, async ({ docLibraryPage, docOwner }) => {
    const title = docTitle("Three-page CV");
    await docOwner.insert({
      kind: "CV",
      title,
      sourceFormat: "pdf",
      rawText: multiPageText(3),
      fileData: multiPagePdf(3),
      fileMime: "application/pdf",
    });
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openPreview(title);

    await expect(docLibraryPage.preview.pdfCanvases().first()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(docLibraryPage.preview.pdfCanvases()).toHaveCount(3);
  });

  test("tải file gốc lỗi thì hiện đang tải rồi thông báo lỗi và trang vẫn dùng được", { tag: ["@TC-DOCUMENTS-067"] }, async ({ docLibraryPage, docOwner, network }) => {
    const doc = await docOwner.upload("CV", FILES.pdf);
    await network.failWith(FILE_URL, 500, { method: "GET", delayMs: 1_500 });
    const errors = docLibraryPage.collectPageErrors();
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openPreview(doc.title);

    await expect(docLibraryPage.preview.loadingText()).toBeVisible();
    await expect(docLibraryPage.preview.error()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await docLibraryPage.preview.close();
    await expect(docLibraryPage.row(doc.title)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tài liệu vừa bị xoá ở nơi khác thì modal xem trước báo lỗi thay vì quay mãi", { tag: ["@TC-DOCUMENTS-068"] }, async ({ docLibraryPage, docOwner }) => {
    // BUG: defects/documents.md#bug-documents-03
    test.fail();
    const doc = await docOwner.paste("JD");
    await docLibraryPage.gotoLoaded("jd");
    // deleted in "another tab": the list on screen still shows the row
    expect((await docOwner.api.documents.remove(doc.id)).status).toBe(204);

    await docLibraryPage.openPreview(doc.title);

    await expect(docLibraryPage.preview.error()).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("xem trước PDF và DOCX không gửi request nào ra host ngoài", { tag: ["@TC-DOCUMENTS-069"] }, async ({ docLibraryPage, docOwner, network }) => {
    const pdf = await docOwner.upload("CV", FILES.pdf);
    const docx = await docOwner.upload("CV", FILES.docx);
    const external = network.recordRequests(EXTERNAL);
    const fileCalls = network.recordRequests(FILE_URL, { method: "GET" });
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openPreview(pdf.title);
    await expect(docLibraryPage.preview.pdfCanvases().first()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await docLibraryPage.preview.close();
    await docLibraryPage.openPreview(docx.title);
    await expect(docLibraryPage.preview.docx()).toContainText(SAMPLE_TEXT.docx, { timeout: LOAD_TIMEOUT });

    expect(external.map((r) => r.url)).toEqual([]);
    for (const id of [pdf.id, docx.id]) {
      expect(fileCalls.some((r) => r.url.includes(`/documents/${id}/file`)), id).toBe(true);
    }
  });

  test("Esc và nút đóng đều đóng modal xem trước và gỡ nội dung khỏi trang", { tag: ["@TC-DOCUMENTS-070"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.upload("JD", FILES.pdf);
    await docLibraryPage.gotoLoaded("jd");
    const preview = docLibraryPage.preview;

    await docLibraryPage.openPreview(doc.title);
    await expect(preview.pdfCanvases().first()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await preview.pressEscape();
    await expect(preview.dialog()).toHaveCount(0);
    await expect(preview.mountedPreviewBodies()).toHaveCount(0);

    await docLibraryPage.openPreview(doc.title);
    await expect(preview.pdfCanvases().first()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await preview.close();
    await expect(preview.mountedPreviewBodies()).toHaveCount(0);
  });

  test("đổi ngôn ngữ khi đang xem PDF không gây lỗi trang", { tag: ["@TC-DOCUMENTS-071"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.upload("CV", FILES.pdf);
    const errors = docLibraryPage.collectPageErrors();
    await docLibraryPage.gotoLoaded("cv");
    await docLibraryPage.openPreview(doc.title);
    await expect(docLibraryPage.preview.pdfCanvases().first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    await docLibraryPage.setLanguage("vi");

    await expect(docLibraryPage.preview.closeButton()).toHaveText(t("preview.close", "vi"));
    await expect(docLibraryPage.preview.pdfCanvases().first()).toBeVisible();
    await expect(docLibraryPage.preview.error()).toHaveCount(0);
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});
