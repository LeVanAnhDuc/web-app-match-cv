import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import {
  CV_TEXT,
  JD_TEXT,
  MATCH_URL,
  OTHER_JD_TEXT,
  matchResultStub,
  uniqueText,
} from "@/data/test-data/cv-jd-matching-wizard";
import { insertMatchResult } from "@/utils/db";

// Stepper, Back/Next transitions, Start over, reload and /wizard?runId= (REQ-01, 02, 05, 06, 07, 09, 44).
// Every test runs as its own fresh user (fixture wizardUser) and stubs only POST /match (D1).

test.describe("stepper & state", () => {
  test(
    "wizard mở ở bước 1 với stepper 4 bước đúng thứ tự",
    { tag: ["@TC-CVJDMATCHINGWIZARD-001", "@smoke"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();

      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("aria-current", "step");
      for (const step of [2, 3, 4] as const) {
        await expect(wizardPage.stepperDot(step)).not.toHaveAttribute("aria-current", "step");
      }
      // Labels stay in the accessibility tree at every viewport (sr-only below md), in order JD → CV → Review → Result.
      const boxes = [];
      for (const step of [1, 2, 3, 4] as const) {
        await expect(wizardPage.stepLabel(step)).toHaveCount(1);
        boxes.push(await wizardPage.stepperDot(step).boundingBox());
      }
      for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
    }
  );

  test(
    "bước chưa có dữ liệu bị chặn, bước đã xong chỉ cho nhảy lùi",
    { tag: ["@TC-CVJDMATCHINGWIZARD-002"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      for (const step of [2, 3, 4] as const) {
        await expect(wizardPage.stepperDot(step)).toHaveAttribute("aria-disabled", "true");
        await expect(wizardPage.stepBlockedHint(step)).toHaveText(wizardPage.blockedHintText(step));
      }

      await wizardPage.submitJd(uniqueText(JD_TEXT));
      // Step 1 is done → a "Go to …" button; step 2 is current; steps 3–4 are still blocked and not buttons.
      await expect(wizardPage.stepJumpButton(1)).toBeVisible();
      await expect(wizardPage.stepperDot(2)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.stepperDot(3)).toHaveAttribute("aria-disabled", "true");
      await expect(wizardPage.stepJumpButton(3)).toHaveCount(0);
      await expect(wizardPage.stepJumpButton(4)).toHaveCount(0);

      await wizardPage.jumpTo(1);
      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      // Nothing ahead of the current step can be clicked.
      await expect(wizardPage.stepJumpButton(2)).toHaveCount(0);
    }
  );

  test(
    "Back ở bước 2 và bước 3 giữ tài liệu đã nạp",
    { tag: ["@TC-CVJDMATCHINGWIZARD-003"] },
    async ({ wizardPage }) => {
      // BUG: defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-01
      test.fail();
      const jd = uniqueText(JD_TEXT);
      const cv = uniqueText(CV_TEXT);
      await wizardPage.goto();
      await wizardPage.advanceToReview(jd, cv);

      await wizardPage.backButton().click();
      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      // The CV is still chosen: going forward again needs no new input.
      await expect(wizardPage.nextButton()).toBeEnabled();
      await wizardPage.nextButton().click();
      await expect(wizardPage.stepHeading("review")).toBeVisible();
      await expect(wizardPage.reviewText(cv)).toBeVisible();
      await expect(wizardPage.reviewText(jd)).toBeVisible();

      await wizardPage.backButton().click();
      await wizardPage.backButton().click();
      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.nextButton()).toBeEnabled();
    }
  );

  test(
    "đổi JD sau khi đã chạy match thì chặn lại bước 4",
    { tag: ["@TC-CVJDMATCHINGWIZARD-004"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();

      await wizardPage.jumpTo(1);
      await wizardPage.submitJd(uniqueText(OTHER_JD_TEXT));

      await expect(wizardPage.stepperDot(4)).toHaveAttribute("aria-disabled", "true");
      await expect(wizardPage.stepBlockedHint(4)).toHaveText(wizardPage.blockedHintText(4));
    }
  );

  test(
    "chọn lại đúng JD đã lưu sau khi chạy match thì không mất kết quả",
    { tag: ["@TC-CVJDMATCHINGWIZARD-005"] },
    async ({ wizardPage, wizardApi, network }) => {
      const title = uniqueText("Saved JD");
      const saved = await wizardApi.documents.create({ kind: "JD", save: true, title, sourceText: JD_TEXT });
      expect(saved.status).toBe(201);
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });

      await wizardPage.goto();
      await wizardPage.savedRadio(title).check();
      await wizardPage.nextButton().click();
      await wizardPage.stepHeading("cv").waitFor();
      await wizardPage.submitCv(uniqueText(CV_TEXT));
      await wizardPage.runMatch();
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();

      await wizardPage.jumpTo(1);
      await wizardPage.savedRadio(title).check();
      await wizardPage.nextButton().click();
      await expect(wizardPage.stepHeading("cv")).toBeVisible();

      await expect(wizardPage.stepperDot(4)).not.toHaveAttribute("aria-disabled", "true");
    }
  );

  test(
    "Start over ở bước 4 đưa wizard về bước 1 trống",
    { tag: ["@TC-CVJDMATCHINGWIZARD-006"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();

      await wizardPage.startOverButton().click();

      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.backButton()).toBeDisabled();
      await expect(wizardPage.nextButton()).toBeDisabled();
      for (const step of [2, 3, 4] as const) {
        await expect(wizardPage.stepperDot(step)).toHaveAttribute("aria-disabled", "true");
      }
    }
  );

  test(
    "tải lại trang giữa wizard đưa về bước 1 trống",
    { tag: ["@TC-CVJDMATCHINGWIZARD-008"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.submitJd(uniqueText(JD_TEXT));

      await wizardPage.reload();

      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.stepperDot(2)).toHaveAttribute("aria-disabled", "true");
      await expect(wizardPage.nextButton()).toBeDisabled();
    }
  );

  test(
    "mở /wizard?runId= của mình vào thẳng bước 4 với kết quả đã lưu, không gọi AI",
    { tag: ["@TC-CVJDMATCHINGWIZARD-009"] },
    async ({ wizardPage, wizardApi, wizardUser, network }) => {
      const cv = (await wizardApi.documents.create({ kind: "CV", save: false, sourceText: CV_TEXT })).json();
      const jd = (await wizardApi.documents.create({ kind: "JD", save: false, sourceText: JD_TEXT })).json();
      const run = await wizardApi.match.createRun({ cvDocumentId: cv.id, jdDocumentId: jd.id });
      expect(run.status).toBe(201);
      const runId = run.json().id;
      const stored = matchResultStub({ overallScore: 77, semanticScore: 81, keywordScore: 71 });
      await insertMatchResult({
        userId: wizardUser.userId,
        cvDocumentId: cv.id,
        jdDocumentId: jd.id,
        runId,
        scores: [stored.overallScore, stored.semanticScore, stored.keywordScore],
        report: stored.report,
      });
      const aiCalls = network.recordRequests(MATCH_URL, { method: "POST" });

      await wizardPage.goto({ runId });

      await expect(wizardPage.stepperDot(4)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.scoreMeter("overall")).toHaveAttribute("aria-valuenow", "77");
      await expect(wizardPage.scoreMeter("semantic")).toHaveAttribute("aria-valuenow", "81");
      await expect(wizardPage.scoreMeter("keyword")).toHaveAttribute("aria-valuenow", "71");
      await expect(wizardPage.reportItem(stored.report.strengths[0])).toBeVisible();
      await expect(wizardPage.page).not.toHaveURL(/runId=/);
      expect(aiCalls).toHaveLength(0);
    }
  );

  test(
    "runId không tồn tại đưa về bước 1 kèm thông báo",
    { tag: ["@TC-CVJDMATCHINGWIZARD-010"] },
    async ({ wizardPage }) => {
      await wizardPage.goto({ runId: randomUUID() });

      await expect(wizardPage.toast("result.missingRun")).toBeVisible();
      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.page).not.toHaveURL(/runId=/);
    }
  );
});
