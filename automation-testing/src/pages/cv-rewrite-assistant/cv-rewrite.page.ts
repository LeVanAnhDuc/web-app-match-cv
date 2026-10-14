import type { Locator, Page, Response } from "@playwright/test";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { uiLanguage } from "@/components/ui-language";
import { BasePage } from "../base.page";

// /cv-rewrite/:matchResultId (client/src/routes/_app/cv-rewrite.$matchResultId.tsx → views/CvRewrite/**):
//   <h1> rewrite.title + subtitle
//   setup SectionCard: <h2> "Rewrite "<CV title>"", gaps list | noGaps Alert, RunWith (Select + privacy line),
//                      Generate / Generate again button, page-level error Alert
//   <div aria-live="polite">: skeleton while generating, then the "Suggested changes" card: Select all (header),
//                      one ChangeCard (<li role="group">) per change, unaddressed-gaps Alert, "Preview the result"
//                      Collapse (<pre>), footer with "N changes selected" + "Save as new CV"
//   SaveRewriteModal: name field (≤ 200), Save / Cancel
//   Signed-out / guest: RequireAuth renders SignInGate (<h2> gate.cvRewrite) instead of all of the above.
// Labels resolve in the tab's current language (setLanguage), so the same calls work in en and vi.

const label = (page: Page, key: CopyKey, vars?: Vars) => t(key, uiLanguage(page), vars);

/** "Run with" key picker + privacy note (views/CvRewrite/components/RewriteRunWith). */
export class RunWithControl {
  constructor(readonly page: Page) {}

  /** The antd Select, exposed as a combobox named "Run with". */
  select(): Locator {
    return this.page.getByRole("combobox", { name: label(this.page, "credentials.runWith.title") });
  }

  /**
   * Text shown for the current choice (or, while the dropdown is open, an option): antd renders both with a
   * `title` equal to the label, so this needs no library class.
   */
  choice(text: string): Locator {
    return this.page.getByTitle(text, { exact: true });
  }

  systemKeyChoice(): Locator {
    return this.choice(label(this.page, "credentials.systemKey"));
  }

  untestedTag(): Locator {
    return this.page.getByText(label(this.page, "credentials.runWith.untestedWarning"), { exact: true });
  }

  privacySystem(): Locator {
    return this.page.getByText(label(this.page, "credentials.runWith.privacySystem"), { exact: true });
  }

  privacyFor(provider: string): Locator {
    return this.page.getByText(label(this.page, "credentials.runWith.privacy", { provider }), { exact: true });
  }

  /**
   * antd paints the selected item (<span title="…">) over the combobox input, so a pointer click on the input is
   * intercepted once a value is chosen; open the listbox the keyboard way (focus, ArrowDown) instead.
   */
  async open(): Promise<void> {
    await this.select().focus();
    await this.page.keyboard.press("ArrowDown");
    await this.page.getByRole("listbox").waitFor({ state: "attached" });
  }

  async pickSystemKey(): Promise<void> {
    await this.pick(label(this.page, "credentials.systemKey"));
  }

  /** Pick an option by its full label ("OpenRouter · Work · ••••7Q2z", "System key"). */
  async pick(optionLabel: string): Promise<void> {
    await this.open();
    await this.choice(optionLabel).filter({ visible: true }).last().click();
  }
}

/** One proposed change (views/CvRewrite/components/ChangeCard): <li role="group"> with its own checkbox. */
export class ChangeCard {
  constructor(
    readonly page: Page,
    readonly root: Locator
  ) {}

  checkbox(): Locator {
    return this.root.getByRole("checkbox");
  }

  /** The eyebrow: sectionHint, or rewrite.change.untitled when the model gave none. */
  eyebrow(text: string): Locator {
    return this.root.getByText(text, { exact: true });
  }

  untitledEyebrow(): Locator {
    return this.eyebrow(label(this.page, "rewrite.change.untitled"));
  }

  originalLabel(): Locator {
    return this.root.getByText(label(this.page, "rewrite.change.original"), { exact: true });
  }

  suggestedLabel(): Locator {
    return this.root.getByText(label(this.page, "rewrite.change.suggested"), { exact: true });
  }

  removalTag(): Locator {
    return this.root.getByText(label(this.page, "rewrite.change.removal"), { exact: true });
  }

  /** Any exact text inside the card (original, replacement, rationale, gap tag). */
  text(value: string): Locator {
    return this.root.getByText(value, { exact: true });
  }

  async tick(): Promise<void> {
    await this.checkbox().check();
  }
}

/** "Save as a new CV" modal (views/CvRewrite/components/SaveRewriteModal). */
export class SaveRewriteDialog {
  constructor(readonly page: Page) {}

  root(): Locator {
    return this.page.getByRole("dialog", { name: label(this.page, "rewrite.save.title") });
  }

  nameInput(): Locator {
    return this.root().getByLabel(label(this.page, "rewrite.save.nameLabel"));
  }

  confirmButton(): Locator {
    return this.root().getByRole("button", { name: label(this.page, "rewrite.save.confirm"), exact: true });
  }

  cancelButton(): Locator {
    return this.root().getByRole("button", { name: label(this.page, "action.cancel"), exact: true });
  }

  nameRequiredError(): Locator {
    return this.root().getByText(label(this.page, "save.nameRequired"), { exact: true });
  }

  hint(): Locator {
    return this.root().getByText(label(this.page, "rewrite.save.hint"), { exact: true });
  }

  /**
   * Wait until the modal finished opening: rc-dialog moves keyboard focus into the dialog only after its zoom-in
   * animation, and keys pressed before that (Escape, Tab) still go to the page behind it.
   */
  async waitFocusInside(): Promise<void> {
    await this.root().waitFor();
    await this.page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]') != null);
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput().fill(name);
  }

  async confirm(): Promise<void> {
    await this.confirmButton().click();
  }
}

export class CvRewritePage extends BasePage {
  readonly runWith: RunWithControl;
  readonly saveDialog: SaveRewriteDialog;

  constructor(page: Page) {
    super(page);
    this.runWith = new RunWithControl(page);
    this.saveDialog = new SaveRewriteDialog(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  /** Navigate and wait for hydration. Does not wait for the match to load (error/gate paths use this too). */
  async goto(matchResultId: string): Promise<void> {
    await this.page.goto(`/cv-rewrite/${matchResultId}`);
    await this.waitForAppReady();
  }

  /** goto() + the page heading and the setup card are on screen (the match loaded). */
  async open(matchResultId: string): Promise<void> {
    await this.goto(matchResultId);
    await this.heading().waitFor();
    await this.generateButton().or(this.regenerateButton()).waitFor();
  }

  // ── page head & setup ─────────────────────────────────────────────────────
  heading(): Locator {
    return this.page.getByRole("heading", { level: 1, name: this.text("rewrite.title") });
  }

  subtitle(): Locator {
    return this.page.getByText(this.text("rewrite.subtitle"), { exact: true });
  }

  /** <h2> "Rewrite "<title>"" of the setup card. */
  setupHeading(cvTitle: string): Locator {
    return this.page.getByRole("heading", { level: 2, name: this.text("rewrite.setup.title", { title: cvTitle }) });
  }

  /** Setup heading while the CV title is not known yet ("Rewrite "this CV""). */
  setupHeadingFallback(): Locator {
    return this.setupHeading(this.text("rewrite.setup.thisCv"));
  }

  /** Any text still carrying an i18next placeholder, e.g. a raw "{{title}}". */
  rawPlaceholder(): Locator {
    return this.page.getByText(/\{\{\s*\w+\s*\}\}/);
  }

  gapsTitle(): Locator {
    return this.page.getByText(this.text("rewrite.gapsTitle"), { exact: true });
  }

  gap(text: string): Locator {
    return this.page.getByRole("listitem").filter({ hasText: text });
  }

  noGapsNotice(): Locator {
    return this.page.getByText(this.text("rewrite.noGaps"), { exact: true });
  }

  generateButton(): Locator {
    return this.page.getByRole("button", { name: this.text("rewrite.generate"), exact: true });
  }

  /**
   * The Generate button in any state. While a request is in flight antd adds a loading icon (role=img,
   * aria-label "loading") to the button, so its accessible name is no longer exactly the label.
   */
  generateButtonAnyState(): Locator {
    return this.page.getByRole("button", { name: this.text("rewrite.generate") });
  }

  regenerateButton(): Locator {
    return this.page.getByRole("button", { name: this.text("rewrite.regenerate"), exact: true });
  }

  /** Text of any message on the page (errors, alerts, success toast) by UI key. */
  message(key: CopyKey, vars?: Vars): Locator {
    return this.page.getByText(this.text(key, vars), { exact: true });
  }

  /** The page-level error (role=alert) that replaces the whole review when the match cannot be loaded. */
  loadError(key: CopyKey): Locator {
    return this.page.getByRole("alert").filter({ hasText: this.text(key) });
  }

  // ── proposal ─────────────────────────────────────────────────────────────
  /** The aria-live region the skeleton and the proposal render into. */
  liveRegion(): Locator {
    return this.page.locator('[aria-live="polite"]');
  }

  /** Element marked busy while suggestions are being generated (the skeleton card). */
  busyIndicator(): Locator {
    return this.liveRegion().locator('[aria-busy="true"]');
  }

  changesHeading(): Locator {
    return this.page.getByRole("heading", { level: 2, name: this.text("rewrite.changes.title") });
  }

  selectAll(): Locator {
    return this.page.getByRole("checkbox", { name: this.text("rewrite.changes.selectAll") });
  }

  changeGroups(): Locator {
    return this.liveRegion().getByRole("group");
  }

  /** Every checkbox of the change cards (excludes Select all). */
  changeCheckboxes(): Locator {
    return this.changeGroups().getByRole("checkbox");
  }

  /** The n-th change card (0-based, CV order). */
  change(index: number): ChangeCard {
    return new ChangeCard(this.page, this.changeGroups().nth(index));
  }

  /** The change card holding `text` (its original or replacement). */
  changeWith(text: string): ChangeCard {
    return new ChangeCard(this.page, this.changeGroups().filter({ hasText: text }));
  }

  selectedCount(count: number): Locator {
    return this.page.getByText(this.text("rewrite.changes.selectedCount", { count }), { exact: true });
  }

  saveAsNewButton(): Locator {
    return this.page.getByRole("button", { name: this.text("rewrite.saveAsNew"), exact: true });
  }

  emptyNotice(): Locator {
    return this.page.getByText(this.text("rewrite.changes.empty"), { exact: true });
  }

  emptyHint(): Locator {
    return this.page.getByText(this.text("rewrite.changes.emptyHint"), { exact: true });
  }

  unaddressedTitle(): Locator {
    return this.page.getByText(this.text("rewrite.unaddressed.title"), { exact: true });
  }

  unaddressedHint(): Locator {
    return this.page.getByText(this.text("rewrite.unaddressed.hint"), { exact: true });
  }

  previewToggle(): Locator {
    return this.page.getByRole("button", { name: this.text("rewrite.preview") });
  }

  /** The <pre> holding the CV text with the ticked changes applied. */
  previewText(): Locator {
    return this.liveRegion().locator("pre");
  }

  /** Every open dialog on the page (a confirmation would be one). */
  dialogs(): Locator {
    return this.page.getByRole("dialog");
  }

  /** Elements that would only exist if text had been rendered as markup (REQ-32). */
  markupNodes(): Locator {
    return this.page.getByRole("main").locator(`script, b, em, img[src="x"]`);
  }

  /** Accessible names of the change checkboxes, in order (aria-label, else aria-labelledby, else label text). */
  async changeCheckboxNames(): Promise<string[]> {
    return this.changeCheckboxes().evaluateAll((boxes) =>
      boxes.map((box) => {
        const own = box.getAttribute("aria-label");
        if (own) return own.trim();
        const ids = box.getAttribute("aria-labelledby");
        if (ids) {
          return ids
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
            .trim();
        }
        return (box.closest("label")?.textContent ?? "").trim();
      })
    );
  }

  /** Press Tab until `target` has focus; returns the number of presses, or -1 if it never got focus. */
  async tabTo(target: Locator, maxPresses = 15): Promise<number> {
    for (let presses = 1; presses <= maxPresses; presses += 1) {
      await this.page.keyboard.press("Tab");
      if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))) {
        return presses;
      }
    }
    return -1;
  }

  // ── sign-in gate (signed-out / guest) ────────────────────────────────────
  gateHeading(): Locator {
    return this.page.getByRole("heading", { name: this.text("gate.cvRewrite") });
  }

  gateDescription(): Locator {
    return this.page.getByText(this.text("gate.description"), { exact: true });
  }

  // ── actions ──────────────────────────────────────────────────────────────
  /** Press Generate (or Generate again) and wait for the POST /cv-rewrite response. */
  async generate(): Promise<Response> {
    const response = this.page.waitForResponse(
      (r) => r.request().method() === "POST" && /\/api\/v1\/cv-rewrite$/.test(new URL(r.url()).pathname)
    );
    await this.generateButton().or(this.regenerateButton()).click();
    return response;
  }

  /** generate() and wait until the "Suggested changes" card is on screen. */
  async generateProposal(): Promise<void> {
    await this.generate();
    await this.changesHeading().waitFor();
  }

  /** Click Generate again while a generation is already running (the user's impatient second click). */
  async clickGenerateWhileBusy(): Promise<void> {
    await this.generateButtonAnyState().click();
  }

  async tickAll(): Promise<void> {
    await this.selectAll().check();
  }

  async openPreview(): Promise<void> {
    await this.previewToggle().click();
    await this.previewText().waitFor();
  }

  async openSaveDialog(): Promise<void> {
    await this.saveAsNewButton().click();
    await this.saveDialog.root().waitFor();
  }

  /** Confirm the save dialog and wait for the POST /cv-rewrite/accept response. */
  async confirmSave(): Promise<Response> {
    const response = this.page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/cv-rewrite/accept")
    );
    await this.saveDialog.confirm();
    return response;
  }
}
