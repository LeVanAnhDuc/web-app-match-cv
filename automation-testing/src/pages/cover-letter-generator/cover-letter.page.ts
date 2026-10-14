import { readFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import { uiLanguage } from "@/components/ui-language";
import { t, type CopyKey, type Lng, type Vars } from "@/data/copy";
import { BasePage } from "@/pages/base.page";

// Where the cover-letter generator lives: the header of a succeeded result card on wizard step 4
// (client/src/views/Wizard/components/MatchResultCard), which opens CoverLetterModal
// (client/src/views/Wizard/components/CoverLetterModal). A stored run is reopened with /wizard?runId=<id>
// (OpenRunFromUrl): that renders the same card as reopening a match from Home, with no AI call.

export type LetterTone = "formal" | "friendly";
export type LetterLength = "short" | "standard";
export type LetterLanguage = "en" | "vi";

export interface FocusStop {
  /** role attribute, else lower-case tag name. */
  role: string;
  /** aria-label, else trimmed text content (first 80 chars). */
  name: string;
  id: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wizard step 4 with a result card (the only entry point of the generator). */
export class CoverLetterPage extends BasePage {
  readonly modal: CoverLetterModal;

  constructor(page: Page) {
    super(page);
    this.modal = new CoverLetterModal(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  /** Reopen a stored run on the result step, the way "Sign in to keep it" and history links do. */
  async openRun(runId: string): Promise<void> {
    await this.page.goto(`/wizard?runId=${encodeURIComponent(runId)}`);
    await this.waitForAppReady();
  }

  /** "Write cover letter" on a result card header. */
  writeLetterButton(): Locator {
    return this.page.getByRole("button", { name: this.text("coverLetter.open") });
  }

  /** The score readout label of a rendered (succeeded) card. */
  overallScoreLabel(): Locator {
    return this.page.getByText(this.text("result.overall"), { exact: true });
  }

  /** The error alert of a failed result card. */
  failedCardAlert(errorCode: string): Locator {
    return this.page.getByRole("alert").filter({ hasText: this.text(`result.error.${errorCode}` as CopyKey) });
  }

  /**
   * A result card still waiting for its POST /match. MatchResultCard passes aria-busy to SectionCard, which does
   * not forward it to the DOM, so the card is recognised by its antd skeleton inside main.
   */
  pendingCard(): Locator {
    return this.page.getByRole("main").first().locator(".ant-skeleton").first();
  }

  /** Stepper button back to step 3 (Review); present once step 3 is done. */
  jumpToReviewButton(): Locator {
    return this.page.getByRole("button", {
      name: this.text("step.jumpTo", { label: this.text("step.review") }),
    });
  }

  /** "Run match" (or "Run match · N providers") on step 3. */
  runMatchButton(): Locator {
    return this.page.getByRole("button", { name: new RegExp(`^${escapeRegExp(this.text("action.runMatch"))}`) });
  }

  /** From a reopened result: back to Review and run the same pair again (POST /match/runs, then POST /match). */
  async rerunFromReview(): Promise<void> {
    await this.jumpToReviewButton().click();
    await this.runMatchButton().click();
  }

  /** Open the generator from the result card and wait for the dialog. */
  async openLetterModal(): Promise<CoverLetterModal> {
    await this.writeLetterButton().click();
    await this.modal.root().waitFor();
    return this.modal;
  }
}

/** CoverLetterModal: options, Run with, Generate, draft editor, saved drafts. Labels follow the tab's UI language. */
export class CoverLetterModal {
  constructor(readonly page: Page) {}

  get lng(): Lng {
    return uiLanguage(this.page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  root(): Locator {
    return this.page.getByRole("dialog", { name: this.text("coverLetter.title") });
  }

  title(): Locator {
    return this.root().getByText(this.text("coverLetter.title"), { exact: true });
  }

  /** Every open dialog on the page (a confirmation would be a second one). */
  allDialogs(): Locator {
    return this.page.getByRole("dialog");
  }

  /** Any element inside the dialog whose whole text is `text` (e.g. a raw enum or "null" leaking into the UI). */
  exactText(text: string): Locator {
    return this.root().getByText(text, { exact: true });
  }

  /** <b> elements inside the dialog: there must be none when the letter is plain text. */
  boldElements(): Locator {
    return this.root().locator("b, strong");
  }

  // ── options ──────────────────────────────────────────────────────────────
  toneGroup(): Locator {
    return this.root().getByRole("group", { name: this.text("coverLetter.tone"), exact: true });
  }

  lengthGroup(): Locator {
    return this.root().getByRole("group", { name: this.text("coverLetter.length"), exact: true });
  }

  languageGroup(): Locator {
    return this.root().getByRole("group", { name: this.text("coverLetter.language"), exact: true });
  }

  /** The (visually hidden) radio of an option: use for toBeChecked(). */
  toneOption(tone: LetterTone): Locator {
    return this.toneGroup().getByRole("radio", { name: this.text(`coverLetter.toneValue.${tone}`), exact: true });
  }

  lengthOption(length: LetterLength): Locator {
    return this.lengthGroup().getByRole("radio", {
      name: this.text(`coverLetter.lengthValue.${length}`),
      exact: true,
    });
  }

  languageOption(language: LetterLanguage): Locator {
    return this.languageGroup().getByRole("radio", {
      name: this.text(`coverLetter.languageValue.${language}`),
      exact: true,
    });
  }

  // The native radio is hidden by the segmented control; the user clicks its visible label.
  async chooseTone(tone: LetterTone): Promise<void> {
    await this.toneGroup().getByText(this.text(`coverLetter.toneValue.${tone}`), { exact: true }).click();
  }

  async chooseLength(length: LetterLength): Promise<void> {
    await this.lengthGroup().getByText(this.text(`coverLetter.lengthValue.${length}`), { exact: true }).click();
  }

  async chooseLanguage(language: LetterLanguage): Promise<void> {
    await this.languageGroup().getByText(this.text(`coverLetter.languageValue.${language}`), { exact: true }).click();
  }

  async chooseOptions(options: { tone?: LetterTone; length?: LetterLength; language?: LetterLanguage }): Promise<void> {
    if (options.tone) await this.chooseTone(options.tone);
    if (options.length) await this.chooseLength(options.length);
    if (options.language) await this.chooseLanguage(options.language);
  }

  // ── run with ─────────────────────────────────────────────────────────────
  runWithSelect(): Locator {
    return this.root().getByRole("combobox", { name: this.text("credentials.runWith.title") });
  }

  /** The value shown in the closed "Run with" select (antd renders it with a title attribute). */
  runWithValue(label: string): Locator {
    return this.root().getByTitle(label, { exact: true });
  }

  /** An option of the open "Run with" dropdown (rendered in a portal, outside the dialog). */
  runWithOption(label: string): Locator {
    return this.page.getByTitle(label, { exact: true }).filter({ visible: true }).last();
  }

  /**
   * antd paints the selected item over the combobox input, so a pointer click on the input never becomes
   * actionable once a value is shown; open the listbox the keyboard way (focus, ArrowDown) instead.
   */
  async openRunWith(): Promise<void> {
    await this.runWithSelect().focus();
    await this.page.keyboard.press("ArrowDown");
    await this.page.getByRole("listbox").waitFor({ state: "attached" });
  }

  async chooseRunWith(label: string): Promise<void> {
    await this.openRunWith();
    await this.runWithOption(label).click();
  }

  /** The label of the system key option. */
  systemKeyLabel(): string {
    return this.text("credentials.systemKey");
  }

  /** Label of a credential option: `<Provider> · <label> · ••••<last4>`. */
  credentialOptionLabel(providerLabel: string, label: string, last4: string): string {
    return `${providerLabel} · ${label} · ••••${last4}`;
  }

  privacyNote(text: string): Locator {
    return this.root().getByText(text, { exact: true });
  }

  // ── generate ─────────────────────────────────────────────────────────────
  generateButton(): Locator {
    return this.root().getByRole("button", { name: this.text("coverLetter.generate") });
  }

  async generate(): Promise<void> {
    await this.generateButton().click();
  }

  /** The aria-live region holding the skeleton / failure alert / editor. */
  draftRegion(): Locator {
    return this.root().locator('[aria-live="polite"]');
  }

  // ── draft editor ─────────────────────────────────────────────────────────
  draftField(): Locator {
    // exact: "Delete draft: …" also contains "draft".
    return this.root().getByLabel(this.text("coverLetter.draft"), { exact: true });
  }

  copyButton(): Locator {
    return this.root().getByRole("button", { name: this.text("coverLetter.copy"), exact: true });
  }

  downloadButton(): Locator {
    return this.root().getByRole("button", { name: this.text("coverLetter.download"), exact: true });
  }

  saveButton(): Locator {
    return this.root().getByRole("button", { name: this.text("coverLetter.save") });
  }

  async editDraft(text: string): Promise<void> {
    await this.draftField().fill(text);
  }

  async saveDraft(): Promise<void> {
    await this.saveButton().click();
  }

  tryAgainButton(): Locator {
    return this.root().getByRole("button", { name: this.text("action.tryAgain") });
  }

  /** Every alert inside the dialog. */
  alerts(): Locator {
    return this.root().getByRole("alert");
  }

  /** An alert inside the dialog carrying `text`. */
  alert(text: string): Locator {
    return this.root().getByRole("alert").filter({ hasText: text });
  }

  errorAlert(key: "generate" | "save" | "delete" | "copy" | "list"): Locator {
    return this.alert(this.text(`coverLetter.err.${key}`));
  }

  failureAlert(errorCode: string): Locator {
    return this.alert(this.text(`result.error.${errorCode}` as CopyKey));
  }

  // ── grounding block ──────────────────────────────────────────────────────
  omittedTitle(): Locator {
    return this.root().getByText(this.text("coverLetter.omitted.title"), { exact: true });
  }

  omittedHint(): Locator {
    return this.root().getByText(this.text("coverLetter.omitted.hint"), { exact: true });
  }

  omittedItem(text: string): Locator {
    return this.root().getByRole("listitem").filter({ hasText: text });
  }

  // ── saved drafts ─────────────────────────────────────────────────────────
  draftsHeading(): Locator {
    return this.root().getByText(this.text("coverLetter.drafts"), { exact: true });
  }

  /** The section below the editor: heading, empty state / error / rows. */
  draftsSection(): Locator {
    // `has` is resolved inside each candidate div, so the heading locator must be page-relative, not root()-scoped.
    const heading = this.page.getByText(this.text("coverLetter.drafts"), { exact: true });
    return this.root().locator("div").filter({ has: heading }).last();
  }

  emptyState(): Locator {
    return this.root().getByText(this.text("coverLetter.empty"), { exact: true });
  }

  /** Every saved draft, newest first. */
  draftRows(): Locator {
    return this.draftsSection().getByRole("listitem");
  }

  /** The human description of a draft, as the row shows it: "Formal · Standard · English". */
  describe(options: { tone: LetterTone; length: LetterLength; language: LetterLanguage }): string {
    return [
      this.text(`coverLetter.toneValue.${options.tone}`),
      this.text(`coverLetter.lengthValue.${options.length}`),
      this.text(`coverLetter.languageValue.${options.language}`),
    ].join(" · ");
  }

  /** Rows whose text contains `description` (several drafts can share the same options). */
  draftRowsLike(description: string): Locator {
    return this.draftRows().filter({ hasText: description });
  }

  /** The button that opens a row's draft (first button of the row). */
  openRowButton(row: Locator): Locator {
    return row.getByRole("button").first();
  }

  /** The row's delete button, named "Delete draft: <description>". */
  deleteRowButton(row: Locator): Locator {
    return row.getByRole("button", { name: new RegExp(`^${escapeRegExp(this.text("coverLetter.delete"))}: `) });
  }

  /** Delete button by its full accessible name. */
  deleteButtonFor(description: string): Locator {
    return this.root().getByRole("button", { name: `${this.text("coverLetter.delete")}: ${description}`, exact: true });
  }

  editedTag(row: Locator): Locator {
    return row.getByText(this.text("coverLetter.editedTag"), { exact: true });
  }

  failedTag(row: Locator): Locator {
    return row.getByText(this.text("coverLetter.failedTag"), { exact: true });
  }

  async openDraft(row: Locator): Promise<void> {
    await this.openRowButton(row).click();
  }

  async deleteDraft(row: Locator): Promise<void> {
    await this.deleteRowButton(row).click();
  }

  // ── copy / download ──────────────────────────────────────────────────────
  async copy(): Promise<void> {
    await this.copyButton().click();
  }

  /** What the page can read back from the clipboard (needs clipboard-read permission). */
  async clipboardText(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  /** Simulate a browser without a usable clipboard API (non-secure context): writeText rejects. */
  async disableClipboard(): Promise<void> {
    await this.page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("clipboard unavailable")) },
      });
    });
  }

  /** Click "Download .txt" and return the file the browser received. */
  async download(): Promise<{ filename: string; text: string }> {
    const pending = this.page.waitForEvent("download");
    await this.downloadButton().click();
    const file = await pending;
    const path = await file.path();
    return { filename: file.suggestedFilename(), text: await readFile(path, "utf8") };
  }

  // ── keyboard ─────────────────────────────────────────────────────────────
  async pressEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  /** True when document.activeElement sits inside the dialog. */
  async focusIsInside(): Promise<boolean> {
    return this.root().evaluate((dialog) => dialog.contains(document.activeElement));
  }

  /** Describe the focused element. */
  async focused(): Promise<FocusStop> {
    return this.page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { role: "", name: "", id: "" };
      return {
        role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
        name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 80),
        id: el.id,
      };
    });
  }

  /** Focus `start`, then press Tab `count` times, recording every stop (start included). */
  async tabSequence(start: Locator, count: number): Promise<FocusStop[]> {
    await start.focus();
    const stops = [await this.focused()];
    for (let i = 0; i < count; i += 1) {
      await this.page.keyboard.press("Tab");
      stops.push(await this.focused());
    }
    return stops;
  }
}
