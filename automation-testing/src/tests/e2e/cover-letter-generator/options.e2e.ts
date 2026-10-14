import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";

// Tone / length / letter language, "Run with" and the privacy note (REQ-COVERLETTERGENERATOR-04…07).
// POST /cover-letters is stubbed (D1) by coverLetterAi, which also records what the page sent.

test.describe("cover letter — options and run with", () => {
  test(
    "the dialog opens with formal, standard and English selected in labelled groups",
    { tag: ["@TC-COVERLETTERGENERATOR-034"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      const match = await coverLetterSeed.match();
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await expect(modal.toneGroup()).toBeVisible();
      await expect(modal.lengthGroup()).toBeVisible();
      await expect(modal.languageGroup()).toBeVisible();
      await expect(modal.toneOption("formal")).toBeChecked();
      await expect(modal.toneOption("friendly")).not.toBeChecked();
      await expect(modal.lengthOption("standard")).toBeChecked();
      await expect(modal.lengthOption("short")).not.toBeChecked();
      await expect(modal.languageOption("en")).toBeChecked();
      await expect(modal.languageOption("vi")).not.toBeChecked();
    }
  );

  test(
    "the chosen options are sent, and switching the UI language leaves the letter language alone",
    { tag: ["@TC-COVERLETTERGENERATOR-035"] },
    async ({ coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const match = await coverLetterSeed.match();
      await coverLetterAi.stubGenerate();
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await modal.chooseOptions({ tone: "friendly", length: "short", language: "vi" });
      await coverLetterPage.setLanguage("vi");

      // Same choices, now labelled in Vietnamese.
      await expect(modal.toneOption("friendly")).toBeChecked();
      await expect(modal.lengthOption("short")).toBeChecked();
      await expect(modal.languageOption("vi")).toBeChecked();

      await modal.chooseLanguage("en");
      await coverLetterPage.setLanguage("en");
      await expect(modal.languageOption("en")).toBeChecked();

      await modal.generate();
      await expect(modal.draftField()).toBeVisible();
      expect(coverLetterAi.requests).toHaveLength(1);
      expect(coverLetterAi.requests[0]).toMatchObject({
        matchResultId: match.matchId,
        tone: "friendly",
        length: "short",
        language: "en",
      });
    }
  );

  test(
    "run with defaults to the match's credential, and the system key sends no credentialId",
    { tag: ["@TC-COVERLETTERGENERATOR-036"] },
    async ({ api, coverLetterPage, coverLetterSeed, coverLetterAi }) => {
      const label = `cl-run-${Date.now().toString(36)}`;
      const credentialId = await coverLetterSeed.credentialRow(label);
      const providerLabel = (await api.aiCredentials.providers()).json().find((p) => p.id === "openrouter")!.label;
      const match = await coverLetterSeed.match({ credentialId });
      await coverLetterAi.stubGenerate();
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      const credentialOption = modal.credentialOptionLabel(providerLabel, label, "1234");

      await expect(modal.runWithValue(credentialOption)).toBeVisible();
      await modal.generate();
      await expect(modal.draftRows()).toHaveCount(1);
      expect(coverLetterAi.requests[0].credentialId).toBe(credentialId);

      await modal.openRunWith();
      await expect(modal.runWithOption(credentialOption)).toBeVisible();
      await expect(modal.runWithOption(modal.systemKeyLabel())).toBeVisible();
      await modal.runWithOption(modal.systemKeyLabel()).click();
      await modal.generate();

      await expect(modal.draftRows()).toHaveCount(2);
      expect(coverLetterAi.requests).toHaveLength(2);
      expect(coverLetterAi.requests[1]).not.toHaveProperty("credentialId");
    }
  );

  test(
    "the privacy note names the provider of the chosen credential",
    { tag: ["@TC-COVERLETTERGENERATOR-037"] },
    async ({ api, coverLetterPage, coverLetterSeed }) => {
      const label = `cl-privacy-${Date.now().toString(36)}`;
      const credentialId = await coverLetterSeed.credentialRow(label);
      const providerLabel = (await api.aiCredentials.providers()).json().find((p) => p.id === "openrouter")!.label;
      const match = await coverLetterSeed.match({ credentialId });
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();

      await expect(
        modal.privacyNote(t("credentials.runWith.privacyList", "en", { providers: providerLabel }))
      ).toBeVisible();
    }
  );

  test(
    "the privacy note on the system key names OpenRouter",
    { tag: ["@TC-COVERLETTERGENERATOR-038"] },
    async ({ coverLetterPage, coverLetterSeed }) => {
      // BUG: defects/cover-letter-generator.md#bug-coverlettergenerator-01
      test.fail();
      const match = await coverLetterSeed.match();
      await coverLetterPage.openRun(match.runId);
      const modal = await coverLetterPage.openLetterModal();
      await modal.chooseRunWith(modal.systemKeyLabel());

      await expect(modal.privacyNote(t("credentials.runWith.privacySystem"))).toBeVisible({ timeout: 5_000 });
    }
  );
});
