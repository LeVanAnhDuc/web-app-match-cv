import { t } from "@/data/copy";
import { MAX_LINEAGE_DEPTH } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// "Mark as a new version of…" in the libraries (REQ-CVVERSIONCOMPARISON-24/25/26/28). Every PATCH goes to the real
// server except the 5xx case.

const SET_PARENT = "**/api/v1/documents/*/parent";

test.describe("cv-version-comparison — lineage dialog", () => {
  test(
    "khai báo bản trước trong hộp thoại làm hiện lối so sánh",
    { tag: ["@TC-CVVERSIONCOMPARISON-060", "@smoke"] },
    async ({ versionLibraryPage, versionComparePage, cvcSeed, page }) => {
      const v1Title = cvcSeed.title("Resume v1");
      const v2Title = cvcSeed.title("Resume v2");
      const v1 = await cvcSeed.cv({ title: v1Title });
      const v2 = await cvcSeed.cv({ title: v2Title });
      await versionLibraryPage.goto("cv");

      await versionLibraryPage.openLineage(v2Title);
      await versionLibraryPage.lineageDialog.choose(v1Title);
      await versionLibraryPage.lineageDialog.saveButton().click();

      await expect(versionLibraryPage.successToast()).toBeVisible();
      await expect(versionLibraryPage.lineageDialog.root()).toBeHidden();
      expect(await cvcSeed.parentOf(v2)).toBe(v1);

      await versionLibraryPage.openActions(v2Title);
      await expect(versionLibraryPage.compareItem()).toBeVisible();
      await versionLibraryPage.openCompare(v2Title);
      await expect(page).toHaveURL(new RegExp(`/compare/${v2}$`));
      await expect(versionComparePage.versionLabel(1)).toBeVisible();
      await expect(versionComparePage.versionLabel(2)).toBeVisible();
    }
  );

  test(
    "gỡ liên kết làm mất lối so sánh và trang so sánh báo chưa có bản trước",
    { tag: ["@TC-CVVERSIONCOMPARISON-061"] },
    async ({ versionLibraryPage, versionComparePage, cvcSeed }) => {
      const { v2, titles } = await cvcSeed.happyPair();
      await versionLibraryPage.goto("cv");

      await versionLibraryPage.openLineage(titles.v2);
      await versionLibraryPage.lineageDialog.clear(titles.v1);
      await versionLibraryPage.lineageDialog.saveButton().click();

      await expect(versionLibraryPage.successToast()).toBeVisible();
      expect(await cvcSeed.parentOf(v2)).toBeNull();
      await versionLibraryPage.openActions(titles.v2);
      await expect(versionLibraryPage.setLineageItem()).toBeVisible();
      await expect(versionLibraryPage.compareItem()).toHaveCount(0);

      await versionComparePage.goto(v2);
      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.noParent"));
    }
  );

  test(
    "hộp thoại chỉ liệt kê tài liệu đã lưu cùng loại khác chính nó và chọn sẵn bản trước hiện tại",
    { tag: ["@TC-CVVERSIONCOMPARISON-062"] },
    async ({ versionLibraryPage, cvcSeed }) => {
      const parentTitle = cvcSeed.title("Parent CV");
      const targetTitle = cvcSeed.title("Target CV");
      const otherTitle = cvcSeed.title("Other CV");
      const unsavedTitle = cvcSeed.title("Unsaved CV");
      const jdTitle = cvcSeed.title("Some JD");
      const parent = await cvcSeed.cv({ title: parentTitle });
      await cvcSeed.cv({ title: targetTitle, parentId: parent });
      await cvcSeed.cv({ title: otherTitle });
      await cvcSeed.cv({ title: unsavedTitle, saved: false });
      await cvcSeed.jd({ title: jdTitle });
      await versionLibraryPage.goto("cv");
      const dialog = versionLibraryPage.lineageDialog;

      await versionLibraryPage.openLineage(targetTitle);
      await expect(dialog.description(targetTitle)).toBeVisible();
      await expect(dialog.selected(parentTitle)).toBeVisible();
      await dialog.openOptions();
      await expect(dialog.option(otherTitle)).toBeVisible();
      await expect(dialog.option(parentTitle)).toBeVisible();
      for (const excluded of [targetTitle, unsavedTitle, jdTitle]) {
        await expect(dialog.titled(excluded)).toHaveCount(0);
      }
      await dialog.cancelButton().click();
      await expect(dialog.root()).toBeHidden();

      // A document with no previous version shows the placeholder.
      await versionLibraryPage.openLineage(otherTitle);
      await expect(dialog.placeholder()).toBeVisible();
    }
  );

  test(
    "nút Lưu bị khoá khi chưa đổi gì và không gửi request",
    { tag: ["@TC-CVVERSIONCOMPARISON-063"] },
    async ({ versionLibraryPage, cvcSeed, network }) => {
      const writes = network.recordRequests(SET_PARENT, { method: "PATCH" });
      const { titles } = await cvcSeed.happyPair();
      await versionLibraryPage.goto("cv");

      for (const title of [titles.v1, titles.v2]) {
        await versionLibraryPage.openLineage(title);
        await expect(versionLibraryPage.lineageDialog.saveButton()).toBeDisabled();
        await versionLibraryPage.lineageDialog.cancelButton().click();
        await expect(versionLibraryPage.lineageDialog.root()).toBeHidden();
      }
      expect(writes).toEqual([]);
    }
  );

  test(
    "double-click Lưu chỉ gửi đúng một PATCH",
    { tag: ["@TC-CVVERSIONCOMPARISON-064"] },
    async ({ versionLibraryPage, cvcSeed, network }) => {
      const writes = network.recordRequests(SET_PARENT, { method: "PATCH" });
      const v1Title = cvcSeed.title("Dbl v1");
      const v2Title = cvcSeed.title("Dbl v2");
      const v1 = await cvcSeed.cv({ title: v1Title });
      const v2 = await cvcSeed.cv({ title: v2Title });
      await versionLibraryPage.goto("cv");

      await versionLibraryPage.openLineage(v2Title);
      await versionLibraryPage.lineageDialog.choose(v1Title);
      await expect(versionLibraryPage.lineageDialog.saveButton()).toBeEnabled();
      // A real double click: both presses land in one tick, before React re-renders the button disabled.
      await versionLibraryPage.lineageDialog.saveButton().dblclick();

      await expect(versionLibraryPage.successToast()).toBeVisible();
      expect(writes).toHaveLength(1);
      expect(writes[0].body).toEqual({ parentId: v1 });
      expect(await cvcSeed.parentOf(v2)).toBe(v1);
    }
  );

  test(
    "liên kết tạo vòng bị từ chối, hộp thoại vẫn mở và giữ lựa chọn",
    { tag: ["@TC-CVVERSIONCOMPARISON-065"] },
    async ({ versionLibraryPage, cvcSeed }) => {
      const { v1, titles } = await cvcSeed.happyPair();
      await versionLibraryPage.goto("cv");
      const dialog = versionLibraryPage.lineageDialog;

      await versionLibraryPage.openLineage(titles.v1);
      await dialog.choose(titles.v2);
      await dialog.saveButton().click();

      await expect(dialog.errorAlert()).toHaveText(t("library.lineage.rejected"));
      await expect(dialog.root()).toBeVisible();
      await expect(dialog.selected(titles.v2)).toBeVisible();
      expect(await cvcSeed.parentOf(v1)).toBeNull();
    }
  );

  test(
    "lỗi server khi lưu báo không lưu được và giữ hộp thoại",
    { tag: ["@TC-CVVERSIONCOMPARISON-066"] },
    async ({ versionLibraryPage, cvcSeed, network }) => {
      const v1Title = cvcSeed.title("Err v1");
      const v2Title = cvcSeed.title("Err v2");
      await cvcSeed.cv({ title: v1Title });
      const v2 = await cvcSeed.cv({ title: v2Title });
      // A real 500 comes back after a server round-trip. A stub answered in the same tick as the click leaves the
      // dialog's Save spinning about half the time (the mutation's isPending never settles in the view), which is a
      // timing artefact of an instant fake response, not the server-error path this case is about.
      await network.failWith(SET_PARENT, 500, { method: "PATCH", delayMs: 300 });
      await versionLibraryPage.goto("cv");
      const dialog = versionLibraryPage.lineageDialog;

      await versionLibraryPage.openLineage(v2Title);
      await dialog.choose(v1Title);
      await dialog.saveButton().click();

      await expect(dialog.errorAlert()).toHaveText(t("library.lineage.failed"));
      await expect(dialog.selected(v1Title)).toBeVisible();
      await expect(dialog.saveButton()).toBeEnabled();
      expect(await cvcSeed.parentOf(v2)).toBeNull();
    }
  );

  test(
    "chuỗi phiên bản quá dài bị từ chối với đúng lý do",
    { tag: ["@TC-CVVERSIONCOMPARISON-067"] },
    async ({ versionLibraryPage, cvcSeed }) => {
      // Seeded before the chain, so the chain is newer and its last link heads the option list.
      const targetTitle = cvcSeed.title("Deep target");
      const target = await cvcSeed.cv({ title: targetTitle });
      const chain = await cvcSeed.chain(MAX_LINEAGE_DEPTH + 1, "Deep");
      const tip = (await cvcSeed.api.documents.get(chain[MAX_LINEAGE_DEPTH])).json().title;
      await versionLibraryPage.goto("cv");
      const dialog = versionLibraryPage.lineageDialog;

      await versionLibraryPage.openLineage(targetTitle);
      await dialog.choose(tip);
      await dialog.saveButton().click();

      await expect(dialog.errorAlert()).toBeVisible();
      await expect(dialog.root()).toBeVisible();
      expect(await cvcSeed.parentOf(target)).toBeNull();
      // "Can't be a version of itself or of its own newer version" is not why this was refused.
      await expect(dialog.errorAlert()).not.toHaveText(t("library.lineage.rejected"));
    }
  );

  test(
    "Esc đóng hộp thoại mà không lưu",
    { tag: ["@TC-CVVERSIONCOMPARISON-068"] },
    async ({ versionLibraryPage, cvcSeed, network, page }) => {
      const writes = network.recordRequests(SET_PARENT, { method: "PATCH" });
      const v1Title = cvcSeed.title("Esc v1");
      const v2Title = cvcSeed.title("Esc v2");
      await cvcSeed.cv({ title: v1Title });
      const v2 = await cvcSeed.cv({ title: v2Title });
      await versionLibraryPage.goto("cv");

      await versionLibraryPage.openLineage(v2Title);
      await versionLibraryPage.lineageDialog.choose(v1Title);
      await page.keyboard.press("Escape");

      await expect(versionLibraryPage.lineageDialog.root()).toBeHidden();
      expect(writes).toEqual([]);
      expect(await cvcSeed.parentOf(v2)).toBeNull();
    }
  );

  test(
    "mở hộp thoại đưa focus vào Select và đóng trả focus về nút Actions",
    { tag: ["@TC-CVVERSIONCOMPARISON-069"] },
    async ({ versionLibraryPage, cvcSeed, page }) => {
      const title = cvcSeed.title("Focus CV");
      await cvcSeed.cv({ title });
      await versionLibraryPage.goto("cv");

      await versionLibraryPage.openLineage(title);
      await expect(versionLibraryPage.lineageDialog.select()).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(versionLibraryPage.lineageDialog.root()).toBeHidden();
      await expect(versionLibraryPage.actionsButton(title)).toBeFocused();
    }
  );
});
