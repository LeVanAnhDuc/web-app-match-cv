import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { guestQuotaBody, MPC_TEXT, SYSTEM } from "@/data/test-data/multi-provider-compare";

// What a finished card offers: follow-up actions for a signed-in user, nothing but scores/report for a guest, and the
// guest quota gate / "kept for 24 hours" pitch. Only presence is checked here; the actions belong to their own modules.

test.describe("action trên card của user", () => {
  test(
    "card thành công có Improve my CV và Write cover letter, không có Compare khi CV chưa có bản trước",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-056"] },
    async ({ compareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: {} } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();

      const card = wizard.card(0);
      await expect(card.improveCvButton()).toBeVisible();
      await expect(card.coverLetterButton()).toBeVisible();
      await expect(card.compareVersionsButton()).toHaveCount(0);
    }
  );

  test(
    "Compare versions hiện khi CV có phiên bản trước",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-057"] },
    async ({ compareWizardPage: wizard, mpcSeed }) => {
      const run = await mpcSeed.run({ cvParentText: "Seeded CV, the earlier version." });
      await mpcSeed.result(run, 1);

      await wizard.gotoRun(run.runId);

      await expect(wizard.card(0).improveCvButton()).toBeVisible();
      await expect(wizard.card(0).compareVersionsButton()).toBeVisible();
    }
  );

  test(
    "trên mobile mỗi action cao ít nhất 44px và rộng hết card",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-058"] },
    async ({ compareWizardPage: wizard, mpcSeed }, testInfo) => {
      test.skip(testInfo.project.name !== "app-mobile", "the 44 px full-width rule only applies below md (mobile project)");
      const run = await mpcSeed.run({ cvParentText: "Seeded CV, the earlier version." });
      await mpcSeed.result(run, 1);

      await wizard.gotoRun(run.runId);
      const card = wizard.card(0);
      await expect(card.compareVersionsButton()).toBeVisible();

      const cardBox = (await card.root.boundingBox())!;
      for (const action of [card.improveCvButton(), card.coverLetterButton(), card.compareVersionsButton()]) {
        const box = (await action.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        // Full width of the card header (its horizontal padding aside).
        expect(box.width).toBeGreaterThanOrEqual(cardBox.width - 48);
      }
    }
  );
});

test.describe("card của khách", () => {
  test(
    "card của khách không có action nào",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-059", "@creates-data"] },
    async ({ guestCompareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: { overallScore: 70 } } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();

      const card = wizard.card(0);
      await expect(card.scoreText(70)).toBeVisible();
      await expect(card.improveCvButton()).toHaveCount(0);
      await expect(card.coverLetterButton()).toHaveCount(0);
      await expect(card.compareVersionsButton()).toHaveCount(0);
    }
  );

  test(
    "khách hết lượt thì card hiện cổng đăng nhập hết lượt",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-060", "@creates-data"] },
    async ({ guestCompareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({
        [SYSTEM]: { status: 429, body: guestQuotaBody(5, serverMessage("matching.errors.guestQuota")) },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();

      await expect(wizard.card(0).quotaGateTitle(5)).toBeVisible();
      await expect(wizard.card(0).meters()).toHaveCount(0);
      await expect(wizard.keepCalloutTitle()).toBeHidden();
    }
  );

  test(
    "khung giữ 24 giờ chỉ hiện khi đã có card thành công",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-061", "@creates-data"] },
    async ({ guestCompareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({
        [SYSTEM]: [
          { result: { status: "failed", errorCode: "unreachable", overallScore: 0, semanticScore: 0, keywordScore: 0 } },
          { result: { overallScore: 74 } },
        ],
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();

      await expect(wizard.card(0).errorAlert()).toBeVisible();
      await expect(wizard.keepCalloutTitle()).toBeHidden();

      await wizard.card(0).tryAgain();

      await expect(wizard.card(0).scoreText(74)).toBeVisible();
      await expect(wizard.keepCalloutTitle()).toBeVisible();
    }
  );
});
