import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";
import {
  CV_TEXT,
  JD_TEXT,
  MATCH_URL,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  PDF_MIME,
  blankFile,
  failedMatchStub,
  matchResultStub,
  uniqueText,
} from "@/data/test-data/cv-jd-matching-wizard";

// EN + VI copy of the wizard (REQ-49). There is no language switcher in the app (D4): VI is switched on through the
// dev hook window.__i18n (BasePage.setLanguage), after which every page-object label resolves in VI too.

test.describe("i18n", () => {
  test(
    "bước 1 hiển thị tiếng Việt và đổi lại tiếng Anh không kẹt",
    { tag: ["@TC-CVJDMATCHINGWIZARD-077"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await expect(wizardPage.stepHeading("jd")).toHaveText(t("wizard.stepJd.title", "en"));
      await expect(wizardPage.emptyState("jd")).toBeVisible();

      await wizardPage.setLanguage("vi");
      await expect(wizardPage.stepHeading("jd")).toHaveText(t("wizard.stepJd.title", "vi"));
      for (const step of [1, 2, 3, 4] as const) await expect(wizardPage.stepLabel(step)).toHaveCount(1);
      await expect(wizardPage.emptyState("jd")).toHaveText(t("reuse.empty.jd", "vi"));
      await expect(wizardPage.nextButton()).toBeVisible();
      await expect(wizardPage.modeTab("paste")).toBeVisible();
      await expect(wizardPage.dropzoneHint(MAX_UPLOAD_LABEL)).toBeVisible();
      // No raw key leaked anywhere on the step.
      await expect(wizardPage.shell.main()).not.toContainText(/\b(wizard|reuse|step|input|dropzone|action)\.[a-z]+/);

      await wizardPage.setLanguage("en");
      await expect(wizardPage.stepHeading("jd")).toHaveText(t("wizard.stepJd.title", "en"));
      await expect(wizardPage.emptyState("jd")).toBeVisible();
    }
  );

  test(
    "nhãn báo cáo và lỗi provider ở bước 4 hiển thị tiếng Việt",
    { tag: ["@TC-CVJDMATCHINGWIZARD-078"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await network.stubOnce(MATCH_URL, failedMatchStub("timeout"), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();
      await expect(wizardPage.resultError("timeout")).toBeVisible();

      await wizardPage.setLanguage("vi");
      await expect(wizardPage.resultError("timeout")).toContainText(t("result.error.timeout", "vi"));
      await wizardPage.tryAgainButton().click();

      for (const kind of ["overall", "semantic", "keyword"] as const) {
        await expect(wizardPage.scoreLabel(kind)).toBeVisible();
      }
      for (const list of ["strengths", "gaps", "suggestions"] as const) {
        await expect(wizardPage.reportHeading(list)).toBeVisible();
      }
      await expect(wizardPage.startOverButton()).toHaveText(t("action.startOver", "vi"));
      await expect(wizardPage.shell.main()).not.toContainText(/\bresult\.[a-z]+/);
    }
  );

  test(
    "lỗi file ở client hiển thị tiếng Việt",
    { tag: ["@TC-CVJDMATCHINGWIZARD-079"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.setLanguage("vi");

      await wizardPage.chooseFile(blankFile("virus.exe", "application/octet-stream", 64));
      await expect(wizardPage.inlineAlert()).toHaveText(t("err.fileType", "vi"));

      await wizardPage.chooseFile(blankFile("huge.pdf", PDF_MIME, MAX_UPLOAD_BYTES + 1));
      await expect(wizardPage.inlineAlert()).toHaveText(t("err.fileSize", "vi", { max: MAX_UPLOAD_LABEL }));
    }
  );
});
