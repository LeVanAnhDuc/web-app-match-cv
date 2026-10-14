import { expect, test } from "@/fixtures";
import { serverMessage, t } from "@/data/copy";
import {
  CV_TEXT,
  JD_TEXT,
  MATCH_RUNS_URL,
  MATCH_URL,
  matchResultStub,
  uniqueText,
} from "@/data/test-data/cv-jd-matching-wizard";
import { FILES } from "@/data/test-data/shared";
import { deleteDocuments } from "@/utils/db";

// Step 3 (REQ-24–28): read-only originals, loading/error states, who receives the text, default key, opening the run.
// Documents and runs hit the real backend; only POST /match is stubbed (D1).

test.describe("step 3 — review", () => {
  test(
    "bước 3 hiện hai tài liệu dán ở dạng chỉ đọc",
    { tag: ["@TC-CVJDMATCHINGWIZARD-044"] },
    async ({ wizardPage }) => {
      const jd = uniqueText(JD_TEXT);
      const cv = uniqueText(CV_TEXT);
      await wizardPage.goto();
      await wizardPage.advanceToReview(jd, cv);

      await expect(wizardPage.stepHeading("review")).toBeVisible();
      await expect(wizardPage.reviewDescription()).toBeVisible();
      await expect(wizardPage.reviewText(jd)).toBeVisible();
      await expect(wizardPage.reviewText(cv)).toBeVisible();
      await expect(wizardPage.editableFields()).toHaveCount(0);
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("data-status", "done");
      await expect(wizardPage.stepperDot(2)).toHaveAttribute("data-status", "done");
      await expect(wizardPage.stepperDot(3)).toHaveAttribute("aria-current", "step");
    }
  );

  test(
    "bước 3 xem trước được bản gốc PDF",
    { tag: ["@TC-CVJDMATCHINGWIZARD-045"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.chooseFile(FILES.pdf);
      await wizardPage.nextCreatingDocument();
      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      await wizardPage.chooseFile(FILES.pdf);
      await wizardPage.nextCreatingDocument();
      await expect(wizardPage.stepHeading("review")).toBeVisible();

      await expect(wizardPage.pdfCanvases()).toHaveCount(2, { timeout: 30_000 });
      await expect(wizardPage.previewError()).toHaveCount(0);
      await expect(wizardPage.editableFields()).toHaveCount(0);
    }
  );

  test(
    "tài liệu không còn thì bước 3 báo lỗi có lối thoát thay vì tải mãi",
    { tag: ["@TC-CVJDMATCHINGWIZARD-046"] },
    async ({ wizardPage }) => {
      // BUG: defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-06
      test.fail();
      await wizardPage.goto();
      const jdId = await wizardPage.submitJd(uniqueText(JD_TEXT));
      // The JD disappears between step 2 and step 3 (e.g. an expired guest document): GET /documents/:id → 404.
      await deleteDocuments([jdId]);
      await wizardPage.pasteText(uniqueText(CV_TEXT));
      await wizardPage.nextCreatingDocument();

      await expect(wizardPage.inlineAlert()).toBeVisible({ timeout: 20_000 });
      await expect(wizardPage.reviewLoading()).toHaveCount(0);
      await expect(wizardPage.backButton()).toBeVisible();
    }
  );

  test(
    "người đã đăng nhập thấy bên nhận nội dung CV/JD trước khi chạy",
    { tag: ["@TC-CVJDMATCHINGWIZARD-047"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));

      await expect(wizardPage.privacyNotice(t("credentials.systemKey"))).toBeVisible();
    }
  );

  test(
    "user chưa có khoá AI mặc định chạy bằng key hệ thống",
    { tag: ["@TC-CVJDMATCHINGWIZARD-048"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));

      await expect(wizardPage.systemKeyOption()).toBeChecked();
      await expect(wizardPage.runMatchButton()).toBeEnabled();
    }
  );

  test(
    "Run match mở run rồi sang bước 4, bấm đúp chỉ mở một run và một lượt chấm",
    { tag: ["@TC-CVJDMATCHINGWIZARD-049"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      const runs = network.recordRequests(MATCH_RUNS_URL, { method: "POST" });
      const scorings = network.recordRequests(MATCH_URL, { method: "POST" });
      await wizardPage.goto();
      const { jdId, cvId } = await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));

      await wizardPage.runMatchButton().dblclick();

      await expect(wizardPage.stepperDot(4)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();
      expect(runs).toHaveLength(1);
      expect(runs[0].body).toMatchObject({ cvDocumentId: cvId, jdDocumentId: jdId });
      expect(scorings).toHaveLength(1);
      expect(scorings[0].body).toMatchObject({ cvDocumentId: cvId, jdDocumentId: jdId, runId: expect.any(String) });
      expect((scorings[0].body as Record<string, unknown>).credentialId).toBeUndefined();
    }
  );

  test(
    "mở run lỗi thì báo lỗi inline và vẫn ở bước 3",
    { tag: ["@TC-CVJDMATCHINGWIZARD-050"] },
    async ({ wizardPage, network }) => {
      const scorings = network.recordRequests(MATCH_URL, { method: "POST" });
      await wizardPage.goto();
      const { cvId } = await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      // The CV is gone by the time the run is opened → POST /match/runs answers 400 documentNotOwned.
      await deleteDocuments([cvId]);

      await wizardPage.runMatchButton().click();

      await expect(wizardPage.inlineAlert()).toHaveText(serverMessage("matching.errors.documentNotOwned"));
      await expect(wizardPage.stepHeading("review")).toBeVisible();
      await expect(wizardPage.stepperDot(3)).toHaveAttribute("aria-current", "step");
      expect(scorings).toHaveLength(0);
    }
  );
});
