import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  draftRow,
  letterDialog,
  openLetterModal,
  resetLetters,
  stubCoverLetters
} from "./helpers";

// Matrix rows 5 (empty / null) and 8 (data rendering).

test.describe("cover letter — data and empty states", () => {
  test.beforeEach(async () => {
    await resetLetters();
    await cleanDocuments();
  });

  test.afterAll(async () => {
    await resetLetters();
  });

  test("[5] no drafts yet shows a meaningful empty state", async ({ page }) => {
    await stubCoverLetters(page);
    await openLetterModal(page);

    await expect(
      letterDialog(page).getByText(
        "No drafts yet. Pick a tone and length, then generate one."
      )
    ).toBeVisible();
  });

  test("[5] an empty omissions list hides the block instead of showing a blank box", async ({
    page
  }) => {
    await stubCoverLetters(page, { seed: [{ omittedRequirements: [] }] });
    await openLetterModal(page);

    await expect(
      letterDialog(page).getByLabel("Draft", { exact: true })
    ).toBeVisible({
      timeout: 15000
    });
    await expect(
      letterDialog(page).getByText("This letter does not claim")
    ).toHaveCount(0);
  });

  test("[5] a failed draft is an error state, not a blank letter", async ({
    page
  }) => {
    await stubCoverLetters(page, {
      seed: [{ status: "failed", errorCode: "no_quota", content: "" }]
    });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await expect(
      dialog.getByText("This key has no quota left with the provider.")
    ).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByLabel("Draft", { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Try again" })
    ).toBeVisible();
  });

  // ADR #13 made visible: the letter says what it did NOT claim.
  test("[8] the omissions the model declared are listed for the user", async ({
    page
  }) => {
    await stubCoverLetters(page, {
      seed: [{ omittedRequirements: ["Kubernetes", "Team leadership"] }]
    });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await expect(dialog.getByText("This letter does not claim")).toBeVisible({
      timeout: 15000
    });
    await expect(dialog.getByText("Kubernetes")).toBeVisible();
    await expect(dialog.getByText("Team leadership")).toBeVisible();
  });

  test("[8] enums render as human labels, never as raw values", async ({
    page
  }) => {
    await stubCoverLetters(page, {
      seed: [{ tone: "friendly", length: "short", language: "vi" }]
    });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await expect(draftRow(dialog, "Friendly · Short · Vietnamese")).toBeVisible(
      {
        timeout: 15000
      }
    );
    // exact: the default text matcher is a case-insensitive SUBSTRING, and
    // "friendly · short · vi" is one of "Friendly · Short · Vietnamese".
    await expect(
      dialog.getByText("friendly · short · vi", { exact: true })
    ).toHaveCount(0);
  });

  test("[8] the letter is plain text — markup is shown, not interpreted", async ({
    page
  }) => {
    await stubCoverLetters(page, {
      seed: [{ content: "**not bold** and <b>not html</b>" }]
    });
    await openLetterModal(page);

    await expect(
      letterDialog(page).getByLabel("Draft", { exact: true })
    ).toHaveValue("**not bold** and <b>not html</b>", { timeout: 15000 });
    // If it were rendered as HTML there would be a <b> element in the dialog.
    await expect(letterDialog(page).locator("b")).toHaveCount(0);
  });

  test("[8] no API key material reaches the DOM", async ({ page }) => {
    await stubCoverLetters(page, { seed: [{}] });
    await openLetterModal(page);
    await expect(
      letterDialog(page).getByLabel("Draft", { exact: true })
    ).toBeVisible({
      timeout: 15000
    });

    const html = await page.content();
    expect(html).not.toContain("sk-or-v1");
    expect(html).not.toContain("sk-e2e");
  });
});
