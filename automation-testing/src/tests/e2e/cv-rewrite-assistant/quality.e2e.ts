import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import {
  HOSTILE_LINE,
  HOSTILE_REPLACEMENT,
  REWRITE_ROUTES,
  change,
  proposal,
} from "@/data/test-data/cv-rewrite-assistant";

// Data rendering, language, keyboard and runtime health of the rewrite page (REQ-32…35). POST /cv-rewrite is stubbed
// (D1); the rest is the real backend.

const GENERATE = { method: "POST", status: 201 } as const;

/** Dev-build noise that says nothing about this page (React/antd warnings, 4xx resource logs of other probes). */
const BENIGN_CONSOLE = [/^Warning:/, /\[antd:/, /React DevTools/, /Failed to load resource: the server responded with a status of 4\d\d/];

test.describe("cv rewrite — data, language, keyboard", () => {
  test(
    "nội dung CV hiển thị dạng chữ, không thành markup",
    { tag: ["@TC-CVREWRITEASSISTANT-062", "@smoke", "@creates-data"] },
    async ({ rewriteData, rewritePage, network, page }) => {
      const seed = await rewriteData.match({ cvText: `EXPERIENCE\n- ${HOSTILE_LINE}` });
      const hostile = change("0", {
        original: HOSTILE_LINE,
        replacement: HOSTILE_REPLACEMENT,
        sectionHint: "<i>Experience</i>",
        rationale: "Tightens the <em>wording</em>.",
        addressesGap: null,
      });
      await network.stubJson(
        REWRITE_ROUTES.generate,
        proposal(seed, { changes: [hostile], unaddressedGaps: ["<img src=x onerror=alert(2)>"] }),
        GENERATE
      );
      const dialogs: string[] = [];
      page.on("dialog", (dialog) => {
        dialogs.push(dialog.message());
        void dialog.dismiss();
      });
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();

      const card = rewritePage.change(0);
      await expect(card.text(HOSTILE_LINE)).toBeVisible();
      await expect(card.text(HOSTILE_REPLACEMENT)).toBeVisible();
      await expect(card.text(hostile.rationale)).toBeVisible();
      await expect(card.eyebrow(hostile.sectionHint!)).toBeVisible();
      await expect(rewritePage.gap("<img src=x onerror=alert(2)>")).toBeVisible();
      await card.tick();
      await rewritePage.openPreview();
      await expect(rewritePage.previewText()).toContainText(HOSTILE_REPLACEMENT);

      await expect(rewritePage.markupNodes()).toHaveCount(0);
      expect(dialogs).toEqual([]);
    }
  );

  test(
    "toàn bộ luồng hiển thị tiếng Việt",
    { tag: ["@TC-CVREWRITEASSISTANT-063", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);

      await rewritePage.setLanguage("vi");

      await expect(rewritePage.heading()).toBeVisible();
      await expect(rewritePage.subtitle()).toBeVisible();
      await expect(rewritePage.setupHeading(seed.cvTitle)).toBeVisible();
      await expect(rewritePage.gapsTitle()).toBeVisible();
      await expect(rewritePage.runWith.select()).toBeVisible();
      await expect(rewritePage.runWith.systemKeyChoice()).toBeVisible();
      await expect(rewritePage.runWith.privacySystem()).toBeVisible();
      await expect(rewritePage.generateButton()).toBeVisible();

      await rewritePage.generateProposal();
      await expect(rewritePage.regenerateButton()).toBeVisible();
      await expect(rewritePage.selectAll()).toBeVisible();
      await expect(rewritePage.change(0).originalLabel()).toBeVisible();
      await expect(rewritePage.change(0).suggestedLabel()).toBeVisible();
      await expect(rewritePage.unaddressedTitle()).toBeVisible();
      await expect(rewritePage.unaddressedHint()).toBeVisible();
      await expect(rewritePage.selectedCount(0)).toBeVisible();
      await expect(rewritePage.previewToggle()).toBeVisible();

      await rewritePage.change(0).tick();
      await expect(rewritePage.selectedCount(1)).toBeVisible();
      await rewritePage.openSaveDialog();
      await expect(rewritePage.saveDialog.nameInput()).toHaveValue(
        t("rewrite.save.defaultTitle", "vi", { title: seed.cvTitle })
      );
      await expect(rewritePage.saveDialog.confirmButton()).toBeVisible();
      await expect(rewritePage.saveDialog.cancelButton()).toBeVisible();
      await expect(rewritePage.saveDialog.hint()).toBeVisible();
      await expect(rewritePage.rawPlaceholder()).toHaveCount(0);
    }
  );

  test(
    "điều khiển dùng được bằng bàn phím",
    { tag: ["@TC-CVREWRITEASSISTANT-064", "@creates-data"] },
    async ({ rewriteData, rewritePage, network, page }) => {
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);

      await rewritePage.runWith.select().focus();
      expect(await rewritePage.tabTo(rewritePage.generateButton())).toBeGreaterThan(0);
      await page.keyboard.press("Enter");
      await expect(rewritePage.changesHeading()).toBeVisible();

      expect(await rewritePage.tabTo(rewritePage.selectAll(), 30)).toBeGreaterThan(0);
      expect(await rewritePage.tabTo(rewritePage.change(0).checkbox())).toBeGreaterThan(0);
      await page.keyboard.press("Space");
      await expect(rewritePage.change(0).checkbox()).toBeChecked();
      expect(await rewritePage.tabTo(rewritePage.change(1).checkbox())).toBeGreaterThan(0);
      expect(await rewritePage.tabTo(rewritePage.saveAsNewButton())).toBeGreaterThan(0);

      await page.keyboard.press("Enter");
      await expect(rewritePage.saveDialog.root()).toBeVisible();
      await rewritePage.saveDialog.waitFocusInside();
      await page.keyboard.press("Escape");
      await expect(rewritePage.saveDialog.root()).toBeHidden();
    }
  );

  test(
    "checkbox của các thay đổi có tên truy cập phân biệt",
    { tag: ["@TC-CVREWRITEASSISTANT-065", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      // Both default changes carry sectionHint "Experience".
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();

      const names = await rewritePage.changeCheckboxNames();

      expect(names).toHaveLength(2);
      for (const name of names) expect(name.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  );

  test(
    "mở modal lưu thì focus vào ô tên",
    { tag: ["@TC-CVREWRITEASSISTANT-066", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      // BUG: defects/cv-rewrite-assistant.md#bug-cvrewriteassistant-03
      test.fail();
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.change(0).tick();

      await rewritePage.openSaveDialog();

      await expect(rewritePage.saveDialog.nameInput()).toBeFocused();
    }
  );

  test(
    "luồng chuẩn không có lỗi JS hay response 5xx",
    { tag: ["@TC-CVREWRITEASSISTANT-067", "@creates-data"] },
    async ({ rewriteData, rewritePage, network, page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const serverErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !BENIGN_CONSOLE.some((re) => re.test(message.text()))) {
          consoleErrors.push(message.text());
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
      });
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);

      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await rewritePage.change(0).tick();
      await rewritePage.openPreview();
      await rewritePage.openSaveDialog();
      const response = await rewritePage.confirmSave();
      expect(response.status()).toBe(201);
      await expect(page).toHaveURL(/\/cv$/);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(serverErrors).toEqual([]);
    }
  );
});
