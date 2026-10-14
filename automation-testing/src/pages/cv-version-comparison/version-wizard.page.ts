import type { Locator } from "@playwright/test";
import { t } from "@/data/copy";
import { BasePage } from "../base.page";

// The two wizard screens this module touches: step 4 reopened from a stored run (`/wizard?runId=`, which reads the
// stored results and never fires a match) and step 3 "Review", where "Match this version" drops the user. The wizard
// itself belongs to module cv-jd-matching-wizard.
export class VersionWizardPage extends BasePage {
  /** Reopens a stored run at step 4 and waits for its result card's actions. */
  async gotoRun(runId: string): Promise<void> {
    await this.page.goto(`/wizard?runId=${runId}`);
    await this.waitForAppReady();
    await this.coverLetterButton().or(this.signedOutResultMarker()).first().waitFor();
  }

  improveButton(): Locator {
    return this.page.getByRole("button", { name: t("action.improveCv", this.lng) });
  }

  coverLetterButton(): Locator {
    return this.page.getByRole("button", { name: t("coverLetter.open", this.lng) });
  }

  compareButton(): Locator {
    return this.page.getByRole("button", { name: t("action.compareVersions", this.lng) });
  }

  /** The result card's action group, buttons in display order. */
  resultActions(): Locator {
    return this.improveButton().locator("xpath=..").getByRole("button");
  }

  /** The Overall readout label of a result card (present for a guest too, who has no actions). */
  signedOutResultMarker(): Locator {
    return this.page.getByText(t("result.overall", this.lng), { exact: true });
  }

  // ── step 3 ───────────────────────────────────────────────────────────────
  reviewTitle(): Locator {
    return this.page.getByText(t("wizard.stepReview.title", this.lng), { exact: true });
  }

  runMatchButton(): Locator {
    return this.page.getByRole("button", { name: t("action.runMatch", this.lng) });
  }

  /** Text shown in the Review previews (the documents' raw text). */
  previewText(text: string): Locator {
    return this.page.getByText(text);
  }
}
