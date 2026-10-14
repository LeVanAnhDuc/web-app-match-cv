import { t } from "@/data/copy";
import {
  FAKE_KEY,
  RAW_KEY_PATTERN,
  WIZARD_CV_TEXT,
  WIZARD_JD_TEXT,
  providerInfo,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// Vietnamese, switched through the dev hook window.__i18n (D4: the app has no language switcher)
// (REQ-AICREDENTIALS-40, -36). English is what every other spec of this module asserts. Page objects resolve their
// labels in the tab's current language, so the same locators are reused after setLanguage("vi").

test.describe("ai-credentials — Vietnamese", () => {
  test(
    "trang, modal và Popconfirm hiện đủ tiếng Việt, không lộ key thô",
    { tag: ["@TC-AICREDENTIALS-057"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel("vi");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();
      await aiCredentialsPage.setLanguage("vi");

      await expect(aiCredentialsPage.heading()).toHaveText(t("credentials.title", "vi"));
      await expect(aiCredentialsPage.subtitle()).toBeVisible();
      await expect(aiCredentialsPage.addButton()).toBeVisible();
      await expect(aiCredentialsPage.fallbackNote()).toBeVisible();
      await expect(aiCredentialsPage.testButton(label)).toBeVisible();
      await expect(aiCredentialsPage.editButton(label)).toBeVisible();
      await expect(aiCredentialsPage.deleteButton(label)).toBeVisible();
      await expect(aiCredentialsPage.rowStatus(label, null)).toHaveText(t("credentials.status.untested", "vi"));
      await expect(aiCredentialsPage.rowModelLine(label, null, null)).toBeVisible();
      expect(await aiCredentialsPage.mainText()).not.toMatch(RAW_KEY_PATTERN);

      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;
      await expect(form.addDialog()).toBeVisible();
      for (const field of [form.provider(), form.label(), form.apiKey(), form.chatModel(), form.embedModel()]) {
        await expect(field).toBeVisible();
      }
      await expect(form.message("credentials.form.apiKeyStoredHint")).toBeVisible();
      await expect(form.message("credentials.form.modelHint")).toBeVisible();
      await expect(form.saveButton()).toBeVisible();
      await form.save();
      await expect(form.message("credentials.form.required")).toHaveCount(2);
      expect(await aiCredentialsPage.bodyText()).not.toMatch(RAW_KEY_PATTERN);
      await form.cancel();

      await aiCredentialsPage.askDelete(label);
      await expect(aiCredentialsPage.deleteConfirmHint()).toBeVisible();
      await expect(aiCredentialsPage.deleteConfirmButton()).toBeVisible();
      await expect(aiCredentialsPage.deleteCancelButton()).toBeVisible();
    }
  );

  test(
    'khối "Chạy bằng" và cảnh báo chưa kiểm tra hiện đúng tiếng Việt',
    { tag: ["@TC-AICREDENTIALS-058"] },
    async ({ aiCredUser, runWithStep }) => {
      const first = uniqueLabel("vi one");
      const second = uniqueLabel("vi two");
      await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: first, apiKey: FAKE_KEY });
      await aiCredUser.api.aiCredentials.create({ provider: "openai", label: second, apiKey: FAKE_KEY });

      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);
      await runWithStep.setLanguage("vi");

      await expect(runWithStep.credentialCheckbox(second)).toHaveAccessibleName(
        new RegExp(t("credentials.status.untested", "vi"))
      );
      await expect(runWithStep.systemKeyCheckbox()).toBeVisible();
      await expect(runWithStep.systemKeyTag()).toBeVisible();
      await expect(runWithStep.addCredentialButton()).toBeVisible();
      await expect(runWithStep.untestedWarning(1)).toBeVisible();
      await expect(runWithStep.privacyLine([providerInfo("openai").label])).toBeVisible();

      await runWithStep.credentialCheckbox(first).check();
      await expect(runWithStep.untestedWarning(2)).toBeVisible();
      expect(await runWithStep.mainText()).not.toMatch(RAW_KEY_PATTERN);
    }
  );
});
