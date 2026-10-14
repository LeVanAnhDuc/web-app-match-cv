import { test, expect } from "@/fixtures";
import { t, serverMessage } from "@/data/copy";
import { MPC_TEXT, SYSTEM } from "@/data/test-data/multi-provider-compare";

// Opening a run (POST /match/runs, real backend) and what happens to it when the pair changes. POST /match is stubbed
// per card (D1).

test.describe("mở run", () => {
  test(
    "Run match mở run và sang bước 4 trước khi AI trả lời",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-031", "@smoke"] },
    async ({ compareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: { overallScore: 66 }, delayMs: 4_000 } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      const runId = await wizard.runMatch();

      // Step 4 is on screen while the provider is still "thinking".
      await expect(wizard.stepperStep(4)).toHaveAttribute("data-status", "active");
      await expect(wizard.card(0).title()).toHaveText(t("credentials.systemKey"));
      await expect(wizard.card(0).meters()).toHaveCount(0);
      await expect.poll(() => mpcMatchStub.calls().length).toBe(1);
      expect(mpcMatchStub.calls()[0].answeredAt).toBeUndefined();
      // The card fires against the run that was just opened, and then lands.
      expect(mpcMatchStub.calls()[0].body).toMatchObject({ runId });
      await expect(wizard.card(0).scoreText(66)).toBeVisible({ timeout: 15_000 });
    }
  );

  test(
    "bấm Run match hai lần nhanh chỉ mở một run",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-032"] },
    async ({ compareWizardPage: wizard, mpcMatchStub, network }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: {} } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      const opened = network.recordRequests("**/api/v1/match/runs", { method: "POST" });

      await wizard.runMatchButton().dblclick();

      await expect(wizard.card(0).meter("overall")).toBeVisible();
      expect(opened).toHaveLength(1);
      expect(mpcMatchStub.calls()).toHaveLength(1);
    }
  );

  test(
    "mở run lỗi thì ở lại bước 3 với thông báo của server",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-033"] },
    async ({ compareWizardPage: wizard, mpcApi, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: {} } });
      await wizard.goto();
      const { jdId } = await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      // The JD disappears (deleted in another tab) before the run is opened: the real server refuses the pair.
      expect((await mpcApi.documents.remove(jdId)).status).toBe(204);

      await wizard.runMatchButton().click();

      await expect(wizard.stepAlert()).toHaveText(serverMessage("matching.errors.documentNotOwned"));
      await expect(wizard.reviewHeading()).toBeVisible();
      await expect(wizard.stepperStep(4)).not.toHaveAttribute("data-status", "active");
      expect(mpcMatchStub.calls()).toHaveLength(0);
    }
  );

  test(
    "đổi JD sau khi chạy thì bước 4 bị khoá cho tới khi chạy lại",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-034"] },
    async ({ compareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: { overallScore: 52 } } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();
      await expect(wizard.card(0).scoreText(52)).toBeVisible();

      await wizard.jumpToStepButton(1).click();
      await wizard.pasteDocument(MPC_TEXT.otherJd);
      await wizard.submitDocument();

      // The run belonged to the old pair: step 4 can no longer be reached until a new run is opened.
      await expect(wizard.stepperStep(2)).toHaveAttribute("data-status", "active");
      await expect(wizard.stepperStep(4)).toHaveAttribute("aria-disabled", "true");
      await expect(wizard.jumpToStepButton(4)).toBeHidden();
    }
  );
});
