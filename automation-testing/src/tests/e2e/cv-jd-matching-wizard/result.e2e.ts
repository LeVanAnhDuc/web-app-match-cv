import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";
import {
  CV_TEXT,
  JD_TEXT,
  MATCH_URL,
  failedMatchStub,
  matchResultStub,
  uniqueText,
} from "@/data/test-data/cv-jd-matching-wizard";

// Step 4 (REQ-40–43): loading skeleton, the report, provider failures and the per-card actions. POST /match is stubbed
// (D1) with the body shapes the server returns; everything before it is the real backend.

test.describe("step 4 — result", () => {
  test(
    "trong lúc chấm thẻ hiện skeleton có tiêu đề System key",
    { tag: ["@TC-CVJDMATCHINGWIZARD-051"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201, delayMs: 3_000 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();

      await expect(wizardPage.busyCard()).toBeVisible();
      await expect(wizardPage.busyCard()).toContainText(t("credentials.systemKey"));
      await expect(wizardPage.resultRegion()).toBeAttached();
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();
      await expect(wizardPage.busyCard()).toHaveCount(0);
    }
  );

  test(
    "kết quả thành công hiện tiêu đề provider, ba điểm phần trăm và báo cáo mở sẵn",
    { tag: ["@TC-CVJDMATCHINGWIZARD-052", "@smoke"] },
    async ({ wizardPage, wizardApi, network }) => {
      const result = matchResultStub();
      await network.stubJson(MATCH_URL, result, { method: "POST", status: 201 });
      const providers = await wizardApi.aiCredentials.providers();
      expect(providers.status).toBe(200);
      const label = providers.json().find((p) => p.id === result.provider)?.label ?? result.provider;

      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();

      await expect(wizardPage.cardTitle(`${label} · ${result.chatModel}`)).toBeVisible();
      for (const [kind, value] of [
        ["overall", result.overallScore],
        ["semantic", result.semanticScore],
        ["keyword", result.keywordScore],
      ] as const) {
        await expect(wizardPage.scoreLabel(kind)).toBeVisible();
        await expect(wizardPage.scoreMeter(kind)).toHaveAttribute("aria-valuenow", String(value));
        await expect(wizardPage.scoreText(value)).toBeVisible();
      }
      // Report open by default (single provider): no "Show full report" toggle, every item readable.
      await expect(wizardPage.showReportToggle()).toHaveCount(0);
      for (const list of ["strengths", "gaps", "suggestions"] as const) {
        await expect(wizardPage.reportHeading(list)).toBeVisible();
        for (const item of result.report[list]) await expect(wizardPage.reportItem(item)).toBeVisible();
      }
      await expect(wizardPage.shell.main()).not.toContainText('"strengths"');
      await expect(wizardPage.shell.main()).not.toContainText("0.82");
    }
  );

  test(
    "provider lỗi hiện đúng lý do và Try again chạy lại",
    { tag: ["@TC-CVJDMATCHINGWIZARD-053"] },
    async ({ wizardPage, network }) => {
      // Later routes win: the first POST /match gets the failed body, the retry falls through to the success stub.
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await network.stubOnce(MATCH_URL, failedMatchStub("no_quota"), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();

      await expect(wizardPage.resultError("no_quota")).toBeVisible();
      await expect(wizardPage.scoreMeter("overall")).toHaveCount(0);

      await wizardPage.tryAgainButton().click();

      await expect(wizardPage.scoreMeter("overall")).toBeVisible();
      await expect(wizardPage.resultError("no_quota")).toHaveCount(0);
    }
  );

  for (const failure of ["503", "network"] as const) {
    test(
      `lỗi 503 hoặc mất mạng khi chấm hiện alert có Try again (${failure})`,
      { tag: ["@TC-CVJDMATCHINGWIZARD-054"] },
      async ({ wizardPage, network }) => {
        if (failure === "503") await network.failWith(MATCH_URL, 503, { method: "POST" });
        else await network.abort(MATCH_URL, { method: "POST" });
        await wizardPage.goto();
        await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
        await wizardPage.runMatch();

        await expect(wizardPage.inlineAlert()).toBeVisible();
        await expect(wizardPage.tryAgainButton()).toBeVisible();
        await expect(wizardPage.busyCard()).toHaveCount(0);
      }
    );
  }

  test(
    "user đăng nhập thấy Improve my CV và cover letter, không thấy so sánh khi CV không có bản trước",
    { tag: ["@TC-CVJDMATCHINGWIZARD-055"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();

      await expect(wizardPage.improveCvButton()).toBeVisible();
      await expect(wizardPage.coverLetterButton()).toBeVisible();
      await expect(wizardPage.compareVersionsButton()).toHaveCount(0);
    }
  );

  test(
    "CV có phiên bản trước thì hiện Compare versions",
    { tag: ["@TC-CVJDMATCHINGWIZARD-056"] },
    async ({ wizardPage, wizardApi, network }) => {
      const v1 = await wizardApi.documents.create({ kind: "CV", save: true, title: uniqueText("CV v1"), sourceText: CV_TEXT });
      const v2Title = uniqueText("CV v2");
      const v2 = await wizardApi.documents.create({ kind: "CV", save: true, title: v2Title, sourceText: `${CV_TEXT} GraphQL.` });
      expect((await wizardApi.documents.setParent(v2.json().id, v1.json().id)).status).toBe(200);
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });

      await wizardPage.goto();
      await wizardPage.submitJd(uniqueText(JD_TEXT));
      await wizardPage.savedRadio(v2Title).check();
      await wizardPage.nextButton().click();
      await expect(wizardPage.stepHeading("review")).toBeVisible();
      await wizardPage.runMatch();

      await expect(wizardPage.compareVersionsButton()).toBeVisible();
    }
  );
});
