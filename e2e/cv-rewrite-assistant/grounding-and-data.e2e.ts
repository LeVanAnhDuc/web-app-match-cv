import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  API_BULLET,
  STUB_PROPOSAL,
  generateButton,
  gotoRewrite,
  saveButton,
  setLanguage,
  stubAccept,
  stubGenerate,
  stubPageContext
} from "./helpers";

// Matrix rows 4 (grounding + validation), 5 (empty/null), 6 (boundaries),
// 8 (data rendering) and 9 (i18n).

test.describe("cv rewrite — grounding, data and i18n", () => {
  test.beforeEach(async () => {
    await cleanDocuments();
  });

  test("[EP] a fabricated anchor never reaches the approval list", async ({
    page
  }) => {
    // The server drops unanchored changes, so what arrives here is already
    // filtered. This asserts the client renders exactly what it was given and
    // invents nothing of its own — the last link in the ADR #13 chain.
    await stubPageContext(page);
    await stubGenerate(page, {
      changes: [STUB_PROPOSAL.changes[0]],
      unaddressedGaps: ["Certified Kubernetes Administrator"]
    });

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(page.getByRole("checkbox")).toHaveCount(2); // select-all + one
    await expect(page.getByText(API_BULLET)).toBeVisible();
    // The gap it refused to close is reported, not silently closed.
    await expect(
      page.getByText("These gaps need real experience")
    ).toBeVisible();
    await expect(
      page.getByText("Certified Kubernetes Administrator")
    ).toBeVisible();
  });

  test("[DT] saving is blocked with nothing ticked, and no request is sent", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});
    const accepted = await stubAccept(page);

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(saveButton(page)).toBeDisabled();
    await page.waitForTimeout(300);
    expect(accepted()).toHaveLength(0);
  });

  test("[BVA] a title over 200 characters is rejected client-side", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});
    const accepted = await stubAccept(page);

    await gotoRewrite(page);
    await generateButton(page).click();
    await page.getByRole("checkbox", { name: "Experience" }).first().check();
    await saveButton(page).click();

    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("textbox");
    // maxLength caps typing at the boundary, so 201 characters cannot even be
    // entered — the request is impossible to make, not merely rejected.
    await input.fill("t".repeat(250));
    await expect(input).toHaveValue("t".repeat(200));

    await input.fill("");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Please enter a name")).toBeVisible();
    expect(accepted()).toHaveLength(0);
  });

  test("[EP] an empty proposal says so instead of showing a blank list", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, { changes: [], unaddressedGaps: [] });

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(page.getByText("No changes to suggest")).toBeVisible();
    await expect(saveButton(page)).toHaveCount(0);
    // No unaddressed gaps → the warning block is absent, not empty.
    await expect(page.getByText("These gaps need real experience")).toHaveCount(
      0
    );
  });

  test("[EP] a match with no gaps still opens, and says why", async ({
    page
  }) => {
    await stubPageContext(page, {
      match: {
        report: { strengths: ["Node.js"], gaps: [], suggestions: [] }
      }
    });
    await stubGenerate(page, {});

    await gotoRewrite(page);

    await expect(page.getByText("This match found no gaps.")).toBeVisible();
    await expect(generateButton(page)).toBeEnabled();
  });

  test("[EP] CV text is rendered as text, never as markup", async ({
    page
  }) => {
    const hostile = "Wrote <script>alert(1)</script> tooling for the team.";
    await stubPageContext(page, {
      cv: { rawText: `EXPERIENCE\n- ${hostile}` }
    });
    await stubGenerate(page, {
      changes: [
        {
          id: "0",
          sectionHint: "Experience",
          original: hostile,
          replacement: "Wrote <b>tooling</b> for the team.",
          rationale: "Tightens the wording.",
          addressesGap: null
        }
      ],
      unaddressedGaps: []
    });

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(page.getByText(hostile)).toBeVisible();
    await expect(
      page.getByText("Wrote <b>tooling</b> for the team.")
    ).toBeVisible();
    // Nothing was parsed as HTML. Scoped to <main>: the dev server injects its
    // own module scripts into <body>, which say nothing about this page.
    expect(await page.locator("main script").count()).toBe(0);
    expect(await page.locator("main b").count()).toBe(0);
  });

  test("[EP] a removal is labelled as one, with no suggested-text block", async ({
    page
  }) => {
    await stubPageContext(page);
    await stubGenerate(page, {
      changes: [{ ...STUB_PROPOSAL.changes[0], replacement: "" }],
      unaddressedGaps: []
    });

    await gotoRewrite(page);
    await generateButton(page).click();

    await expect(page.getByText("Removes this line")).toBeVisible();
    await expect(page.getByText("Suggested wording")).toHaveCount(0);
  });

  test("[i18n] the whole flow renders in Vietnamese too", async ({ page }) => {
    await stubPageContext(page);
    await stubGenerate(page, {});

    await gotoRewrite(page);
    await setLanguage(page, "vi");

    await expect(
      page.getByRole("heading", { name: "Cải thiện CV này" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sinh gợi ý" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Sinh gợi ý" }).click();

    await expect(page.getByText("Thay đổi đề xuất")).toBeVisible();
    await expect(page.getByText("Chọn tất cả")).toBeVisible();
    await expect(page.getByText("Hiện có trong CV").first()).toBeVisible();
    await expect(page.getByText("Đề xuất viết lại").first()).toBeVisible();
    await expect(
      page.getByText("Những điểm thiếu này cần kinh nghiệm thật")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lưu thành CV mới" })
    ).toBeVisible();

    await setLanguage(page, "en");
  });
});
