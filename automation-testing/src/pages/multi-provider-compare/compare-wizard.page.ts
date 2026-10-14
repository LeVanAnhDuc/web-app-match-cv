import { expect, type Locator, type Page } from "@playwright/test";
import { MatchResultCardComponent } from "@/components/multi-provider-compare/match-result-card.component";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { BasePage } from "@/pages/base.page";

// The match wizard (/wizard, client/src/views/Wizard) as module multi-provider-compare drives it: steps 1–2 only to get
// a CV/JD pair in by pasting text, step 3 "Review documents" with the provider picker (RunWithSelector), step 4 with
// one card per provider (StepResult + MatchResultCard), and the /wizard?runId= reopen path (OpenRunFromUrl).

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STEP_LABEL_KEYS = { 1: "step.jd", 2: "step.cv", 3: "step.review", 4: "step.result" } as const;

export type WizardStepNumber = 1 | 2 | 3 | 4;

export interface CreatedPair {
  jdId: string;
  cvId: string;
}

export class CompareWizardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  // ── navigation ───────────────────────────────────────────────────────────
  /** Fresh wizard on step 1 (the in-memory wizard store resets on every full load). */
  async goto(): Promise<void> {
    await this.page.goto("/wizard");
    await this.waitForAppReady();
    await this.stepperStep(1).waitFor();
  }

  /** The "Sign in to keep it" return URL: reopen a stored run. Waits for hydration only — the read is what tests watch. */
  async gotoRun(runId: string): Promise<void> {
    await this.page.goto(`/wizard?runId=${encodeURIComponent(runId)}`);
    await this.waitForAppReady();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForAppReady();
  }

  /** The stepper dot of a step (data-status active|done|idle, aria-disabled when blocked). */
  stepperStep(step: WizardStepNumber): Locator {
    return this.page.getByTestId(`stepper-step-${step}`);
  }

  /** Stepper button that jumps back to a finished step. */
  jumpToStepButton(step: WizardStepNumber): Locator {
    const label = this.text(STEP_LABEL_KEYS[step]);
    return this.page.getByRole("button", { name: this.text("step.jumpTo", { label }) });
  }

  // ── steps 1–2: paste a document ──────────────────────────────────────────
  pasteTab(): Locator {
    return this.shell.main().getByText(this.text("input.tab.paste"), { exact: true });
  }

  pasteArea(): Locator {
    return this.page.getByPlaceholder(this.text("paste.placeholder"));
  }

  nextButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.next"), exact: true });
  }

  backButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.back"), exact: true });
  }

  /**
   * Switch to "Paste text" and type. The Segmented control ignores clicks that land before hydration finishes, so the
   * tab is re-clicked until the textarea is actually there.
   */
  async pasteDocument(text: string): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (!(await this.pasteArea().isVisible())) {
      if (Date.now() > deadline) throw new Error("the Paste text tab never opened its textarea");
      await this.pasteTab().click();
      await this.pasteArea()
        .waitFor({ timeout: 1_000 })
        .catch(() => undefined);
    }
    await this.pasteArea().fill(text);
  }

  /** Next on step 1/2: creates the document (POST /documents) and returns its id. */
  async submitDocument(): Promise<string> {
    const created = this.page.waitForResponse(
      (r) => r.request().method() === "POST" && /\/api\/v1\/documents$/.test(new URL(r.url()).pathname)
    );
    await this.nextButton().click();
    const body = (await (await created).json()) as { id: string };
    return body.id;
  }

  /** Steps 1–2 by pasting, landing on step 3 with both previews loaded. Returns the two document ids. */
  async advanceToReview(jdText: string, cvText: string): Promise<CreatedPair> {
    await this.pasteDocument(jdText);
    const jdId = await this.submitDocument();
    await this.pasteDocument(cvText);
    const cvId = await this.submitDocument();
    await this.reviewHeading().waitFor();
    return { jdId, cvId };
  }

  // ── step 3: provider picker ──────────────────────────────────────────────
  reviewHeading(): Locator {
    return this.page.getByRole("heading", { name: this.text("wizard.stepReview.title") });
  }

  /** The picker's visible eyebrow "Run with". */
  runWithTitle(): Locator {
    return this.shell.main().getByText(this.text("credentials.runWith.title"), { exact: true });
  }

  /** The picker exposed as an accessible group named "Run with" (REQ-01). */
  runWithGroup(): Locator {
    return this.page.getByRole("group", { name: this.text("credentials.runWith.title") });
  }

  allCheckboxes(): Locator {
    return this.shell.main().getByRole("checkbox");
  }

  checkedBoxes(): Locator {
    return this.shell.main().getByRole("checkbox", { checked: true });
  }

  /** The checkbox of a credential, by its (unique) label. */
  credentialCheckbox(label: string): Locator {
    return this.shell.main().getByRole("checkbox", { name: new RegExp(escapeRegExp(label)) });
  }

  systemKeyCheckbox(): Locator {
    return this.shell.main().getByRole("checkbox", { name: new RegExp(escapeRegExp(this.text("credentials.systemKey"))) });
  }

  /** Wait until the picker has rendered `count` options (credentials + the system key). */
  async waitForOptions(count: number): Promise<void> {
    await this.systemKeyCheckbox().waitFor();
    await this.allCheckboxes()
      .nth(count - 1)
      .waitFor();
  }

  /**
   * Make the selection exactly `labels` (credential labels; "system" = the system key): untick everything, then tick
   * the wanted rows in the order given.
   */
  async selectOnly(labels: Array<string>): Promise<void> {
    const checked = this.checkedBoxes();
    // The picker seeds its default ONCE, when the credential list arrives; wait for it so it cannot land after us.
    await checked.first().waitFor();
    const boxes = this.allCheckboxes();
    const total = await boxes.count();
    for (let i = 0; i < total; i += 1) await this.setChecked(boxes.nth(i), false);
    for (const label of labels) {
      await this.setChecked(label === "system" ? this.systemKeyCheckbox() : this.credentialCheckbox(label), true);
    }
  }

  /**
   * Toggle one controlled antd checkbox. Its checked state only flips once the wizard store has re-rendered the group,
   * which can land after Playwright's post-click check — so click once and wait for the state, not for `.check()`.
   */
  async setChecked(box: Locator, checked: boolean): Promise<void> {
    if ((await box.isChecked()) === checked) return;
    await box.click();
    await expect(box).toBeChecked({ checked });
  }

  /** The privacy line under the picker, whatever it currently says (list of providers, or "select at least one"). */
  privacyNotice(): Locator {
    const [prefix] = this.text("credentials.runWith.privacyList", { providers: "\u0000" }).split("\u0000");
    return this.shell
      .main()
      .getByText(new RegExp(`^(${escapeRegExp(prefix)}|${escapeRegExp(this.text("credentials.runWith.privacyNone"))})`));
  }

  /** The guest/system-key sentence "…sent to OpenRouter using the system key." */
  systemPrivacyNotice(): Locator {
    return this.shell.main().getByText(this.text("credentials.runWith.privacySystem"), { exact: true });
  }

  /** "Run match" or "Run match · N providers". */
  runMatchButton(): Locator {
    return this.page.getByRole("button", { name: new RegExp(`^${escapeRegExp(this.text("action.runMatch"))}`) });
  }

  /** The step's own error line (role="alert"): step 3 run errors, step 4 run read errors. */
  stepAlert(): Locator {
    return this.shell.main().getByRole("alert").first();
  }

  /** Click Run match and return the id of the run POST /match/runs opened. */
  async runMatch(): Promise<string> {
    const opened = this.page.waitForResponse(
      (r) => r.request().method() === "POST" && /\/api\/v1\/match\/runs$/.test(new URL(r.url()).pathname)
    );
    await this.runMatchButton().click();
    const response = await opened;
    const body = (await response.json()) as { id?: string };
    if (response.status() !== 201 || !body.id) throw new Error(`POST /match/runs answered ${response.status()}`);
    return body.id;
  }

  // ── step 4: one card per provider ────────────────────────────────────────
  /** The step-4 container (aria-live="polite") holding the cards. */
  resultsRegion(): Locator {
    return this.shell.main().locator('[aria-live="polite"]');
  }

  /** The provider cards: direct children of the results region, minus the guest "kept for 24 hours" callout. */
  cardRoots(): Locator {
    return this.resultsRegion()
      .locator(":scope > div")
      .filter({ hasNot: this.page.getByRole("heading", { name: this.text("result.keep.title") }) });
  }

  card(index: number): MatchResultCardComponent {
    return new MatchResultCardComponent(this.page, this.cardRoots().nth(index));
  }

  /** The card whose h2 title is exactly `title`. */
  cardTitled(title: string): MatchResultCardComponent {
    return new MatchResultCardComponent(
      this.page,
      this.cardRoots().filter({ has: this.page.getByRole("heading", { level: 2, name: title, exact: true }) })
    );
  }

  /** "Nothing finished yet" — a run with no stored results. */
  emptyRunTitle(): Locator {
    return this.resultsRegion().getByText(this.text("result.emptyRun"), { exact: true });
  }

  emptyRunHint(): Locator {
    return this.resultsRegion().getByText(this.text("result.emptyRunHint"), { exact: true });
  }

  startOverButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("action.startOver") }).first();
  }

  /** "Kept for 24 hours, then deleted" — the guest sign-in pitch under the cards. */
  keepCalloutTitle(): Locator {
    return this.shell.main().getByRole("heading", { name: this.text("result.keep.title") });
  }

  /** The skeleton the wizard shows while `/wizard?runId=` is being read. */
  busyPlaceholder(): Locator {
    return this.shell.main().locator('[aria-busy="true"]');
  }

  /** An antd message toast with this exact text. */
  toast(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
