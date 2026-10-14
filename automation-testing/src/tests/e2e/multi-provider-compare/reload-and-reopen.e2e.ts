import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { MPC_TEXT, STUB_CHAT_MODEL, SYSTEM } from "@/data/test-data/multi-provider-compare";

// A run outlives the page only through /wizard?runId= (Q2: a plain reload drops it and must not re-fire). Stored runs
// are seeded through the API (documents, run) and the DB (results — no endpoint writes one without calling AI).

test.describe("tải lại và mở lại run", () => {
  test(
    "tải lại giữa lúc chạy không gửi lại POST /match và về bước 1",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-047", "@smoke"] },
    async ({ compareWizardPage: wizard, mpcMatchStub, network }) => {
      await mpcMatchStub.script({ [SYSTEM]: { result: {}, delayMs: 10_000 } });
      await wizard.goto();
      await wizard.advanceToReview(MPC_TEXT.jd, MPC_TEXT.cv);
      await wizard.runMatch();
      await expect.poll(() => mpcMatchStub.calls().length).toBe(1);

      const firedAfterReload = network.recordRequests("**/api/v1/match", { method: "POST" });
      await wizard.reload();

      // Re-firing would silently double the AI spend; the run is simply gone from this tab.
      await expect(wizard.stepperStep(1)).toHaveAttribute("data-status", "active");
      await expect(wizard.resultsRegion()).toHaveCount(0);
      expect(firedAfterReload).toHaveLength(0);
    }
  );

  test(
    "mở /wizard?runId hiện kết quả đã lưu, không gửi POST /match và bỏ runId khỏi URL",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-048", "@smoke"] },
    async ({ compareWizardPage: wizard, mpcSeed, mpcApi, network, page }) => {
      const labels = Object.fromEntries((await mpcApi.aiCredentials.providers()).json().map((p) => [p.id, p.label]));
      const run = await mpcSeed.run();
      await mpcSeed.result(run, 1, { provider: "gemini", chatModel: STUB_CHAT_MODEL.gemini, scores: [72, 80, 60] });
      await mpcSeed.result(run, 2, { scores: [64, 70, 55] });
      const fired = network.recordRequests("**/api/v1/match", { method: "POST" });

      await wizard.gotoRun(run.runId);

      await expect(wizard.cardRoots()).toHaveCount(2);
      await expect(wizard.card(0).title()).toHaveText(`${labels.gemini} · ${STUB_CHAT_MODEL.gemini}`);
      await expect(wizard.card(0).meter("overall")).toHaveAttribute("aria-valuenow", "72");
      await expect(wizard.card(1).title()).toHaveText(`${labels.openrouter} · ${STUB_CHAT_MODEL.openrouter}`);
      await expect(wizard.card(1).meter("overall")).toHaveAttribute("aria-valuenow", "64");
      await expect(wizard.stepperStep(4)).toHaveAttribute("data-status", "active");
      await expect(page).not.toHaveURL(/runId=/);
      expect(fired).toHaveLength(0);
    }
  );

  test(
    "trong lúc đọc run hiện khung chờ aria-busy",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-049"] },
    async ({ compareWizardPage: wizard, mpcSeed, mpcRunReads }) => {
      const run = await mpcSeed.run();
      await mpcSeed.result(run, 1, { scores: [69, 70, 67] });
      await mpcRunReads.delay(3_000);

      await wizard.gotoRun(run.runId);

      await expect(wizard.busyPlaceholder()).toBeVisible();
      await expect(wizard.card(0).scoreText(69)).toBeVisible({ timeout: 15_000 });
      await expect(wizard.busyPlaceholder()).toHaveCount(0);
    }
  );

  test(
    "runId không tồn tại báo No run to show và về bước 1",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-050"] },
    async ({ compareWizardPage: wizard, page }) => {
      await wizard.gotoRun(randomUUID());

      await expect(wizard.toast(t("result.missingRun"))).toBeVisible();
      await expect(wizard.stepperStep(1)).toHaveAttribute("data-status", "active");
      await expect(page).not.toHaveURL(/runId=/);
    }
  );

  test(
    "đọc run lỗi khác 404 báo We couldn't run the match và về bước 1",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-051"] },
    async ({ compareWizardPage: wizard, mpcSeed, network }) => {
      const run = await mpcSeed.run();
      await network.failWith("**/api/v1/match/runs/*", 500, { method: "GET" });

      await wizard.gotoRun(run.runId);

      await expect(wizard.toast(t("err.matchFailed"))).toBeVisible();
      await expect(wizard.stepperStep(1)).toHaveAttribute("data-status", "active");
    }
  );

  test(
    "run chưa có kết quả hiện Nothing finished yet thay vì màn trống",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-052"] },
    async ({ compareWizardPage: wizard, mpcSeed }) => {
      const run = await mpcSeed.run();

      await wizard.gotoRun(run.runId);

      await expect(wizard.emptyRunTitle()).toBeVisible();
      await expect(wizard.emptyRunHint()).toBeVisible();
      await expect(wizard.stepperStep(4)).toHaveAttribute("data-status", "active");
    }
  );

  test(
    "run có lần lỗi và lần thử lại hiện đủ cả hai card theo thứ tự",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-053"] },
    async ({ compareWizardPage: wizard, mpcSeed }) => {
      const run = await mpcSeed.run();
      await mpcSeed.result(run, 1, { status: "failed", errorCode: "timeout", scores: [0, 0, 0] });
      await mpcSeed.result(run, 2, { scores: [81, 85, 75] });

      await wizard.gotoRun(run.runId);

      await expect(wizard.cardRoots()).toHaveCount(2);
      await expect(wizard.card(0).errorAlert()).toContainText(t("result.error.timeout"));
      await expect(wizard.card(1).scoreText(81)).toBeVisible();
    }
  );

  test(
    "đọc lại run ở bước 4 trả 404 thì báo No run to show kèm Start over",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-054"] },
    async ({ compareWizardPage: wizard, mpcSeed, mpcRunReads }) => {
      const run = await mpcSeed.run();
      await mpcSeed.result(run, 1);
      // The reopen read succeeds; step 4's own read (React Query refetch on mount) is the one that fails.
      await mpcRunReads.failAfterFirst(404);

      await wizard.gotoRun(run.runId);

      // The client retries a failed read three times (≈ 7 s) before it gives up.
      await expect(wizard.stepAlert()).toHaveText(t("result.missingRun"), { timeout: 30_000 });
      await expect(wizard.startOverButton()).toBeVisible();
    }
  );

  test(
    "đọc lại run ở bước 4 lỗi 500 thì báo We couldn't run the match kèm Start over",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-055"] },
    async ({ compareWizardPage: wizard, mpcSeed, mpcRunReads }) => {
      const run = await mpcSeed.run();
      await mpcSeed.result(run, 1);
      await mpcRunReads.failAfterFirst(500);

      await wizard.gotoRun(run.runId);

      await expect(wizard.stepAlert()).toHaveText(t("err.matchFailed"), { timeout: 30_000 });
      await expect(wizard.startOverButton()).toBeVisible();
    }
  );
});
