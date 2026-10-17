import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { MPC_TEXT, RAW_KEY_PATTERN, SYSTEM } from "@/data/test-data/multi-provider-compare";

// Vietnamese through the dev hook window.__i18n (no language switcher in the app — D4). English is what every other
// spec of the module asserts.

test.describe("tiếng Việt", () => {
  test(
    "bước 3 và bước 4 hiện tiếng Việt, không lộ key thô",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-062"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub, mpcApi }) => {
      const gemini = await mpcCredentials.add("gemini");
      const geminiLabel = (await mpcApi.aiCredentials.providers()).json().find((p) => p.id === "gemini")!.label;
      await mpcMatchStub.script({
        [gemini.id]: { result: { status: "failed", errorCode: "no_quota", overallScore: 0, semanticScore: 0, keywordScore: 0 } },
        [SYSTEM]: { result: { overallScore: 68 }, delayMs: 3_000 },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.setLanguage("vi");

      await wizard.selectOnly([gemini.label, SYSTEM]);
      await expect(wizard.runWithTitle()).toHaveText(t("credentials.runWith.title", "vi"));
      await expect(wizard.runMatchButton()).toHaveText(t("action.runMatchCount", "vi", { count: 2 }));
      await expect(wizard.privacyNotice()).toHaveText(
        t("credentials.runWith.privacyList", "vi", { providers: `${geminiLabel}, ${t("credentials.runWith.privacySystemEntry", "vi")}` })
      );
      expect(await wizard.shell.main().innerText()).not.toMatch(RAW_KEY_PATTERN);

      await wizard.runMatch();

      await expect(wizard.card(1).title()).toHaveText(t("credentials.systemKey", "vi"));
      await expect(wizard.card(0).errorAlert()).toContainText(t("result.error.no_quota", "vi"));
      await expect(wizard.card(0).tryAgainButton()).toHaveText(t("action.tryAgain", "vi"));
      await expect(wizard.card(1).showReportToggle()).toHaveText(t("result.card.showReport", "vi"));
      expect(await wizard.shell.main().innerText()).not.toMatch(RAW_KEY_PATTERN);
    }
  );

  test(
    "run chưa có kết quả hiện trạng thái rỗng bằng tiếng Việt",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-063"] },
    async ({ compareWizardPage: wizard, mpcSeed }) => {
      const run = await mpcSeed.run();

      await wizard.gotoRun(run.runId);
      await wizard.setLanguage("vi");

      await expect(wizard.emptyRunTitle()).toBeVisible();
      await expect(wizard.emptyRunHint()).toBeVisible();
      expect(await wizard.shell.main().innerText()).not.toMatch(RAW_KEY_PATTERN);
    }
  );
});
