import type { Locator, Page } from "@playwright/test";
import type { AiTestStatus } from "#/types/AiCredentials";
import { t, type CopyKey } from "@/data/copy";
import { uiLanguage } from "@/components/ui-language";

// client/src/components/CredentialFormModal — the add/edit dialog. Opened from the credentials page (header button,
// empty state, row "Edit") and from wizard step 3 ("Run with" → Add credential), so it lives in components/.
// Labels resolve in the tab's current UI language (BasePage.setLanguage).

export interface CredentialFormValues {
  /** Human label of the provider ("Google Gemini"), picked from the Select. */
  providerLabel?: string;
  label?: string;
  apiKey?: string;
  chatModel?: string;
  embedModel?: string;
}

export class CredentialFormDialog {
  constructor(readonly page: Page) {}

  private text(key: CopyKey, vars?: Record<string, string | number>): string {
    return t(key, uiLanguage(this.page), vars);
  }

  /** The dialog, add or edit. */
  root(): Locator {
    return this.page
      .getByRole("dialog", { name: this.text("credentials.form.addTitle") })
      .or(this.page.getByRole("dialog", { name: this.text("credentials.form.editTitle") }));
  }

  addDialog(): Locator {
    return this.page.getByRole("dialog", { name: this.text("credentials.form.addTitle") });
  }

  editDialog(): Locator {
    return this.page.getByRole("dialog", { name: this.text("credentials.form.editTitle") });
  }

  provider(): Locator {
    return this.root().getByLabel(this.text("credentials.form.provider"));
  }

  label(): Locator {
    return this.root().getByLabel(this.text("credentials.form.label"), { exact: true });
  }

  apiKey(): Locator {
    return this.root().getByLabel(this.text("credentials.form.apiKey"), { exact: true });
  }

  chatModel(): Locator {
    return this.root().getByLabel(this.text("credentials.form.chatModel"), { exact: true });
  }

  embedModel(): Locator {
    return this.root().getByLabel(this.text("credentials.form.embedModel"), { exact: true });
  }

  saveButton(): Locator {
    return this.root().getByRole("button", { name: this.text("credentials.form.save"), exact: true });
  }

  cancelButton(): Locator {
    return this.root().getByRole("button", { name: this.text("action.cancel"), exact: true });
  }

  /** A help/extra or validation text inside the dialog. */
  message(key: CopyKey, vars?: Record<string, string | number>): Locator {
    return this.root().getByText(this.text(key, vars), { exact: true });
  }

  /** Any text inside the dialog (e.g. the provider currently shown in the Select). */
  textInDialog(text: string): Locator {
    return this.root().getByText(text, { exact: true });
  }

  /** "Testing connection…" while the post-save test runs. */
  testingIndicator(): Locator {
    return this.message("credentials.form.testing");
  }

  /** "Chat: <status>" / "Embeddings: <status>" lines of the post-save test. */
  capabilityLine(capability: "chat" | "embed", status: AiTestStatus): Locator {
    const name = this.text(capability === "chat" ? "credentials.chatLabel" : "credentials.embedLabel");
    return this.root().getByText(`${name}: ${this.text(`credentials.status.${status}` as CopyKey)}`, { exact: true });
  }

  /** Any capability line, whatever the verdict. */
  anyCapabilityLine(): Locator {
    const chat = this.text("credentials.chatLabel");
    return this.root().getByText(new RegExp(`^${chat}: `));
  }

  /** "Could not save the credential" alert (non-409 save failure). */
  saveErrorAlert(): Locator {
    return this.root().getByRole("alert").filter({ hasText: this.text("credentials.errors.saveFailed") });
  }

  // ── actions ────────────────────────────────────────────────────────────────
  async waitOpen(): Promise<void> {
    await this.root().waitFor();
    await this.label().waitFor();
  }

  /**
   * Pick a provider in the Select by its human label. The option carries it as `title`; so does the selected value
   * shown in the box, and the dropdown is portalled at the end of <body>, so the last visible match is the option.
   */
  async chooseProvider(providerLabel: string): Promise<void> {
    // antd paints the selected item (<span title="OpenRouter">) over the combobox input, so a pointer click on the
    // input is intercepted; open the listbox the keyboard way instead (focus the combobox, ArrowDown).
    await this.provider().focus();
    await this.page.keyboard.press("ArrowDown");
    await this.page.getByTitle(providerLabel, { exact: true }).filter({ visible: true }).last().click();
  }

  async fill(values: CredentialFormValues): Promise<void> {
    if (values.providerLabel !== undefined) await this.chooseProvider(values.providerLabel);
    if (values.label !== undefined) await this.label().fill(values.label);
    if (values.apiKey !== undefined) await this.apiKey().fill(values.apiKey);
    if (values.chatModel !== undefined) await this.chatModel().fill(values.chatModel);
    if (values.embedModel !== undefined) await this.embedModel().fill(values.embedModel);
  }

  async save(): Promise<void> {
    await this.saveButton().click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton().click();
    await this.root().waitFor({ state: "hidden" });
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
