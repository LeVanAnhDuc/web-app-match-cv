import { t } from "@/data/copy";
import {
  FAKE_KEY,
  TOUCH_TARGET_PX,
  WIZARD_CV_TEXT,
  WIZARD_JD_TEXT,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// Keyboard, labels, focus and touch targets (REQ-AICREDENTIALS-41, -42, -11, -27).

test.describe("ai-credentials — accessibility", () => {
  test(
    "mở modal thì focus vào ô đầu tiên",
    { tag: ["@TC-AICREDENTIALS-059"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      // BUG: defects/ai-credentials.md#bug-aicredentials-04
      test.fail();
      void aiCredUser;
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();

      // The first field of the form is Provider.
      await expect(aiCredentialsPage.form.provider()).toBeFocused({ timeout: 3_000 });
    }
  );

  test(
    "Esc đóng modal và trả focus về nút đã mở",
    { tag: ["@TC-AICREDENTIALS-060"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      void aiCredUser;
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();

      await aiCredentialsPage.form.label().focus();
      await aiCredentialsPage.form.closeWithEscape();

      await expect(aiCredentialsPage.form.addDialog()).toBeHidden();
      await expect(aiCredentialsPage.addButton()).toBeFocused();
    }
  );

  test(
    "mọi input của modal tìm được bằng label, lỗi validate gắn vào input",
    { tag: ["@TC-AICREDENTIALS-061"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      void aiCredUser;
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      // Each locator below is getByLabel(<visible label>): finding it IS the assertion.
      for (const field of [form.provider(), form.label(), form.apiKey(), form.chatModel(), form.embedModel()]) {
        await expect(field).toBeVisible();
      }

      await form.save();
      // Screen readers get the error through aria-invalid + aria-describedby on the input itself.
      await expect(form.label()).toHaveAttribute("aria-invalid", "true");
      await expect(form.label()).toHaveAccessibleDescription(t("credentials.form.required"));
      await expect(form.apiKey()).toHaveAttribute("aria-invalid", "true");
      await expect(form.apiKey()).toHaveAccessibleDescription(new RegExp(t("credentials.form.required")));
    }
  );

  test(
    'nhóm checkbox "Run with" có accessible name',
    { tag: ["@TC-AICREDENTIALS-062"] },
    async ({ aiCredUser, runWithStep }) => {
      // BUG: defects/ai-credentials.md#bug-aicredentials-05
      test.fail();
      void aiCredUser;
      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);
      await expect(runWithStep.systemKeyCheckbox()).toBeVisible();

      await expect(runWithStep.runWithGroup()).toBeVisible({ timeout: 3_000 });
      await expect(runWithStep.runWithGroup().getByRole("checkbox")).toHaveCount(1);
    }
  );

  test(
    "action trên dòng theo thứ tự Test, Edit, Delete và Popconfirm dùng được bằng bàn phím",
    { tag: ["@TC-AICREDENTIALS-063"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel("a11y");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();
      await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();

      await expect(aiCredentialsPage.rowButtons(label)).toHaveText([
        t("credentials.actions.test"),
        t("credentials.actions.edit"),
        t("credentials.actions.delete"),
      ]);

      await aiCredentialsPage.deleteButton(label).focus();
      await aiCredentialsPage.page.keyboard.press("Enter");
      await expect(aiCredentialsPage.deleteConfirm()).toBeVisible();
      await aiCredentialsPage.page.keyboard.press("Escape");
      await expect(aiCredentialsPage.deleteConfirm()).toBeHidden();
      await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();
    }
  );

  test(
    "vùng bấm nút Add credential và action dòng đạt 44×44 px trên mobile",
    { tag: ["@TC-AICREDENTIALS-087"] },
    async ({ aiCredUser, aiCredentialsPage }, testInfo) => {
      test.skip(testInfo.project.name !== "app-mobile", "REQ-AICREDENTIALS-42 is about the 390 px touch layout");
      // BUG: defects/ai-credentials.md#bug-aicredentials-06
      test.fail();
      const label = uniqueLabel("touch");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();
      await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();

      for (const target of [
        aiCredentialsPage.addButton(),
        aiCredentialsPage.testButton(label),
        aiCredentialsPage.editButton(label),
        aiCredentialsPage.deleteButton(label),
      ]) {
        const box = (await target.boundingBox())!;
        expect.soft(box.width, String(target)).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
        expect.soft(box.height, String(target)).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
      }
    }
  );
});
