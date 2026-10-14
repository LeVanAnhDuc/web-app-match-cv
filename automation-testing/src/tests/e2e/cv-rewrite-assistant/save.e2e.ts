import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import {
  API_BULLET,
  API_REWORDED,
  CV_TEXT,
  FABRICATION,
  REWRITE_ROUTES,
  change,
  proposal,
} from "@/data/test-data/cv-rewrite-assistant";

// Saving approved changes as a new CV (REQ-24, 25, 28, 29). Only POST /cv-rewrite is stubbed (D1): the save itself is
// the REAL POST /cv-rewrite/accept, re-grounding the ticked changes against the seeded CV row — so the outcome is
// checked in the database too. TC-060 is the one exception: a 500 cannot be provoked on the real server.

const GENERATE = { method: "POST", status: 201 } as const;

test.describe("cv rewrite — save as a new CV", () => {
  test(
    "sinh, duyệt một phần rồi lưu thành CV mới",
    { tag: ["@TC-CVREWRITEASSISTANT-056", "@smoke", "@creates-data"] },
    async ({ rewriteData, rewritePage, rewriteLibrary, network, page }) => {
      const seed = await rewriteData.match();
      const defaultTitle = t("rewrite.save.defaultTitle", "en", { title: seed.cvTitle });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      const accepts = network.recordRequests(REWRITE_ROUTES.accept, { method: "POST" });
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();

      await rewritePage.change(0).tick();
      await rewritePage.openSaveDialog();
      await expect(rewritePage.saveDialog.nameInput()).toHaveValue(defaultTitle);
      await expect(rewritePage.saveDialog.hint()).toBeVisible();
      const response = await rewritePage.confirmSave();

      expect(response.status()).toBe(201);
      await expect(page).toHaveURL(/\/cv$/);
      await expect(rewritePage.message("rewrite.save.success")).toBeVisible();
      await expect(rewriteLibrary.item(defaultTitle)).toBeVisible();
      // Only the ticked change travelled; the second card was never approved.
      expect(accepts).toHaveLength(1);
      expect(accepts[0].body).toEqual({
        matchResultId: seed.matchId,
        title: defaultTitle,
        changes: [{ original: API_BULLET, replacement: API_REWORDED }],
      });
      const children = await rewriteData.childrenOf(seed.cvId);
      expect(children).toHaveLength(1);
      expect(children[0]).toMatchObject({ title: defaultTitle, kind: "CV", isSaved: true });
      expect(children[0].rawText).toBe(CV_TEXT.replace(API_BULLET, () => API_REWORDED));
    }
  );

  test(
    "tên rỗng bị chặn và tên tối đa 200 ký tự",
    { tag: ["@TC-CVREWRITEASSISTANT-057", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      const accepts = network.recordRequests(REWRITE_ROUTES.accept, { method: "POST" });
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.change(0).tick();
      await rewritePage.openSaveDialog();

      // maxLength caps typing at the boundary: character 201 cannot even be entered.
      await rewritePage.saveDialog.fillName("t".repeat(250));
      await expect(rewritePage.saveDialog.nameInput()).toHaveValue("t".repeat(200));

      await rewritePage.saveDialog.fillName("");
      await rewritePage.saveDialog.confirm();
      await expect(rewritePage.saveDialog.nameRequiredError()).toBeVisible();
      await expect(rewritePage.saveDialog.root()).toBeVisible();
      expect(accepts).toHaveLength(0);
    }
  );

  test(
    "tên chỉ có khoảng trắng bị chặn ở client",
    { tag: ["@TC-CVREWRITEASSISTANT-058", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      // BUG: defects/cv-rewrite-assistant.md#bug-cvrewriteassistant-01
      test.fail();
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      const accepts = network.recordRequests(REWRITE_ROUTES.accept, { method: "POST" });
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.change(0).tick();
      await rewritePage.openSaveDialog();

      await rewritePage.saveDialog.fillName("   ");
      await rewritePage.saveDialog.confirm();

      await expect(rewritePage.saveDialog.nameRequiredError()).toBeVisible();
      await expect(rewritePage.message("rewrite.err.notGrounded")).toHaveCount(0);
      expect(accepts).toHaveLength(0);
    }
  );

  test(
    "lưu bị từ chối giữ modal và các lựa chọn",
    { tag: ["@TC-CVREWRITEASSISTANT-059", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      // Not anchored in the seeded CV: the real accept re-grounds it and answers 400.
      const forged = change("0", { original: FABRICATION, replacement: `${FABRICATION} (CKA).` });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed, { changes: [forged] }), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.tickAll();
      await rewritePage.openSaveDialog();

      const response = await rewritePage.confirmSave();

      expect(response.status()).toBe(400);
      await expect(rewritePage.message("rewrite.err.notGrounded")).toBeVisible();
      await expect(rewritePage.saveDialog.root()).toBeVisible();
      await expect(rewritePage.selectAll()).toBeChecked();
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "lỗi máy chủ khi lưu báo thử lại",
    { tag: ["@TC-CVREWRITEASSISTANT-060", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await network.failWith(REWRITE_ROUTES.accept, 500, { method: "POST" });
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.tickAll();
      await rewritePage.openSaveDialog();

      const response = await rewritePage.confirmSave();

      expect(response.status()).toBe(500);
      await expect(rewritePage.message("rewrite.err.saveFailed")).toBeVisible();
      await expect(rewritePage.saveDialog.root()).toBeVisible();
      await expect(rewritePage.selectAll()).toBeChecked();
    }
  );

  test(
    "bấm Save hai lần chỉ tạo một CV",
    { tag: ["@TC-CVREWRITEASSISTANT-061", "@creates-data"] },
    async ({ rewriteData, rewritePage, network, page }) => {
      // BUG: defects/cv-rewrite-assistant.md#bug-cvrewriteassistant-05
      test.fail();
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      const accepts = network.recordRequests(REWRITE_ROUTES.accept, { method: "POST" });
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.tickAll();
      await rewritePage.openSaveDialog();

      await rewritePage.saveDialog.confirmButton().dblclick();

      // Once on /cv the dialog is gone, so no later request can be sent.
      await expect(page).toHaveURL(/\/cv$/, { timeout: 15_000 });
      expect(accepts).toHaveLength(1);
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(1);
    }
  );
});
