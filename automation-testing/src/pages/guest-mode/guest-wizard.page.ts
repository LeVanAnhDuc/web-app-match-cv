import type { Locator, Page, Response } from "@playwright/test";
import { SignInGate } from "@/components/guest-mode/sign-in-gate.component";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { BasePage } from "../base.page";

// /wizard as an anonymous visitor or a guest (client/src/views/Wizard). What differs from a signed-in user:
//   steps 1–2   DocumentInputStep: Segmented radiogroup Upload / Paste only, the input.guestNote paragraph (link
//               "Sign in" → /auth/login?returnTo=/wizard); no "Save for reuse", no "Or reuse a saved …" list
//   step 3      StepReview: no RunWithSelector ("Run with"), one "Run match" button on the system key
//   step 4      MatchResultCard titled "System key · <model>" without Improve my CV / Write cover letter; a 429
//               GUEST_QUOTA_EXCEEDED turns the card into SignInGate variant "quota"; KeepResultCallout below the
//               cards; the shell pins ResultActionBar ("Start over") under <main>
//   ?runId=     OpenRunFromUrl reopens step 4 of that run; ?claimed=1 shows ClaimedNotice (signed-in users only)

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** i18next <tag>…</tag> markup (Trans components) as the reader sees it: tags gone, text kept. */
const plain = (s: string) => s.replace(/<\/?\w+>/g, "");

export class GuestWizardPage extends BasePage {
  /** The quota card a 429 turns step 4 into. */
  readonly gate: SignInGate;

  constructor(page: Page) {
    super(page);
    this.gate = new SignInGate(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  /** Open /wizard (optionally with a query string such as `?runId=…&claimed=1`) and wait for hydration. */
  async goto(search = ""): Promise<void> {
    await this.page.goto(`/wizard${search}`);
    await this.waitForAppReady();
    await this.page.getByTestId("stepper-step-1").waitFor();
  }

  stepHeading(key: "wizard.stepJd.title" | "wizard.stepCv.title" | "wizard.stepReview.title"): Locator {
    return this.shell.main().getByRole("heading", { level: 2, name: this.text(key) });
  }

  // ── steps 1–2: input ──────────────────────────────────────────────────────
  inputModeGroup(): Locator {
    return this.shell.main().getByRole("radiogroup");
  }

  inputModes(): Locator {
    return this.inputModeGroup().getByRole("radio");
  }

  inputMode(mode: "upload" | "paste"): Locator {
    return this.inputModeGroup().getByRole("radio", { name: this.text(`input.tab.${mode}`), exact: true });
  }

  dropZone(): Locator {
    return this.shell.main().getByRole("button").filter({ hasText: this.text("dropzone.hint", { max: "10MB" }) });
  }

  pasteArea(): Locator {
    return this.shell.main().getByPlaceholder(this.text("paste.placeholder"));
  }

  guestNote(): Locator {
    return this.shell.main().getByText(plain(this.text("input.guestNote")), { exact: true });
  }

  guestNoteSignInLink(): Locator {
    return this.guestNote().getByRole("link", { name: this.text("auth.signIn"), exact: true });
  }

  saveForReuseButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("save.button") });
  }

  savedListHeading(kind: "jd" | "cv"): Locator {
    return this.shell.main().getByText(this.text(`reuse.${kind}.title`), { exact: true });
  }

  nextButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("action.next"), exact: true });
  }

  /**
   * Switch the Segmented control to "Paste text". The visible label is clicked (the native radio is hidden and does
   * not fire Segmented's onChange); retried because a click that lands before hydration is a no-op.
   */
  async switchToPaste(): Promise<void> {
    const label = this.inputModeGroup().getByText(this.text("input.tab.paste"), { exact: true }).first();
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await label.click();
      if (await this.pasteArea().waitFor({ timeout: 2_000 }).then(() => true, () => false)) return;
    }
    await this.pasteArea().waitFor();
  }

  async paste(text: string): Promise<void> {
    await this.switchToPaste();
    await this.pasteArea().fill(text);
  }

  /** "Next" on a document step; resolves with the POST /documents it sent. */
  async submitDocument(): Promise<Response> {
    const created = this.page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/documents") && r.request().method() === "POST"
    );
    await this.nextButton().click();
    return created;
  }

  /** Steps 1–2 by paste: JD, Next, CV, Next — ends on the Review heading. */
  async pasteJdAndCv(jd: string, cv: string): Promise<void> {
    await this.paste(jd);
    await this.submitDocument();
    await this.stepHeading("wizard.stepCv.title").waitFor();
    await this.paste(cv);
    await this.submitDocument();
    await this.stepHeading("wizard.stepReview.title").waitFor();
  }

  // ── step 3: review ────────────────────────────────────────────────────────
  runWithSelector(): Locator {
    return this.shell
      .main()
      .getByText(this.text("credentials.runWith.title"), { exact: true })
      .or(this.shell.main().getByLabel(this.text("credentials.runWith.title")));
  }

  runMatchButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("action.runMatch"), exact: true });
  }

  /** The multi-provider form "Run match · N providers", whatever N is. */
  runMatchCountButton(): Locator {
    const [before] = this.text("action.runMatchCount", { count: 2 }).split("2");
    return this.shell.main().getByRole("button", { name: new RegExp(`^${esc(before)}`) });
  }

  /** "Run match"; resolves with the POST /match/runs it opened. */
  async runMatch(): Promise<Response> {
    const run = this.page.waitForResponse((r) => r.url().endsWith("/api/v1/match/runs") && r.request().method() === "POST");
    await this.runMatchButton().click();
    return run;
  }

  // ── step 4: result ────────────────────────────────────────────────────────
  /** <h2> of a result card on the system key: "System key" or "System key · <model>". */
  systemKeyCardTitle(): Locator {
    return this.shell
      .main()
      .getByRole("heading", { level: 2, name: new RegExp(`^${esc(this.text("credentials.systemKey"))}`) });
  }

  overallMeter(): Locator {
    return this.shell.main().getByRole("meter", { name: this.text("result.overall") });
  }

  improveCvButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("action.improveCv") });
  }

  coverLetterButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("coverLetter.open") });
  }

  keepTitle(): Locator {
    return this.shell.main().getByRole("heading", { level: 2, name: this.text("result.keep.title") });
  }

  keepBody(): Locator {
    return this.shell.main().getByText(this.text("result.keep.body"), { exact: true });
  }

  keepSignInLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("result.keep.cta"), exact: true });
  }

  /** "Start over" pinned by the shell below <main> once a report is on screen. */
  actionBarButtons(): Locator {
    return this.page.locator("main + div").getByRole("button");
  }

  startOverButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.startOver"), exact: true });
  }

  // ── ?claimed=1 ───────────────────────────────────────────────────────────
  claimedBanner(): Locator {
    return this.shell.main().getByRole("status").filter({ hasText: this.text("wizard.claimed.title") });
  }

  claimedBody(): Locator {
    return this.claimedBanner().getByText(this.text("wizard.claimed.body"), { exact: true });
  }

  async dismissClaimed(): Promise<void> {
    await this.claimedBanner().getByRole("button", { name: this.text("action.dismiss") }).click();
    await this.page.waitForURL((url) => !url.searchParams.has("claimed"));
  }
}
