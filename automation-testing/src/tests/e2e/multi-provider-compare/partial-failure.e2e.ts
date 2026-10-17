import { test, expect } from "@/fixtures";
import { t, serverMessage } from "@/data/copy";
import { MPC_ERROR_CODES, MPC_TEXT, SYSTEM } from "@/data/test-data/multi-provider-compare";

// Partial success: a provider that fails is that card's outcome only. Failures come from the stubbed POST /match (D1):
// a 201 with status=failed + errorCode, or an HTTP error status.

test.describe("lỗi từng phần", () => {
  test(
    "một provider lỗi thì card khác vẫn giữ kết quả",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-042", "@smoke"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const dead = await mpcCredentials.add("gemini", "dead");
      await mpcMatchStub.script({
        [dead.id]: { result: { status: "failed", errorCode: "no_quota", overallScore: 0, semanticScore: 0, keywordScore: 0 } },
        [SYSTEM]: { result: { overallScore: 91 } },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([dead.label, SYSTEM]);
      await wizard.runMatch();

      await expect(wizard.card(0).errorAlert()).toContainText(t("result.error.no_quota"));
      await expect(wizard.card(1).scoreText(91)).toBeVisible();
      await expect(wizard.card(1).meters()).toHaveCount(3);
      await expect(wizard.card(1).errorAlert()).toHaveCount(0);
    }
  );

  test(
    "mỗi errorCode hiện câu riêng, không thành điểm 0% hay mã lỗi thô",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-043"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      // Five cards in one run, one per errorCode: four credentials plus the system key.
      const credentials = [
        await mpcCredentials.add("openrouter", "one"),
        await mpcCredentials.add("openai", "two"),
        await mpcCredentials.add("gemini", "three"),
        await mpcCredentials.add("openrouter", "four"),
      ];
      const keys = [...credentials.map((c) => c.id), SYSTEM];
      const codeOf = Object.fromEntries(keys.map((key, i) => [key, MPC_ERROR_CODES[i]]));
      await mpcMatchStub.script(
        Object.fromEntries(
          keys.map((key) => [
            key,
            { result: { status: "failed" as const, errorCode: codeOf[key], overallScore: 0, semanticScore: 0, keywordScore: 0 } },
          ])
        )
      );
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      // Tick in picker row order (newest credential first, then the system key) so this case checks the errorCode
      // sentences only; card ORDER is TC-MULTIPROVIDERCOMPARE-035's job.
      await wizard.selectOnly([...credentials.map((c) => c.label).reverse(), SYSTEM]);
      await wizard.runMatch();

      const order = [...credentials.map((c) => c.id).reverse(), SYSTEM];
      for (const [index, key] of order.entries()) {
        const card = wizard.card(index);
        await expect(card.errorAlert()).toContainText(t(`result.error.${codeOf[key]}`));
        await expect(card.tryAgainButton()).toBeVisible();
        await expect(card.meters()).toHaveCount(0);
      }
      const shown = await wizard.resultsRegion().innerText();
      expect(shown).not.toContain("0%");
      for (const code of MPC_ERROR_CODES) expect(shown).not.toContain(code);
    }
  );

  test(
    "Try again chỉ gửi lại card bị lỗi",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-044"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const flaky = await mpcCredentials.add("openrouter", "flaky");
      await mpcMatchStub.script({
        [flaky.id]: [
          { result: { status: "failed", errorCode: "timeout", overallScore: 0, semanticScore: 0, keywordScore: 0 } },
          { result: { overallScore: 77 } },
        ],
        [SYSTEM]: { result: { overallScore: 64 } },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([flaky.label, SYSTEM]);
      await wizard.runMatch();
      await expect(wizard.card(0).errorAlert()).toContainText(t("result.error.timeout"));
      await expect(wizard.card(1).scoreText(64)).toBeVisible();

      await wizard.card(0).tryAgain();

      await expect(wizard.card(0).scoreText(77)).toBeVisible();
      await expect(wizard.card(1).scoreText(64)).toBeVisible();
      expect(mpcMatchStub.calls(flaky.id)).toHaveLength(2);
      expect(mpcMatchStub.calls(SYSTEM)).toHaveLength(1);
    }
  );

  test(
    "lỗi HTTP của một card hiện trạng thái lỗi có Try again, card khác không bị ảnh hưởng",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-045"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const gone = await mpcCredentials.add("openai", "gone");
      await mpcMatchStub.script({
        [gone.id]: { status: 404, body: { statusCode: 404, message: serverMessage("aiCredentials.errors.notFound") } },
        [SYSTEM]: { result: { overallScore: 58 } },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([gone.label, SYSTEM]);
      await wizard.runMatch();

      await expect(wizard.card(0).errorAlert()).toBeVisible();
      await expect(wizard.card(0).tryAgainButton()).toBeVisible();
      await expect(wizard.card(0).meters()).toHaveCount(0);
      await expect(wizard.card(1).scoreText(58)).toBeVisible();
    }
  );

  test(
    "lỗi HTTP của một card hiện message của server",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-046"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const gone = await mpcCredentials.add("openai", "gone");
      await mpcMatchStub.script({
        [gone.id]: { status: 404, body: { statusCode: 404, message: serverMessage("aiCredentials.errors.notFound") } },
        [SYSTEM]: { result: {} },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([gone.label, SYSTEM]);
      await wizard.runMatch();

      // "Could not reach the provider." is for a network failure only; the server said exactly what went wrong.
      await expect(wizard.card(0).errorAlert()).toContainText(serverMessage("aiCredentials.errors.notFound"));
    }
  );
});
