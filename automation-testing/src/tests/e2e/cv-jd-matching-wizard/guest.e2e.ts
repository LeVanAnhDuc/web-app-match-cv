import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";
import { CV_TEXT, JD_TEXT, MATCH_URL, matchResultStub, uniqueText } from "@/data/test-data/cv-jd-matching-wizard";

// The wizard for a visitor with no session (fixture guestWizardPage clears the cookies of the signed-in projects).
// The first POST /documents mints the guest; POST /match is stubbed, so no guest quota is spent (REQ-23, 26, 43).

test.describe("guest", () => {
  test(
    "khách dùng được bước 1–2, thấy ghi chú khách, không thấy lưu và danh sách đã lưu",
    { tag: ["@TC-CVJDMATCHINGWIZARD-041", "@smoke"] },
    async ({ guestWizardPage: wizardPage }) => {
      await wizardPage.goto();
      await expect(wizardPage.guestNote()).toBeVisible();
      await expect(wizardPage.guestSignInLink()).toHaveAttribute("href", /\/auth\/login\?returnTo=%2Fwizard$/);
      await expect(wizardPage.reuseTitle("jd")).toHaveCount(0);
      await expect(wizardPage.savedList()).toHaveCount(0);
      await expect(wizardPage.emptyState("jd")).toHaveCount(0);

      await wizardPage.pasteText(uniqueText(JD_TEXT));
      await expect(wizardPage.saveButton()).toHaveCount(0);
      await wizardPage.nextCreatingDocument();

      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      await expect(wizardPage.guestNote()).toBeVisible();
      await wizardPage.submitCv(uniqueText(CV_TEXT));
      await expect(wizardPage.stepHeading("review")).toBeVisible();
    }
  );

  test(
    "khách thấy bên nhận nội dung CV/JD trước khi chạy",
    { tag: ["@TC-CVJDMATCHINGWIZARD-042"] },
    async ({ guestWizardPage: wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));

      await expect(wizardPage.runMatchButton()).toBeVisible();
      await expect(wizardPage.systemPrivacyNotice()).toBeVisible();
    }
  );

  test(
    "khách không thấy các hành động trên thẻ kết quả",
    { tag: ["@TC-CVJDMATCHINGWIZARD-043"] },
    async ({ guestWizardPage: wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();

      await expect(wizardPage.scoreMeter("overall")).toBeVisible();
      await expect(wizardPage.improveCvButton()).toHaveCount(0);
      await expect(wizardPage.coverLetterButton()).toHaveCount(0);
      await expect(wizardPage.compareVersionsButton()).toHaveCount(0);
    }
  );
});
