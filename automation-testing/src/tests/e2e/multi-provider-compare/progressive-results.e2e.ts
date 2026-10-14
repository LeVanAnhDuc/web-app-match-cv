import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { MPC_TEXT, STUB_CHAT_MODEL, STUB_REPORT, SYSTEM } from "@/data/test-data/multi-provider-compare";

// Step 4 of a live run: one card per selected provider, each firing its own POST /match (stubbed per card, D1) and
// rendering as soon as its own answer lands.

test.describe("bước 4 — N card hiện dần", () => {
  test(
    "hai provider cho hai card theo thứ tự danh sách, tiêu đề lấy từ chính kết quả",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-035", "@smoke"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub, mpcApi }) => {
      const labels = Object.fromEntries((await mpcApi.aiCredentials.providers()).json().map((p) => [p.id, p.label]));
      const gemini = await mpcCredentials.add("gemini");
      // The system-key row answers as "openai · stub-model-x": the card must show what the RESULT says, not the
      // "System key" row it was picked from.
      await mpcMatchStub.script({
        [gemini.id]: { result: { provider: "gemini", chatModel: STUB_CHAT_MODEL.gemini, overallScore: 71 } },
        [SYSTEM]: { result: { provider: "openai", chatModel: "stub-model-x", overallScore: 84 } },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);

      // Ticked system key first: the cards still follow the picker's row order (credential rows, then system key).
      await wizard.selectOnly([SYSTEM, gemini.label]);
      await wizard.runMatch();

      await expect(wizard.cardRoots()).toHaveCount(2);
      await expect(wizard.card(0).title()).toHaveText(`${labels.gemini} · ${STUB_CHAT_MODEL.gemini}`);
      await expect(wizard.card(1).title()).toHaveText(`${labels.openai} · stub-model-x`);
      await expect(wizard.card(0).meter("overall")).toHaveAttribute("aria-valuenow", "71");
      await expect(wizard.card(1).meter("overall")).toHaveAttribute("aria-valuenow", "84");
    }
  );

  test(
    "mỗi card gửi đúng một POST /match cùng runId, key hệ thống không gửi credentialId",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-036", "@smoke"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub, network }) => {
      const openrouter = await mpcCredentials.add("openrouter");
      await mpcMatchStub.script({ [openrouter.id]: { result: {} }, [SYSTEM]: { result: {} } });
      await wizard.goto();
      const { jdId, cvId } = await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([openrouter.label, SYSTEM]);
      const runReads = network.recordRequests("**/api/v1/match/runs/*", { method: "GET" });

      const runId = await wizard.runMatch();
      await expect(wizard.card(0).meter("overall")).toBeVisible();
      await expect(wizard.card(1).meter("overall")).toBeVisible();

      expect(mpcMatchStub.calls()).toHaveLength(2);
      const [credentialCall] = mpcMatchStub.calls(openrouter.id);
      const [systemCall] = mpcMatchStub.calls(SYSTEM);
      expect(credentialCall.body).toEqual({ cvDocumentId: cvId, jdDocumentId: jdId, runId, credentialId: openrouter.id });
      expect(systemCall.body).toEqual({ cvDocumentId: cvId, jdDocumentId: jdId, runId });
      // A live run is driven by the cards' own requests: nothing polls the run.
      expect(runReads).toHaveLength(0);
    }
  );

  test(
    "card nhanh hiện kết quả trong khi card chậm còn đang chạy",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-037"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const slow = await mpcCredentials.add("gemini", "slow");
      await mpcMatchStub.script({
        [slow.id]: { result: { overallScore: 55 }, delayMs: 6_000 },
        [SYSTEM]: { result: { overallScore: 88 } },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([slow.label, SYSTEM]);
      await wizard.runMatch();

      await expect(wizard.card(1).scoreText(88)).toBeVisible();
      await expect(wizard.card(0).title()).toHaveText(t("result.card.pendingTitle"));
      await expect(wizard.card(0).meters()).toHaveCount(0);
      await expect(wizard.card(0).scoreText(55)).toBeVisible({ timeout: 15_000 });
    }
  );

  test(
    "card đang chạy được đánh dấu aria-busy",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-038"] },
    async ({ compareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: {}, delayMs: 8_000 } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();

      await expect(wizard.card(0).title()).toHaveText(t("credentials.systemKey"));
      await expect(wizard.card(0).root).toHaveAttribute("aria-busy", "true");
    }
  );

  test(
    "mọi request của run cùng chờ một lúc",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-039"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const a = await mpcCredentials.add("openrouter", "a");
      const b = await mpcCredentials.add("gemini", "b");
      await mpcMatchStub.script({
        [a.id]: { result: {}, delayMs: 2_500 },
        [b.id]: { result: {}, delayMs: 2_500 },
        [SYSTEM]: { result: {}, delayMs: 2_500 },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([a.label, b.label, SYSTEM]);
      await wizard.runMatch();

      for (const index of [0, 1, 2]) await expect(wizard.card(index).meter("overall")).toBeVisible({ timeout: 15_000 });
      // Parallel, not one after another: all three were waiting at the same moment, so the run lasts as long as the
      // slowest provider.
      expect(mpcMatchStub.maxInFlight()).toBe(3);
    }
  );

  test(
    "một provider: báo cáo mở sẵn với ba điểm phần trăm",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-040"] },
    async ({ compareWizardPage: wizard, mpcMatchStub }) => {
      await mpcMatchStub.script({
        [SYSTEM]: {
          result: {
            overallScore: 80,
            semanticScore: 90,
            keywordScore: 65,
            report: { strengths: [...STUB_REPORT.strengths], gaps: [...STUB_REPORT.gaps], suggestions: [...STUB_REPORT.suggestions] },
          },
        },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();

      const card = wizard.card(0);
      await expect(card.meter("overall")).toHaveAttribute("aria-valuenow", "80");
      await expect(card.meter("semantic")).toHaveAttribute("aria-valuenow", "90");
      await expect(card.meter("keyword")).toHaveAttribute("aria-valuenow", "65");
      for (const score of [80, 90, 65]) await expect(card.scoreText(score)).toBeVisible();
      await expect(card.strengthsHeading()).toBeVisible();
      for (const item of [...STUB_REPORT.strengths, ...STUB_REPORT.gaps, ...STUB_REPORT.suggestions]) {
        await expect(card.reportItem(item)).toBeVisible();
      }
      await expect(card.showReportToggle()).toBeHidden();
    }
  );

  test(
    "hai provider: báo cáo gập trong Show full report, điểm vẫn hiện",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-041"] },
    async ({ compareWizardPage: wizard, mpcCredentials, mpcMatchStub }) => {
      const gemini = await mpcCredentials.add("gemini");
      const report = { strengths: [...STUB_REPORT.strengths], gaps: [...STUB_REPORT.gaps], suggestions: [...STUB_REPORT.suggestions] };
      await mpcMatchStub.script({
        [gemini.id]: { result: { overallScore: 61, report } },
        [SYSTEM]: { result: { overallScore: 79, report } },
      });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.selectOnly([gemini.label, SYSTEM]);
      await wizard.runMatch();

      for (const [index, score] of [[0, 61], [1, 79]] as const) {
        const card = wizard.card(index);
        await expect(card.scoreText(score)).toBeVisible();
        await expect(card.showReportToggle()).toBeVisible();
        await expect(card.reportItem(STUB_REPORT.strengths[0])).toBeHidden();
      }

      await wizard.card(0).expandReport();
      await expect(wizard.card(0).reportItem(STUB_REPORT.strengths[0])).toBeVisible();
      await expect(wizard.card(1).reportItem(STUB_REPORT.strengths[0])).toBeHidden();
    }
  );
});
