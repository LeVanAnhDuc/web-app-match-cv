import { readFileSync } from "node:fs";
import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import {
  EXPORT_URL_GLOB,
  SERVER_ERROR_MARKER,
  SLOW_EXPORT_MS,
  CONTENTS_KEYS,
  exportFilenames,
  type ContentsItem,
} from "@/data/test-data/data-export";

// REQ-DATAEXPORT-26…31: the /my-data page as the seeded e2e user. GET /me/export calls no AI, so it hits the real
// backend (D1); it is only slowed (dataExportNetwork.slowExport) to observe the pending state, or failed once
// (network.failWith) for the error path.

test.describe("/my-data — download", () => {
  test(
    "trang My data hiện tiêu đề, ba mục nội dung, nút tải và ghi chú riêng tư",
    { tag: ["@TC-DATAEXPORT-039"] },
    async ({ myDataPage }) => {
      await myDataPage.goto();

      await expect(myDataPage.heading()).toBeVisible();
      await expect(myDataPage.description()).toBeVisible();
      await expect(myDataPage.contentsHeading()).toBeVisible();
      await expect(myDataPage.contentsItems()).toHaveCount(Object.keys(CONTENTS_KEYS).length);
      for (const item of Object.keys(CONTENTS_KEYS) as ContentsItem[]) {
        await expect(myDataPage.contentsItem(item), item).toBeVisible();
      }
      await expect(myDataPage.downloadButton()).toBeEnabled();
      await expect(myDataPage.privacyNote()).toBeVisible();
    }
  );

  test(
    "bấm tải nhận file export theo ngày chứa dữ liệu của chính mình",
    { tag: ["@TC-DATAEXPORT-040", "@smoke"] },
    async ({ myDataPage, dataExportArchive, dataExportE2eUserId }) => {
      await myDataPage.goto();
      const before = new Date();

      const download = await myDataPage.download();

      expect(exportFilenames(before)).toContain(download.suggestedFilename());
      const archive = dataExportArchive(readFileSync(await download.path()));
      expect(archive.manifest().user.id).toBe(dataExportE2eUserId);
    }
  );

  test(
    "đang tải nút bận, đổi nhãn và bấm lần hai không gửi request thứ hai",
    { tag: ["@TC-DATAEXPORT-041"] },
    async ({ page, myDataPage, network, dataExportNetwork }) => {
      await myDataPage.goto();
      await dataExportNetwork.slowExport(page, SLOW_EXPORT_MS);
      const requests = network.recordRequests(EXPORT_URL_GLOB, { method: "GET" });
      const download = myDataPage.waitForDownload();

      await myDataPage.downloadButton().click();

      const busy = myDataPage.busyDownloadButton();
      await expect(busy).toBeVisible();
      await expect(busy).toBeDisabled();
      await expect(busy).toHaveAttribute("aria-busy", "true");
      // A real, trusted second click while the first request is in flight (force skips Playwright's wait-for-enabled;
      // the browser itself drops clicks on a disabled <button> unless the guard is broken).
      await busy.click({ force: true });

      await download;
      await expect(myDataPage.downloadButton()).toBeEnabled();
      expect(requests).toHaveLength(1);
    }
  );

  test(
    "tải xong hiện thông báo thành công trong vùng aria-live",
    { tag: ["@TC-DATAEXPORT-042"] },
    async ({ myDataPage }) => {
      await myDataPage.goto();

      await myDataPage.download();

      await expect(myDataPage.successMessage()).toBeVisible();
      await expect(myDataPage.errorAlert()).toHaveCount(0);
      await expect(myDataPage.downloadButton()).toBeEnabled();
    }
  );

  test(
    "export lỗi 500 hiện alert của client, nút bấm lại và tải được",
    { tag: ["@TC-DATAEXPORT-043"] },
    async ({ myDataPage, network }) => {
      await myDataPage.goto();
      await network.failWith(EXPORT_URL_GLOB, 500, {
        method: "GET",
        times: 1,
        body: { statusCode: 500, message: SERVER_ERROR_MARKER },
      });

      await myDataPage.downloadButton().click();

      await expect(myDataPage.errorAlert()).toBeVisible();
      await expect(myDataPage.errorAlert()).toContainText(t("myData.error"));
      await expect(myDataPage.errorAlert()).not.toContainText(SERVER_ERROR_MARKER);
      await expect(myDataPage.downloadButton()).toBeEnabled();

      // The stub answered once; the retry reaches the real backend.
      const download = await myDataPage.download();
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
      await expect(myDataPage.successMessage()).toBeVisible();
    }
  );

  test(
    "rời trang khi đang tải không gây lỗi trang hay console",
    { tag: ["@TC-DATAEXPORT-044"] },
    async ({ page, myDataPage, dataExportNetwork }) => {
      const errors = myDataPage.collectErrors();
      await myDataPage.goto();
      await dataExportNetwork.slowExport(page, SLOW_EXPORT_MS);
      const finished = page.waitForResponse((response) => response.url().endsWith("/me/export"));

      await myDataPage.downloadButton().click();
      await expect(myDataPage.busyDownloadButton()).toBeVisible();
      await myDataPage.shell.navigate("match");
      await finished;

      await expect(page).toHaveURL(/\/wizard(\?|$)/);
      expect(errors).toEqual([]);
    }
  );
});
