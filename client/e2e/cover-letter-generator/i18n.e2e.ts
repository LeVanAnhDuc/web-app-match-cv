import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import { setLanguage } from "../multi-provider-compare/helpers";
import {
  letterDialog,
  openLetterModal,
  resetLetters,
  segmentedOption,
  selectedSegment,
  stubCoverLetters
} from "./helpers";

// Matrix row 9 — every visible string in both locales, plus the distinction
// that trips people up: the UI language is not the letter language.

test.describe("cover letter — i18n", () => {
  test.beforeEach(async () => {
    await resetLetters();
    await cleanDocuments();
  });

  test.afterAll(async () => {
    await resetLetters();
  });

  test("[en] the modal reads in English", async ({ page }) => {
    await stubCoverLetters(page, {
      seed: [{ omittedRequirements: ["Kubernetes"] }]
    });
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await expect(dialog.getByText("Tone")).toBeVisible();
    await expect(dialog.getByText("Length", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Letter language")).toBeVisible();
    await expect(segmentedOption(dialog, "Formal")).toBeVisible();
    await expect(segmentedOption(dialog, "Short")).toBeVisible();
    await expect(segmentedOption(dialog, "English")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Generate/ })
    ).toBeVisible();
    await expect(dialog.getByText("This letter does not claim")).toBeVisible({
      timeout: 15000
    });
    await expect(dialog.getByRole("button", { name: "Copy" })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Download .txt" })
    ).toBeVisible();
  });

  test("[vi] the modal reads in Vietnamese", async ({ page }) => {
    await stubCoverLetters(page, {
      seed: [{ omittedRequirements: ["Kubernetes"] }]
    });
    await openLetterModal(page);
    await setLanguage(page, "vi");
    const dialog = letterDialog(page);

    await expect(dialog.getByText("Giọng văn")).toBeVisible();
    await expect(dialog.getByText("Độ dài", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Ngôn ngữ lá thư")).toBeVisible();
    await expect(segmentedOption(dialog, "Trang trọng")).toBeVisible();
    await expect(segmentedOption(dialog, "Ngắn")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Sinh thư/ })
    ).toBeVisible();
    await expect(dialog.getByText("Lá thư này KHÔNG khẳng định")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Sao chép" })
    ).toBeVisible();
  });

  test("[vi] a failed draft's error code is translated, not raw", async ({
    page
  }) => {
    await stubCoverLetters(page, {
      seed: [{ status: "failed", errorCode: "invalid_key", content: "" }]
    });
    await openLetterModal(page);
    await setLanguage(page, "vi");
    const dialog = letterDialog(page);

    await expect(
      dialog.getByText("Nhà cung cấp từ chối API key này.")
    ).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText("invalid_key")).toHaveCount(0);
  });

  // The knob that says which language the LETTER is written in must not follow
  // the interface language — they are different decisions.
  test("[vi] switching the UI language leaves the letter language alone", async ({
    page
  }) => {
    await stubCoverLetters(page);
    await openLetterModal(page);
    const dialog = letterDialog(page);

    await segmentedOption(dialog, "English").click();
    await setLanguage(page, "vi");

    // The chosen letter language is still English (now labelled "Tiếng Anh").
    await expect(selectedSegment(dialog, "Ngôn ngữ lá thư")).toHaveText(
      "Tiếng Anh"
    );
  });
});
