import { expect, type Locator, type Page } from "@playwright/test";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { uiLanguage } from "@/components/ui-language";
import { BasePage } from "@/pages/base.page";

// /wizard (client/src/views/Wizard/**): Stepper → StepJD | StepCV (DocumentInputStep) → StepReview → StepResult.
// The whole wizard is one route driven by an in-memory store, so there is no URL per step: a page object method
// waits on the step's own heading instead of a URL. Labels follow this.lng (BasePage.setLanguage).

export type WizardStep = 1 | 2 | 3 | 4;
export type InputKind = "jd" | "cv";
export type ScoreKind = "overall" | "semantic" | "keyword";
export type ReportList = "strengths" | "gaps" | "suggestions";

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const STEP_LABEL: Record<WizardStep, CopyKey> = { 1: "step.jd", 2: "step.cv", 3: "step.review", 4: "step.result" };
const BLOCKED: Record<2 | 3 | 4, CopyKey> = { 2: "step.blocked.2", 3: "step.blocked.3", 4: "step.blocked.4" };
const STEP_TITLE: Record<InputKind | "review", CopyKey> = {
  jd: "wizard.stepJd.title",
  cv: "wizard.stepCv.title",
  review: "wizard.stepReview.title",
};
const SCORE_LABEL: Record<ScoreKind, CopyKey> = {
  overall: "result.overall",
  semantic: "result.semantic",
  keyword: "result.keyword",
};
const REPORT_LABEL: Record<ReportList, CopyKey> = {
  strengths: "result.strengths",
  gaps: "result.gaps",
  suggestions: "result.suggestions",
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "Before <tag>link</tag> after" → the visible text and the link text of a <Trans> string. */
function transParts(text: string, tag: string): { plain: string; link: string } {
  const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return { plain: text.replace(new RegExp(`</?${tag}>`, "g"), ""), link: match?.[1] ?? "" };
}

export class WizardPage extends BasePage {
  readonly saveDialog: SaveForReuseDialog;

  constructor(page: Page) {
    super(page);
    this.saveDialog = new SaveForReuseDialog(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  /** Open the wizard. With `runId`, the page reopens that run (no step-1 wait: it lands on step 4 or back on 1). */
  async goto(options: { runId?: string } = {}): Promise<void> {
    const query = options.runId ? `?runId=${encodeURIComponent(options.runId)}` : "";
    await this.page.goto(`/wizard${query}`);
    await this.waitForAppReady();
    if (!options.runId) await this.stepHeading("jd").waitFor();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForAppReady();
  }

  // ── stepper ──────────────────────────────────────────────────────────────
  stepperDot(step: WizardStep): Locator {
    return this.page.getByTestId(`stepper-step-${step}`);
  }

  /** Scoped to main: in VI the JD step label equals the sidebar nav link "Mô tả công việc". */
  stepLabel(step: WizardStep): Locator {
    return this.shell.main().getByText(this.text(STEP_LABEL[step]), { exact: true });
  }

  /** The "Go to <label>" button a finished step turns into. */
  stepJumpButton(step: WizardStep): Locator {
    return this.page.getByRole("button", {
      name: this.text("step.jumpTo", { label: this.text(STEP_LABEL[step]) }),
    });
  }

  /** The screen-reader text explaining why a step is blocked. */
  stepBlockedHint(step: 2 | 3 | 4): Locator {
    return this.page.locator(`#step-blocked-${step}`);
  }

  blockedHintText(step: 2 | 3 | 4): string {
    return this.text(BLOCKED[step]);
  }

  async jumpTo(step: WizardStep): Promise<void> {
    await this.stepJumpButton(step).click();
    await expect(this.stepperDot(step)).toHaveAttribute("aria-current", "step");
  }

  // ── step cards ───────────────────────────────────────────────────────────
  stepHeading(step: InputKind | "review"): Locator {
    return this.page.getByRole("heading", { name: this.text(STEP_TITLE[step]), exact: true });
  }

  reviewDescription(): Locator {
    return this.page.getByText(this.text("wizard.stepReview.description"));
  }

  backButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.back"), exact: true });
  }

  nextButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.next"), exact: true });
  }

  /** Inline error of the current step (scoped to <main>: toasts render outside it). */
  inlineAlert(): Locator {
    return this.shell.main().getByRole("alert");
  }

  // ── step 1 / 2: input ────────────────────────────────────────────────────
  modeTab(mode: "upload" | "paste"): Locator {
    return this.page.getByText(this.text(mode === "upload" ? "input.tab.upload" : "input.tab.paste"), { exact: true });
  }

  pasteArea(): Locator {
    return this.page.getByPlaceholder(this.text("paste.placeholder"));
  }

  fileInput(): Locator {
    return this.page.locator('input[type="file"]');
  }

  dropzoneHint(max: string): Locator {
    return this.page.getByText(this.text("dropzone.hint", { max }));
  }

  dropzoneFileName(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  /** Switch to "Paste text". Retried: under load the first click can land before React wires the handler. */
  async selectPasteMode(): Promise<void> {
    await expect(async () => {
      await this.modeTab("paste").click();
      await expect(this.pasteArea()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  }

  async selectUploadMode(): Promise<void> {
    await expect(async () => {
      await this.modeTab("upload").click();
      await expect(this.pasteArea()).toBeHidden({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  }

  async pasteText(text: string): Promise<void> {
    if (!(await this.pasteArea().isVisible())) await this.selectPasteMode();
    await this.pasteArea().fill(text);
  }

  async chooseFile(file: string | FilePayload): Promise<void> {
    if (await this.pasteArea().isVisible()) await this.selectUploadMode();
    await this.fileInput().setInputFiles(file);
  }

  /** Click Next and wait for the POST /documents it sends; returns the created document id. */
  async nextCreatingDocument(): Promise<string> {
    const created = this.page.waitForResponse(
      (r) => /\/api\/v1\/documents$/.test(new URL(r.url()).pathname) && r.request().method() === "POST"
    );
    await this.nextButton().click();
    const response = await created;
    return ((await response.json()) as { id: string }).id;
  }

  /** Step 1: paste a JD and go to step 2. Returns the JD id. */
  async submitJd(text: string): Promise<string> {
    await this.pasteText(text);
    const id = await this.nextCreatingDocument();
    await this.stepHeading("cv").waitFor();
    return id;
  }

  /** Step 2: paste a CV and go to step 3 with both documents rendered. Returns the CV id. */
  async submitCv(text: string): Promise<string> {
    await this.pasteText(text);
    const id = await this.nextCreatingDocument();
    await this.stepHeading("review").waitFor();
    return id;
  }

  /** Steps 1–2 by pasting; lands on step 3 once both texts are on screen. */
  async advanceToReview(jdText: string, cvText: string): Promise<{ jdId: string; cvId: string }> {
    const jdId = await this.submitJd(jdText);
    const cvId = await this.submitCv(cvText);
    await this.reviewText(jdText).waitFor();
    await this.reviewText(cvText).waitFor();
    return { jdId, cvId };
  }

  // ── guest ────────────────────────────────────────────────────────────────
  guestNote(): Locator {
    return this.shell.main().getByText(transParts(this.text("input.guestNote"), "signin").plain);
  }

  guestSignInLink(): Locator {
    return this.shell.main().getByRole("link", { name: transParts(this.text("input.guestNote"), "signin").link, exact: true });
  }

  // ── save for reuse ───────────────────────────────────────────────────────
  saveButton(): Locator {
    return this.page.getByRole("button", { name: this.text("save.button") });
  }

  savedConfirmation(title: string): Locator {
    return this.page.getByText(this.text("save.saved", { title }));
  }

  async saveForReuse(name: string): Promise<void> {
    await this.saveButton().click();
    await this.saveDialog.root().waitFor();
    await this.saveDialog.nameInput().fill(name);
    await this.saveDialog.confirmButton().click();
    await this.saveDialog.root().waitFor({ state: "hidden" });
  }

  // ── saved documents list ─────────────────────────────────────────────────
  reuseTitle(kind: InputKind): Locator {
    return this.page.getByRole("heading", { name: this.text(kind === "jd" ? "reuse.jd.title" : "reuse.cv.title") });
  }

  /** The saved-documents radiogroup (not antd Segmented's): its radios are named saved-JD / saved-CV. */
  savedList(): Locator {
    return this.page.getByRole("radiogroup").filter({ has: this.page.locator('input[type="radio"][name^="saved-"]') });
  }

  savedRadios(): Locator {
    return this.savedList().getByRole("radio");
  }

  savedRadio(title: string): Locator {
    return this.savedList().getByRole("radio", { name: new RegExp(escapeRegExp(title)) });
  }

  /** The whole row (label) of a saved document: title, date, format badge. */
  savedRow(title: string): Locator {
    return this.savedList().locator("label").filter({ hasText: title });
  }

  emptyState(kind: InputKind): Locator {
    return this.page.getByText(this.text(kind === "jd" ? "reuse.empty.jd" : "reuse.empty.cv"), { exact: true });
  }

  emptyHint(): Locator {
    return this.page.getByText(this.text("reuse.empty.hint"), { exact: true });
  }

  formatLabel(format: "pdf" | "docx" | "text"): string {
    return this.text(`format.${format}` as CopyKey);
  }

  // ── step 3: review ───────────────────────────────────────────────────────
  reviewText(text: string): Locator {
    return this.shell.main().getByText(text, { exact: true });
  }

  reviewLoading(): Locator {
    return this.page.getByText(this.text("review.loading"));
  }

  editableFields(): Locator {
    return this.shell.main().getByRole("textbox");
  }

  pdfPreviews(): Locator {
    return this.page.getByTestId("pdf-preview");
  }

  pdfCanvases(): Locator {
    return this.pdfPreviews().locator("canvas");
  }

  previewError(): Locator {
    return this.page.getByText(this.text("preview.error"));
  }

  systemKeyOption(): Locator {
    return this.page.getByRole("checkbox", { name: new RegExp(escapeRegExp(this.text("credentials.systemKey"))) });
  }

  /** "Your CV and JD text will be sent to: <providers>." */
  privacyNotice(providers: string): Locator {
    return this.page.getByText(this.text("credentials.runWith.privacyList", { providers }));
  }

  /** The guest's notice: "Your CV and JD text will be sent to OpenRouter using the system key." */
  systemPrivacyNotice(): Locator {
    return this.page.getByText(this.text("credentials.runWith.privacySystem"), { exact: true });
  }

  runMatchButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.runMatch"), exact: true });
  }

  /** Click Run match and wait for step 4 to become the current step. */
  async runMatch(): Promise<void> {
    await this.runMatchButton().click();
    await expect(this.stepperDot(4)).toHaveAttribute("aria-current", "step");
  }

  // ── step 4: result ───────────────────────────────────────────────────────
  resultRegion(): Locator {
    return this.page.locator('[aria-live="polite"]');
  }

  busyCard(): Locator {
    return this.shell.main().locator('[aria-busy="true"]');
  }

  cardTitle(title: string): Locator {
    return this.shell.main().getByRole("heading", { name: title, exact: true });
  }

  scoreMeter(kind: ScoreKind): Locator {
    return this.page.getByRole("meter", { name: this.text(SCORE_LABEL[kind]) });
  }

  /** The big "<n>%" readout. */
  scoreText(value: number): Locator {
    return this.shell.main().getByText(`${value}%`, { exact: true });
  }

  scoreLabel(kind: ScoreKind): Locator {
    return this.shell.main().getByText(this.text(SCORE_LABEL[kind]), { exact: true });
  }

  reportHeading(list: ReportList): Locator {
    return this.shell.main().getByRole("heading", { name: this.text(REPORT_LABEL[list]) });
  }

  reportItem(text: string): Locator {
    return this.shell.main().getByText(text, { exact: true });
  }

  showReportToggle(): Locator {
    return this.page.getByText(this.text("result.card.showReport"));
  }

  resultError(code: "invalid_key" | "no_quota" | "model_unavailable" | "timeout" | "unreachable"): Locator {
    return this.shell.main().getByRole("alert").filter({ hasText: this.text(`result.error.${code}` as CopyKey) });
  }

  tryAgainButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.tryAgain") });
  }

  startOverButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.startOver"), exact: true });
  }

  improveCvButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.improveCv") });
  }

  coverLetterButton(): Locator {
    return this.page.getByRole("button", { name: this.text("coverLetter.open") });
  }

  compareVersionsButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.compareVersions") });
  }

  /** Toast (antd message), rendered outside <main>. */
  toast(key: CopyKey): Locator {
    return this.page.getByText(this.text(key), { exact: true });
  }

  missingRunMessage(): Locator {
    return this.page.getByText(this.text("result.missingRun"), { exact: true });
  }

  // ── layout ───────────────────────────────────────────────────────────────
  async hasHorizontalScroll(): Promise<boolean> {
    // +1: sub-pixel rounding must not read as an overflow.
    return this.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
}

/** "Save this document for reuse" modal (SaveForReuseButton). */
export class SaveForReuseDialog {
  constructor(readonly page: Page) {}

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, uiLanguage(this.page), vars);
  }

  root(): Locator {
    return this.page.getByRole("dialog", { name: this.text("save.modal.title") });
  }

  description(): Locator {
    return this.root().getByText(this.text("save.modal.description"));
  }

  nameInput(): Locator {
    return this.root().getByLabel(this.text("save.modal.nameLabel"));
  }

  confirmButton(): Locator {
    return this.root().getByRole("button", { name: this.text("save.modal.confirm"), exact: true });
  }

  alert(): Locator {
    return this.root().getByRole("alert");
  }

  /** Whether keyboard focus is on the dialog or inside it. */
  async containsFocus(): Promise<boolean> {
    return this.root().evaluate((el) => el.contains(document.activeElement));
  }

  /**
   * Keyboard path to the name field. When the modal opens, antd moves focus onto the dialog panel itself (the input's
   * autoFocus does not win), so a keyboard user Tabs into the field from there.
   */
  async tabToNameInput(maxTabs = 5): Promise<void> {
    for (let i = 0; i < maxTabs; i++) {
      if (await this.nameInput().evaluate((el) => el === document.activeElement)) return;
      await this.page.keyboard.press("Tab");
    }
  }
}
