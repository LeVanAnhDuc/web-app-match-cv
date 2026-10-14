import { test, expect } from "@/fixtures";

// Delete from the library (REQ-DOCUMENTS-31). Real backend; the 409 comes from a MatchResult seeded in the DB, and
// only the "other error" case forces DELETE to fail (decision Q11).

const DELETE_URL = (id: string) => `**/api/v1/documents/${id}`;

test.describe("Xoá tài liệu trong thư viện", { tag: ["@creates-data"] }, () => {
  test("xác nhận xoá thì báo thành công, dòng biến mất và số đếm giảm", { tag: ["@TC-DOCUMENTS-076", "@smoke"] }, async ({ docLibraryPage, docOwner }) => {
    const keep = await docOwner.paste("CV");
    const doc = await docOwner.paste("CV");
    await docLibraryPage.gotoLoaded("cv");
    await expect(docLibraryPage.subtitle(2)).toBeVisible();

    await docLibraryPage.askDelete(doc.title);
    const removed = docLibraryPage.page.waitForResponse((r) => r.request().method() === "DELETE");
    await docLibraryPage.confirmDeleteButton().click();

    expect((await removed).status()).toBe(204);
    await expect(docLibraryPage.toast("library.delete.success")).toBeVisible();
    await expect(docLibraryPage.row(doc.title)).toHaveCount(0);
    await expect(docLibraryPage.row(keep.title)).toBeVisible();
    await expect(docLibraryPage.subtitle(1)).toBeVisible();
  });

  test("huỷ xác nhận thì không gửi request xoá và dòng còn nguyên", { tag: ["@TC-DOCUMENTS-077"] }, async ({ docLibraryPage, docOwner, network }) => {
    const doc = await docOwner.paste("JD");
    const deletes = network.recordRequests(DELETE_URL(doc.id), { method: "DELETE" });
    await docLibraryPage.gotoLoaded("jd");

    await docLibraryPage.askDelete(doc.title);
    await docLibraryPage.cancelDeleteButton().click();

    await expect(docLibraryPage.confirmText()).toBeHidden();
    await expect(docLibraryPage.row(doc.title)).toBeVisible();
    expect(deletes).toHaveLength(0);
    expect((await docOwner.api.documents.get(doc.id)).status).toBe(200);
  });

  test("tài liệu đang dùng trong lịch sử match thì báo không xoá được và dòng còn nguyên", { tag: ["@TC-DOCUMENTS-078"] }, async ({ docLibraryPage, docOwner }) => {
    const cv = await docOwner.paste("CV");
    const jd = await docOwner.paste("JD");
    await docOwner.referenceInMatch(cv.id, jd.id);
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.askDelete(cv.title);
    const removed = docLibraryPage.page.waitForResponse((r) => r.request().method() === "DELETE");
    await docLibraryPage.confirmDeleteButton().click();

    expect((await removed).status()).toBe(409);
    await expect(docLibraryPage.toast("library.delete.inUse")).toBeVisible();
    await expect(docLibraryPage.row(cv.title)).toBeVisible();
    await expect(docLibraryPage.subtitle(1)).toBeVisible();
  });

  test("lỗi khác khi xoá thì báo xoá thất bại và mục xoá bị khoá trong lúc đang xoá", { tag: ["@TC-DOCUMENTS-079"] }, async ({ docLibraryPage, docOwner, network }) => {
    const doc = await docOwner.paste("CV");
    await network.failWith(DELETE_URL(doc.id), 500, { method: "DELETE", delayMs: 3_000 });
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.askDelete(doc.title);
    await docLibraryPage.confirmDeleteButton().click();
    await docLibraryPage.ensureMenuOpen(doc.title);
    await expect(docLibraryPage.menuItem("delete")).toBeDisabled();

    await expect(docLibraryPage.toast("library.delete.failed")).toBeVisible({ timeout: 10_000 });
    await expect(docLibraryPage.row(doc.title)).toBeVisible();
  });
});
