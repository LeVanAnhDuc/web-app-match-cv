import type { Locator, Page } from "@playwright/test";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { BasePage } from "../base.page";

// The two ways into the rewrite assistant, seen from module cv-rewrite-assistant only (the wizard and Home pages
// belong to their own modules; this keeps just the locators this module asserts on).
//   WizardResultPage      /wizard?runId=<id> reopens a stored run on step 4 (views/Wizard/ghosts/OpenRunFromUrl):
//                         one MatchResultCard per result, "Improve my CV" in the header of a succeeded card (users only)
//   HomeRecentMatchesPage /  "Recent matches" table; a row (role=button, "<CV> × <JD>") reopens that one match on step 4

export class WizardResultPage extends BasePage {
  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  /** Open a stored run on step 4 and wait until its cards replaced the reopening skeleton. */
  async gotoRun(runId: string): Promise<void> {
    await this.page.goto(`/wizard?runId=${runId}`);
    await this.waitForAppReady();
    await this.page.waitForURL((url) => !url.searchParams.has("runId"));
  }

  improveButtons(): Locator {
    return this.page.getByRole("button", { name: this.text("action.improveCv"), exact: true });
  }

  /** Error text of a failed result card (result.error.<code>). */
  failedCardAlert(code = "unreachable"): Locator {
    return this.page.getByRole("alert").filter({ hasText: this.text(`result.error.${code}` as CopyKey) });
  }

  /** The overall score readout of a reopened card ("61" + "%"). */
  overallLabel(): Locator {
    return this.page.getByText(this.text("result.overall"), { exact: true });
  }

  async improve(): Promise<void> {
    await this.improveButtons().first().click();
    await this.page.waitForURL(/\/cv-rewrite\/[^/]+$/);
  }
}

export class HomeRecentMatchesPage extends BasePage {
  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.waitForAppReady();
  }

  /** A "Recent matches" row; its accessible name is "<CV title> × <JD title>". */
  row(cvTitle: string, jdTitle: string): Locator {
    return this.page.getByRole("button", { name: `${cvTitle} × ${jdTitle}`, exact: true });
  }

  async openMatch(cvTitle: string, jdTitle: string): Promise<void> {
    await this.row(cvTitle, jdTitle).click();
    await this.page.waitForURL((url) => url.pathname === "/wizard");
  }
}

/** /cv — the saved-CV library, only as far as "the new CV is listed" goes. */
export class SavedCvsPage extends BasePage {
  item(title: string): Locator {
    return this.page.getByRole("main").getByText(title, { exact: true }).first();
  }
}
