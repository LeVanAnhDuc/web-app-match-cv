import type { Locator, Page } from "@playwright/test";
import { CredentialFormDialog } from "@/components/ai-credentials/credential-form-dialog.component";
import { t, type CopyKey } from "@/data/copy";
import { BasePage } from "../base.page";

// The "Run with" block of wizard step 3 (client/src/views/Wizard/components/RunWithSelector), seen from the
// ai-credentials module. Deliberately module-local and minimal: it reaches step 3 by pasting a JD and a CV (two
// transient documents) and only knows the credential picker. The wizard itself belongs to cv-jd-matching-wizard.
//   <p>Run with</p> · Checkbox.Group aria-label="Run with" → one checkbox per credential
//   ("<provider> <label> ••••last4 <status>") + "System key fallback" · [Add credential] · warning · privacy line

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class RunWithStepPage extends BasePage {
  readonly form: CredentialFormDialog;

  constructor(page: Page) {
    super(page);
    this.form = new CredentialFormDialog(page);
  }

  private text(key: CopyKey, vars?: Record<string, string | number>): string {
    return t(key, this.lng, vars);
  }

  // ── reaching step 3 ────────────────────────────────────────────────────────
  private pasteTab(): Locator {
    return this.shell.main().getByText(this.text("input.tab.paste"), { exact: true });
  }

  private pasteArea(): Locator {
    return this.shell.main().getByPlaceholder(this.text("paste.placeholder"));
  }

  private nextButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("action.next"), exact: true });
  }

  reviewHeading(): Locator {
    return this.shell.main().getByRole("heading", { name: this.text("wizard.stepReview.title") });
  }

  /**
   * Switch the input to "Paste text". Clicks the visible segment label (the hidden native radio does not fire the
   * Segmented onChange), retried until the textarea renders: right after hydration the first click can be a no-op.
   */
  private async pasteStep(text: string): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await this.pasteTab().click();
      if (await this.pasteArea().isVisible()) break;
      await this.pasteArea().waitFor({ timeout: 1_000 }).catch(() => undefined);
    }
    await this.pasteArea().fill(text);
    await this.nextButton().click();
  }

  /** /wizard → paste JD → Next → paste CV → Next → step 3 "Review documents". */
  async gotoReview(jdText: string, cvText: string): Promise<void> {
    await this.page.goto("/wizard");
    await this.waitForAppReady();
    await this.pasteStep(jdText);
    await this.pasteArea().waitFor({ state: "hidden" }).catch(() => undefined);
    await this.pasteStep(cvText);
    await this.reviewHeading().waitFor();
  }

  // ── Run with ───────────────────────────────────────────────────────────────
  /** The checkbox group as assistive tech sees it: role group named "Run with". */
  runWithGroup(): Locator {
    return this.shell.main().getByRole("group", { name: this.text("credentials.runWith.title") });
  }

  /** The element carrying aria-label "Run with" (whatever role it exposes). */
  runWithLabelled(): Locator {
    return this.shell.main().getByLabel(this.text("credentials.runWith.title"), { exact: true });
  }

  checkboxes(): Locator {
    return this.shell.main().getByRole("checkbox");
  }

  credentialCheckbox(label: string): Locator {
    return this.shell.main().getByRole("checkbox", { name: new RegExp(escape(label)) });
  }

  systemKeyCheckbox(): Locator {
    return this.shell.main().getByRole("checkbox", { name: new RegExp(`^${escape(this.text("credentials.systemKey"))}`) });
  }

  systemKeyTag(): Locator {
    return this.shell.main().getByText(this.text("credentials.systemKeyTag"), { exact: true });
  }

  addCredentialButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("credentials.add"), exact: true });
  }

  /** "<n> selected credential(s) has not passed a connection test." */
  untestedWarning(count: number): Locator {
    return this.shell.main().getByText(this.text("credentials.runWith.untestedCount", { count }), { exact: true });
  }

  /** Any untested warning, whatever the count. */
  anyUntestedWarning(): Locator {
    const one = this.text("credentials.runWith.untestedCount", { count: 1 });
    const many = this.text("credentials.runWith.untestedCount", { count: 2 });
    return this.shell.main().getByText(one.replace("1", "").trim()).or(this.shell.main().getByText(many.replace("2", "").trim()));
  }

  /** "Your CV and JD text will be sent to: <providers>." */
  privacyLine(providers: string[]): Locator {
    return this.shell.main().getByText(this.text("credentials.runWith.privacyList", { providers: providers.join(", ") }), {
      exact: true,
    });
  }

  /** Visible text of <main>, for raw-key checks. */
  async mainText(): Promise<string> {
    return this.shell.main().innerText();
  }

  /** The full serialized DOM of the tab, for leak checks. */
  async html(): Promise<string> {
    return this.page.content();
  }

  async openAddCredential(): Promise<void> {
    await this.addCredentialButton().click();
    await this.form.waitOpen();
  }
}
