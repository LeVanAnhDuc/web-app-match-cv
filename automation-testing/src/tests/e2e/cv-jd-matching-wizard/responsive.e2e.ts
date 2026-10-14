import { expect, test } from "@/fixtures";
import { CV_TEXT, JD_TEXT, MATCH_URL, matchResultStub, uniqueText } from "@/data/test-data/cv-jd-matching-wizard";

// Per-viewport invariants of the wizard (REQ-52). Runs in app (1280×720), app-tablet (820×1180) and app-mobile
// (390×844); every assertion holds for all three, except the 44 px touch target which only applies below 768 px.
// The shell's own sidebar/drawer layout belongs to module ui-consistency-shell.

const MD_BREAKPOINT = 768;
const MIN_TOUCH_TARGET = 44;

test.describe("responsive layout", () => {
  test(
    "bước 1 không scroll ngang và Next nằm trong viewport",
    { tag: ["@TC-CVJDMATCHINGWIZARD-084"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      expect(await wizardPage.hasHorizontalScroll()).toBe(false);
      await expect(wizardPage.nextButton()).toBeInViewport();
    }
  );

  test(
    "stepper chỉ render một lần, nhãn bước vẫn trong accessibility tree",
    { tag: ["@TC-CVJDMATCHINGWIZARD-085"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      for (const step of [1, 2, 3, 4] as const) {
        await expect(wizardPage.stepperDot(step)).toHaveCount(1);
        await expect(wizardPage.stepLabel(step)).toHaveCount(1);
      }
    }
  );

  test(
    "sang bước mới thì header bước nằm trong viewport",
    { tag: ["@TC-CVJDMATCHINGWIZARD-086"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.pasteText(uniqueText(JD_TEXT));
      await wizardPage.scrollToBottom();

      await wizardPage.nextButton().click();

      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      await expect(wizardPage.stepHeading("cv")).toBeInViewport();
      await expect(wizardPage.nextButton()).toBeInViewport();
    }
  );

  test(
    "bước 3 không scroll ngang và Run match nằm trong viewport",
    { tag: ["@TC-CVJDMATCHINGWIZARD-087"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));

      expect(await wizardPage.hasHorizontalScroll()).toBe(false);
      await expect(wizardPage.runMatchButton()).toBeInViewport();
    }
  );

  test(
    "bước 4 vừa chiều ngang và Start over cuộn tới được",
    { tag: ["@TC-CVJDMATCHINGWIZARD-088"] },
    async ({ wizardPage, network }) => {
      await network.stubJson(MATCH_URL, matchResultStub(), { method: "POST", status: 201 });
      await wizardPage.goto();
      await wizardPage.advanceToReview(uniqueText(JD_TEXT), uniqueText(CV_TEXT));
      await wizardPage.runMatch();
      await expect(wizardPage.scoreMeter("overall")).toBeVisible();

      expect(await wizardPage.hasHorizontalScroll()).toBe(false);
      await wizardPage.startOverButton().scrollIntoViewIfNeeded();
      await expect(wizardPage.startOverButton()).toBeInViewport();
    }
  );

  test(
    "nút footer cao ít nhất 44 px dưới 768 px",
    { tag: ["@TC-CVJDMATCHINGWIZARD-089"] },
    async ({ wizardPage }) => {
      const width = wizardPage.page.viewportSize()?.width ?? 0;
      test.skip(width >= MD_BREAKPOINT, "touch-target rule applies below 768 px only (app-mobile)");
      await wizardPage.goto();
      await wizardPage.pasteText(uniqueText(JD_TEXT));

      for (const button of [wizardPage.backButton(), wizardPage.nextButton()]) {
        const box = await button.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    }
  );
});
