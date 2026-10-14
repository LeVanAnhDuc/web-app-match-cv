import type { Locator, Page } from "@playwright/test";
import { uiLanguage } from "@/components/ui-language";
import { t, type CopyKey, type Vars } from "@/data/copy";

// One provider card on wizard step 4 (client/src/views/Wizard/components/MatchResultCard):
//   running   SectionCard titled "Running…" / "System key" with an antd Skeleton
//   failed    SectionCard with an Alert role="alert" (one sentence per errorCode) and "Try again"
//   quota     SignInGate (guest out of free matches)
//   succeeded SectionCard titled "<provider label> · <chatModel>", three Readout meters, the report (open, or collapsed
//             under "Show full report" when several cards share the step), and the signed-in actions in the header.
// `root` is the card's outermost element: a direct child of the step's aria-live region.
export class MatchResultCardComponent {
  constructor(
    readonly page: Page,
    readonly root: Locator
  ) {}

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, uiLanguage(this.page), vars);
  }

  /** The card's h2 title. */
  title(): Locator {
    return this.root.getByRole("heading", { level: 2 }).first();
  }

  /** The Readout meter of one score (aria-valuenow = the score). */
  meter(kind: "overall" | "semantic" | "keyword"): Locator {
    return this.root.getByRole("meter", { name: this.text(`result.${kind}`) });
  }

  /** Every score meter on the card (none on a failed card). */
  meters(): Locator {
    return this.root.getByRole("meter");
  }

  /** A score as printed, e.g. "80%". */
  scoreText(value: number): Locator {
    return this.root.getByText(`${value}%`, { exact: true });
  }

  errorAlert(): Locator {
    return this.root.getByRole("alert");
  }

  tryAgainButton(): Locator {
    return this.root.getByRole("button", { name: this.text("action.tryAgain") });
  }

  /** The Collapse header that hides the report when several cards are on screen. */
  showReportToggle(): Locator {
    return this.root.getByRole("button", { name: this.text("result.card.showReport") });
  }

  reportItem(text: string): Locator {
    return this.root.getByText(text, { exact: true });
  }

  strengthsHeading(): Locator {
    return this.root.getByRole("heading", { name: this.text("result.strengths") });
  }

  improveCvButton(): Locator {
    return this.root.getByRole("button", { name: this.text("action.improveCv") });
  }

  coverLetterButton(): Locator {
    return this.root.getByRole("button", { name: this.text("coverLetter.open") });
  }

  compareVersionsButton(): Locator {
    return this.root.getByRole("button", { name: this.text("action.compareVersions") });
  }

  /** The guest "out of free matches" gate that replaces the card on a 429 GUEST_QUOTA_EXCEEDED. */
  quotaGateTitle(limit: number): Locator {
    return this.root.getByText(this.text("gate.quotaTitle", { limit }), { exact: true });
  }

  async expandReport(): Promise<void> {
    await this.showReportToggle().click();
  }

  async tryAgain(): Promise<void> {
    await this.tryAgainButton().click();
  }
}
