import { test, expect } from "@/fixtures";
import { LIMITS, docTitle } from "@/data/test-data/documents";

// Rename from the library (REQ-DOCUMENTS-29). Real backend; only the failure case forces PATCH to fail (Q11).
// Not optimistic by decision Q8: the row changes once the server has answered.

test.describe("Đổi tên tài liệu trong thư viện", { tag: ["@creates-data"] }, () => {
  test("đổi tên qua modal thì báo thành công, đóng modal và dòng hiện tên mới", { tag: ["@TC-DOCUMENTS-072", "@smoke"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.paste("CV");
    const next = docTitle("Renamed CV");
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openRename(doc.title);
    const rename = docLibraryPage.rename;
    await expect(rename.input()).toHaveValue(doc.title);
    await rename.fill(next);
    const res = await rename.save();

    expect(res.status()).toBe(200);
    await expect(docLibraryPage.toast("library.rename.success")).toBeVisible();
    await expect(rename.dialog()).toHaveCount(0);
    await expect(docLibraryPage.row(next)).toBeVisible();
    await expect(docLibraryPage.row(doc.title)).toHaveCount(0);
    expect((await docOwner.api.documents.get(doc.id)).json().title).toBe(next);
  });

  test("nút lưu bị khoá khi tên chỉ có khoảng trắng và ô nhập giới hạn 200 ký tự", { tag: ["@TC-DOCUMENTS-073"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.paste("JD");
    await docLibraryPage.gotoLoaded("jd");

    await docLibraryPage.openRename(doc.title);
    const rename = docLibraryPage.rename;
    await expect(rename.input()).toHaveAttribute("maxlength", String(LIMITS.title));
    await rename.fill("   ");
    await expect(rename.saveButton()).toBeDisabled();
    await rename.fill("");
    await expect(rename.saveButton()).toBeDisabled();
    await rename.fill(" x ");
    await expect(rename.saveButton()).toBeEnabled();
  });

  test("nhấn Enter trong ô tên thì lưu tên mới", { tag: ["@TC-DOCUMENTS-074"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.paste("CV");
    const next = docTitle("Enter-saved");
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openRename(doc.title);
    await docLibraryPage.rename.fill(`  ${next}  `);
    const patch = docLibraryPage.page.waitForResponse((r) => r.request().method() === "PATCH");
    await docLibraryPage.rename.input().press("Enter");

    expect((await patch).status()).toBe(200);
    await expect(docLibraryPage.row(next)).toBeVisible();
  });

  test("server lỗi khi đổi tên thì báo lỗi và modal vẫn mở", { tag: ["@TC-DOCUMENTS-075"] }, async ({ docLibraryPage, docOwner, network }) => {
    const doc = await docOwner.paste("CV");
    await network.failWith(`**/api/v1/documents/${doc.id}`, 500, { method: "PATCH" });
    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openRename(doc.title);
    await docLibraryPage.rename.fill(docTitle("Never saved"));
    await docLibraryPage.rename.save();

    await expect(docLibraryPage.toast("library.rename.failed")).toBeVisible();
    await expect(docLibraryPage.rename.dialog()).toBeVisible();
    await expect(docLibraryPage.row(doc.title)).toBeVisible();
  });
});
