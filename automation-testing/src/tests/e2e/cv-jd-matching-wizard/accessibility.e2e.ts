import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";
import { CV_TEXT, JD_TEXT, MATCH_URL, matchResultStub, uniqueText } from "@/data/test-data/cv-jd-matching-wizard";

// Roles, names and keyboard operation of the wizard (REQ-51). Selectors elsewhere are role/label based too; this file
// asserts the structure explicitly and drives the flows with the keyboard only.

test.describe("accessibility", () => {
  test(
    "Next, Back, Run match là button có tên và bước hiện tại có aria-current",
    { tag: ["@TC-CVJDMATCHINGWIZARD-080"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await expect(wizardPage.nextButton()).toHaveRole("button");
      await expect(wizardPage.backButton()).toHaveRole("button");
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("aria-current", "step");
      await expect(wizardPage.stepperDot(2)).not.toHaveAttribute("aria-current", "step");

      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await expect(wizardPage.runMatchButton()).toHaveRole("button");
      await expect(wizardPage.stepperDot(3)).toHaveAttribute("aria-current", "step");
    }
  );

  test(
    "danh sách đã lưu là radiogroup chọn được bằng bàn phím",
    { tag: ["@TC-CVJDMATCHINGWIZARD-081"] },
    async ({ wizardPage, wizardApi }) => {
      const first = uniqueText("Keyboard JD A");
      const second = uniqueText("Keyboard JD B");
      for (const title of [first, second]) {
        expect((await wizardApi.documents.create({ kind: "JD", save: true, title, sourceText: JD_TEXT })).status).toBe(201);
      }
      await wizardPage.goto();
      await expect(wizardPage.savedList()).toBeVisible();
      await expect(wizardPage.savedRadio(first)).toBeVisible();
      await expect(wizardPage.savedRadio(second)).toBeVisible();

      // Newest first: "second" is the first radio.
      await wizardPage.savedRadio(second).focus();
      await wizardPage.page.keyboard.press("Space");
      await expect(wizardPage.savedRadio(second)).toBeChecked();
      await wizardPage.page.keyboard.press("ArrowDown");
      await expect(wizardPage.savedRadio(first)).toBeChecked();

      await wizardPage.nextButton().focus();
      await wizardPage.page.keyboard.press("Enter");
      await expect(wizardPage.stepHeading("cv")).toBeVisible();
    }
  );

  test(
    "modal lưu có ô tên được gán nhãn và lưu được bằng Enter",
    { tag: ["@TC-CVJDMATCHINGWIZARD-082"] },
    async ({ wizardPage }) => {
      const name = uniqueText("Keyboard saved JD");
      await wizardPage.goto();
      await wizardPage.pasteText(uniqueText(JD_TEXT));

      await wizardPage.saveButton().focus();
      await wizardPage.page.keyboard.press("Enter");
      const dialog = wizardPage.saveDialog;
      // Focus moves into the modal (REQ-51 keyboard operability); the labelled name field is reachable by Tab.
      await expect.poll(() => dialog.containsFocus()).toBe(true);
      await dialog.tabToNameInput();
      await expect(dialog.nameInput()).toBeFocused();

      await wizardPage.page.keyboard.press("Enter");
      await expect(dialog.alert()).toHaveText(t("save.nameRequired"));

      await wizardPage.page.keyboard.type(name);
      await wizardPage.page.keyboard.press("Enter");
      await expect(dialog.root()).toBeHidden();
      await expect(wizardPage.savedConfirmation(name)).toBeVisible();
    }
  );

  test(
    "đi hết wizard bằng bàn phím: Next, Run match, Start over",
    { tag: ["@TC-CVJDMATCHINGWIZARD-083"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      const press = async (target: ReturnType<typeof wizardPage.nextButton>) => {
        await target.focus();
        await wizardPage.page.keyboard.press("Enter");
      };
      await wizardPage.goto();

      await wizardPage.pasteText(uniqueText(JD_TEXT));
      await press(wizardPage.nextButton());
      await expect(wizardPage.stepHeading("cv")).toBeVisible();

      await wizardPage.pasteText(uniqueText(CV_TEXT));
      await press(wizardPage.nextButton());
      await expect(wizardPage.stepHeading("review")).toBeVisible();

      await press(wizardPage.runMatchButton());
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();

      await press(wizardPage.startOverButton());
      await expect(wizardPage.stepHeading("jd")).toBeVisible();
    }
  );
});
