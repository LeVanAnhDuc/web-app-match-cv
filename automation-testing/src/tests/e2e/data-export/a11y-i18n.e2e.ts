import { test, expect } from "@/fixtures";
import { CONTENTS_KEYS, exportFilenames, type ContentsItem } from "@/data/test-data/data-export";

// REQ-DATAEXPORT-32/33: keyboard access to the only action on the page, and the page in Vietnamese. There is no
// language switcher (D4): vi goes through the dev hook window.__i18n (BasePage.setLanguage), after goto().

test.describe("/my-data — accessibility and i18n", () => {
  test(
    "nút tải tới được bằng Tab, có focus indicator, kích hoạt bằng Enter và Space",
    { tag: ["@TC-DATAEXPORT-045"] },
    async ({ myDataPage }) => {
      await myDataPage.goto();
      // Found by role + accessible name, so this line is itself the accessible-name check.
      await expect(myDataPage.downloadButton()).toBeVisible();

      expect(await myDataPage.tabToDownloadButton()).toBe(true);
      const focus = await myDataPage.downloadButtonFocusStyle();
      const outlined = focus.outlineStyle !== "none" && focus.outlineWidth !== "0px";
      expect(outlined || focus.boxShadow !== "none", JSON.stringify(focus)).toBe(true);

      const byEnter = await myDataPage.downloadWithKey("Enter");
      expect(byEnter.suggestedFilename()).toMatch(/\.zip$/);
      await expect(myDataPage.downloadButton()).toBeEnabled();

      await myDataPage.downloadButton().focus();
      const bySpace = await myDataPage.downloadWithKey("Space");
      expect(bySpace.suggestedFilename()).toMatch(/\.zip$/);
    }
  );

  test(
    "trang My data hiển thị tiếng Việt và tên file không đổi theo ngôn ngữ",
    { tag: ["@TC-DATAEXPORT-046"] },
    async ({ myDataPage }) => {
      await myDataPage.goto();
      await myDataPage.setLanguage("vi");

      await expect(myDataPage.heading()).toBeVisible();
      await expect(myDataPage.description()).toBeVisible();
      await expect(myDataPage.contentsHeading()).toBeVisible();
      for (const item of Object.keys(CONTENTS_KEYS) as ContentsItem[]) {
        await expect(myDataPage.contentsItem(item), item).toBeVisible();
      }
      await expect(myDataPage.privacyNote()).toBeVisible();
      const before = new Date();

      const download = await myDataPage.download();

      expect(exportFilenames(before)).toContain(download.suggestedFilename());
      await expect(myDataPage.successMessage()).toBeVisible();
    }
  );
});
