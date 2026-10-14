import { t } from "@/data/copy";
import { expect, test } from "@/fixtures";

// Vietnamese rendering of the comparison page, its states and the lineage dialog (REQ-CVVERSIONCOMPARISON-27).
// There is no language switcher (D4): the language is switched through the dev hook window.__i18n after goto(), and
// the page objects resolve every label in the language they were switched to.

const RAW_KEY = /\b(compare|library\.lineage|library\.action|readout|gate)\.[a-zA-Z.]+\b/;

test.describe("cv-version-comparison — Vietnamese", () => {
  test(
    "trang so sánh hiển thị đủ tiếng Việt, không lộ key thô",
    { tag: ["@TC-CVVERSIONCOMPARISON-071"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2, titles } = await cvcSeed.happyPair();
      await versionComparePage.goto(v2);
      await versionComparePage.setLanguage("vi");

      await expect(versionComparePage.heading()).toHaveText(t("compare.title", "vi"));
      await expect(versionComparePage.subtitle()).toBeVisible();
      await expect(versionComparePage.versionLabel(1)).toBeVisible();
      await expect(versionComparePage.versionLabel(2)).toBeVisible();
      await expect(versionComparePage.titlesLine(titles.v1, titles.v2)).toBeVisible();
      await expect(versionComparePage.jdSelect()).toBeVisible();
      await expect(versionComparePage.meter("overall")).toBeVisible();
      await expect(versionComparePage.deltaDirection("up")).toHaveCount(3);
      await expect(versionComparePage.gapsTitle()).toBeVisible();
      await expect(versionComparePage.gapsCaveat()).toBeVisible();
      for (const bucket of ["closed", "persisted", "introduced"] as const) {
        await expect(versionComparePage.gapList(bucket)).toBeVisible();
      }
      expect(await versionComparePage.shell.main().innerText()).not.toMatch(RAW_KEY);
    }
  );

  test(
    "trạng thái lỗi, cổng đăng nhập, menu thư viện và hộp thoại lineage có tiếng Việt",
    { tag: ["@TC-CVVERSIONCOMPARISON-072"] },
    async ({ versionComparePage, versionLibraryPage, cvcSeed, cvcSignIn }) => {
      const { titles } = await cvcSeed.happyPair();
      const root = await cvcSeed.cv();

      await versionComparePage.goto(root);
      await versionComparePage.setLanguage("vi");
      await expect(versionComparePage.errorMessage()).toHaveText(t("compare.err.noParent", "vi"));
      await expect(versionComparePage.backToLibraryButton()).toBeVisible();

      await versionLibraryPage.goto("cv");
      await versionLibraryPage.setLanguage("vi");
      await versionLibraryPage.openActions(titles.v2);
      await expect(versionLibraryPage.compareItem()).toBeVisible();
      await expect(versionLibraryPage.setLineageItem()).toBeVisible();
      await versionLibraryPage.setLineageItem().click();
      const dialog = versionLibraryPage.lineageDialog;
      await expect(dialog.root()).toBeVisible();
      await expect(dialog.description(titles.v2)).toBeVisible();
      await expect(dialog.select()).toBeVisible();
      await expect(dialog.saveButton()).toBeDisabled();
      await expect(dialog.cancelButton()).toBeVisible();
      await dialog.cancelButton().click();

      await cvcSignIn(undefined);
      await versionComparePage.goto(root);
      await versionComparePage.setLanguage("vi");
      await expect(versionComparePage.signInGate()).toBeVisible();
    }
  );
});
