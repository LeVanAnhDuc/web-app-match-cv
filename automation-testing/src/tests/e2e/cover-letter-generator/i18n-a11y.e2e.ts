import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";
import { fakeApiKey, OMITTED } from "@/data/test-data/cover-letter-generator";

// Vietnamese UI, secrets in the DOM, keyboard use (REQ-COVERLETTERGENERATOR-27, -28, -29).
// vi is reached through the dev hook window.__i18n (the app has no language switcher — D4).

test.describe("cover letter — language, secrets, keyboard", () => {
  test(
    "the dialog reads in Vietnamese, failure codes included",
    { tag: ["@TC-COVERLETTERGENERATOR-061"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letters(match, [
        { status: "failed", errorCode: "invalid_key" },
        { omittedRequirements: OMITTED },
      ]);
      await coverLetterPage.openRun(match.runId);
      await coverLetterPage.setLanguage("vi");
      const modal = await coverLetterPage.openLetterModal();

      await expect(modal.root()).toBeVisible();
      await expect(modal.toneGroup()).toBeVisible();
      await expect(modal.lengthGroup()).toBeVisible();
      await expect(modal.languageGroup()).toBeVisible();
      await expect(modal.toneOption("formal")).toBeChecked();
      await expect(modal.languageOption("en")).toBeChecked();
      await expect(modal.runWithSelect()).toBeVisible();
      await expect(modal.generateButton()).toBeVisible();
      await expect(modal.draftField()).toBeVisible();
      await expect(modal.copyButton()).toBeVisible();
      await expect(modal.downloadButton()).toBeVisible();
      await expect(modal.saveButton()).toBeVisible();
      await expect(modal.omittedTitle()).toBeVisible();
      await expect(modal.omittedHint()).toBeVisible();
      await expect(modal.draftsHeading()).toBeVisible();
      await expect(modal.privacyNote(t("credentials.runWith.privacyList", "vi", { providers: t("credentials.systemKey", "vi") })).or(
        modal.privacyNote(t("credentials.runWith.privacySystem", "vi"))
      )).toBeVisible();

      const failedRow = modal.draftRows().nth(1);
      await expect(modal.failedTag(failedRow)).toBeVisible();
      await modal.openDraft(failedRow);
      await expect(modal.failureAlert("invalid_key")).toBeVisible();
      await expect(modal.tryAgainButton()).toBeVisible();
      await expect(modal.exactText("invalid_key")).toHaveCount(0);
    }
  );

  test(
    "no API key material reaches the page",
    { tag: ["@TC-COVERLETTERGENERATOR-062", "@smoke"] },
    async ({ page, api, coverLetterPage, coverLetterSeed }) => {
      const apiKey = fakeApiKey();
      const created = await api.aiCredentials.create({ provider: "openrouter", label: `cl-dom-${Date.now().toString(36)}`, apiKey });
      expect(created.status).toBe(201);
      const credentialId = created.json().id;
      try {
        const match = await coverLetterSeed.match({ credentialId });
        await coverLetterSeed.letter(match, { credentialId });
        await coverLetterPage.openRun(match.runId);
        const modal = await coverLetterPage.openLetterModal();
        await expect(modal.draftField()).toBeVisible();
        await modal.openRunWith();
        await expect(modal.runWithOption(modal.systemKeyLabel())).toBeVisible();

        const html = await page.content();
        expect(html).not.toContain(apiKey);
        expect(html).not.toContain(apiKey.slice(0, -4));
      } finally {
        await api.aiCredentials.remove(credentialId);
      }
    }
  );

  test(
    "focus moves into the dialog, Escape closes it and focus returns to the button",
    { tag: ["@TC-COVERLETTERGENERATOR-063"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letter(match);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toBeVisible();

      await expect.poll(() => modal.focusIsInside()).toBe(true);
      await modal.pressEscape();

      await expect(modal.root()).toBeHidden();
      await expect(coverLetterPage.writeLetterButton()).toBeFocused();
    }
  );

  test(
    "tab order follows the dialog's layout and delete buttons name their draft",
    { tag: ["@TC-COVERLETTERGENERATOR-064"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterSeed.letters(match, [{ tone: "friendly", length: "short", language: "vi" }, {}]);
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await expect(modal.draftField()).toBeVisible();

      for (const options of [
        { tone: "formal", length: "standard", language: "en" },
        { tone: "friendly", length: "short", language: "vi" },
      ] as const) {
        await expect(modal.deleteButtonFor(modal.describe(options))).toBeVisible();
      }

      const stops = await modal.tabSequence(modal.toneOption("formal"), 25);
      const at = (match: (stop: (typeof stops)[number]) => boolean) => stops.findIndex(match);
      const runWith = at((s) => s.role === "combobox");
      const generate = at((s) => s.name.includes(t("coverLetter.generate")));
      const draft = at((s) => s.id === "cover-letter-draft");
      const copy = at((s) => s.name === t("coverLetter.copy"));
      const firstDelete = at((s) => s.name.startsWith(`${t("coverLetter.delete")}: `));

      expect(runWith, JSON.stringify(stops)).toBeGreaterThan(0);
      expect(generate).toBeGreaterThan(runWith);
      expect(draft).toBeGreaterThan(generate);
      expect(copy).toBeGreaterThan(draft);
      expect(firstDelete).toBeGreaterThan(copy);
    }
  );
});
