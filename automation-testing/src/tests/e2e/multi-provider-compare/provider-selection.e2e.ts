import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { MPC_TEXT, SYSTEM } from "@/data/test-data/multi-provider-compare";

// Step 3 "Review documents": the provider picker (signed-in) and what a guest sees instead. POST /match is stubbed
// per card (D1); documents and runs go to the real backend.

test.describe("chọn provider ở bước 3", () => {
  test(
    "mỗi credential và key hệ thống có một checkbox tới được bằng Tab và bật tắt được bằng Space",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-023"] },
    async ({ compareWizardPage: wizard, mpcCredentials, page }) => {
      const gemini = await mpcCredentials.add("gemini");
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.waitForOptions(2);

      await expect(wizard.runWithTitle()).toBeVisible();
      await expect(wizard.allCheckboxes()).toHaveCount(2);
      // The only credential is the default pick; the system key is offered but not ticked.
      await expect(wizard.credentialCheckbox(gemini.label)).toBeChecked();
      await expect(wizard.systemKeyCheckbox()).not.toBeChecked();

      await wizard.credentialCheckbox(gemini.label).focus();
      await page.keyboard.press("Tab");
      await expect(wizard.systemKeyCheckbox()).toBeFocused();
      await page.keyboard.press("Space");
      await expect(wizard.systemKeyCheckbox()).toBeChecked();
      await page.keyboard.press("Space");
      await expect(wizard.systemKeyCheckbox()).not.toBeChecked();
    }
  );

  test(
    "danh sách checkbox là một nhóm có tên Run with",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-024"] },
    async ({ compareWizardPage: wizard, mpcCredentials }) => {
      await mpcCredentials.add("openrouter");
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.waitForOptions(2);

      await expect(wizard.runWithGroup()).toBeVisible();
      await expect(wizard.runWithGroup().getByRole("checkbox")).toHaveCount(2);
    }
  );

  test(
    "bỏ chọn hết thì Run match bị khoá, báo chọn ít nhất một key và không gửi request nào",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-025"] },
    async ({ compareWizardPage: wizard, mpcCredentials, network }) => {
      await mpcCredentials.add("openrouter");
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      const sent = network.recordRequests(/\/api\/v1\/match(\/runs)?$/, { method: "POST" });

      await wizard.selectOnly([]);

      await expect(wizard.runMatchButton()).toBeDisabled();
      await expect(wizard.privacyNotice()).toHaveText(t("credentials.runWith.privacyNone"));
      // No default comes back on its own.
      await expect(wizard.checkedBoxes()).toHaveCount(0);
      await wizard.runMatchButton().click({ force: true });
      await expect(wizard.reviewHeading()).toBeVisible();
      expect(sent).toHaveLength(0);
    }
  );

  test(
    "nút chạy nói rõ số provider sẽ chạy",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-026"] },
    async ({ compareWizardPage: wizard, mpcCredentials }) => {
      const first = await mpcCredentials.add("openrouter");
      const second = await mpcCredentials.add("gemini");
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      await wizard.selectOnly([first.label]);
      await expect(wizard.runMatchButton()).toHaveText(t("action.runMatch"));

      await wizard.selectOnly([first.label, SYSTEM]);
      await expect(wizard.runMatchButton()).toHaveText(t("action.runMatchCount", "en", { count: 2 }));

      await wizard.selectOnly([first.label, second.label, SYSTEM]);
      await expect(wizard.runMatchButton()).toHaveText(t("action.runMatchCount", "en", { count: 3 }));
    }
  );

  test(
    "thông báo quyền riêng tư nêu provider của mọi credential đã chọn",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-027"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcApi }) => {
      const labels = Object.fromEntries((await mpcApi.aiCredentials.providers()).json().map((p) => [p.id, p.label]));
      const gemini = await mpcCredentials.add("gemini");
      const openai = await mpcCredentials.add("openai");
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      await wizard.selectOnly([gemini.label, openai.label]);

      // Listed in picker order: newest credential first.
      await expect(wizard.privacyNotice()).toHaveText(
        t("credentials.runWith.privacyList", "en", { providers: [labels.openai, labels.gemini].join(", ") })
      );
    }
  );

  test(
    "thông báo quyền riêng tư nêu OpenRouter cho key hệ thống",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-028"] },
    async ({ compareWizardPage: wizard, mpcApi }) => {
      const openrouter = (await mpcApi.aiCredentials.providers()).json().find((p) => p.id === "openrouter")!.label;
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      // No credentials: the system key is the sole default selection.
      await expect(wizard.systemKeyCheckbox()).toBeChecked();
      await expect(wizard.privacyNotice()).toContainText(openrouter);
    }
  );
});

test.describe("bước 3 của khách", () => {
  test(
    "khách không thấy khối chọn và chạy đúng một card bằng key hệ thống",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-029", "@creates-data"] },
    async ({ guestCompareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: { overallScore: 73 } } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      await expect(wizard.runWithTitle()).toBeHidden();
      await expect(wizard.allCheckboxes()).toHaveCount(0);
      await expect(wizard.runMatchButton()).toHaveText(t("action.runMatch"));

      const runId = await wizard.runMatch();

      await expect(wizard.card(0).scoreText(73)).toBeVisible();
      await expect(wizard.cardRoots()).toHaveCount(1);
      expect(mpcMatchStub.calls()).toHaveLength(1);
      expect(mpcMatchStub.calls()[0].body).toMatchObject({ runId });
      expect(mpcMatchStub.calls()[0].body).not.toHaveProperty("credentialId");
    }
  );

  test(
    "khách được báo tài liệu sẽ gửi tới OpenRouter trước khi chạy",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-030", "@creates-data"] },
    async ({ guestCompareWizardPage: wizard }) => {
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      await expect(wizard.runMatchButton()).toBeEnabled();
      await expect(wizard.systemPrivacyNotice()).toBeVisible();
    }
  );
});
