import type { Locator, Page } from "@playwright/test";
import type { AiTestStatus } from "#/types/AiCredentials";
import { CredentialFormDialog } from "@/components/ai-credentials/credential-form-dialog.component";
import { t, type CopyKey } from "@/data/copy";
import { BasePage } from "../base.page";

// /ai-credentials (client/src/routes/_app/ai-credentials.tsx → RequireAuth → views/AiCredentials):
//   signed in   <h1> title + subtitle, SectionCard [Add credential] with skeleton | alert | empty state | <ul> rows,
//               fallback note under the card
//   otherwise   SignInGate (h2 "Sign in to manage your AI keys"), or an aria-busy skeleton while auth resolves
// A row (<li>): provider Tag · label · ••••last4 · "<chat> · <embed>" · TestStatusTag · Test / Edit / Delete(Popconfirm).

export class AiCredentialsPage extends BasePage {
  readonly form: CredentialFormDialog;

  constructor(page: Page) {
    super(page);
    this.form = new CredentialFormDialog(page);
  }

  private text(key: CopyKey, vars?: Record<string, string | number>): string {
    return t(key, this.lng, vars);
  }

  async goto(): Promise<void> {
    await this.page.goto("/ai-credentials");
    await this.waitForAppReady();
  }

  /** goto() and wait until the signed-in page has its heading (not the gate). */
  async open(): Promise<void> {
    await this.goto();
    await this.heading().waitFor();
  }

  // ── frame ──────────────────────────────────────────────────────────────────
  heading(): Locator {
    return this.shell.main().getByRole("heading", { level: 1, name: this.text("credentials.title") });
  }

  level1Headings(): Locator {
    return this.shell.main().getByRole("heading", { level: 1 });
  }

  subtitle(): Locator {
    return this.shell.main().getByText(this.text("credentials.subtitle"), { exact: true });
  }

  fallbackNote(): Locator {
    return this.shell.main().getByText(this.text("credentials.fallbackNote"), { exact: true });
  }

  /** "Add credential" buttons on screen (the card header one, plus the empty-state one when empty). */
  addButtons(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("credentials.add"), exact: true });
  }

  /** The card-header "Add credential" (always present on the signed-in page). */
  addButton(): Locator {
    return this.addButtons().first();
  }

  emptyTitle(): Locator {
    return this.shell.main().getByText(this.text("credentials.empty"), { exact: true });
  }

  emptyHint(): Locator {
    return this.shell.main().getByText(this.text("credentials.emptyHint"), { exact: true });
  }

  /** The load-failure Alert (role="alert"). */
  loadAlert(): Locator {
    return this.shell.main().getByRole("alert");
  }

  // ── gate (no account) ──────────────────────────────────────────────────────
  gateHeading(): Locator {
    return this.shell.main().getByRole("heading", { name: this.text("gate.aiCredentials") });
  }

  gateBackLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("gate.backMatching") });
  }

  /** The aria-busy skeleton RequireAuth renders while the session is being resolved. */
  busyPlaceholder(): Locator {
    return this.page.locator('[aria-busy="true"]');
  }

  // ── rows ───────────────────────────────────────────────────────────────────
  list(): Locator {
    return this.shell.main().getByRole("list");
  }

  rows(): Locator {
    return this.list().getByRole("listitem");
  }

  row(label: string): Locator {
    return this.rows().filter({ hasText: label });
  }

  rowLabel(label: string): Locator {
    return this.row(label).getByText(label, { exact: true });
  }

  /** Any exact text inside a row (e.g. to prove a raw enum is NOT there). */
  rowExactText(label: string, text: string): Locator {
    return this.row(label).getByText(text, { exact: true });
  }

  rowProvider(label: string, providerLabel: string): Locator {
    return this.row(label).getByText(providerLabel, { exact: true });
  }

  rowMask(label: string, last4: string): Locator {
    return this.row(label).getByText(`••••${last4}`, { exact: true });
  }

  /** "<chat> · <embed>" — null overrides render as the "Default" copy. */
  rowModelLine(label: string, chatModel: string | null, embedModel: string | null): Locator {
    const fallback = this.text("credentials.defaultModel");
    return this.row(label).getByText(`${chatModel ?? fallback} · ${embedModel ?? fallback}`, { exact: true });
  }

  /** The TestStatusTag text: a verdict, or "Not tested" for null. */
  rowStatus(label: string, status: AiTestStatus | null): Locator {
    const key = (status ? `credentials.status.${status}` : "credentials.status.untested") as CopyKey;
    return this.row(label).getByText(this.text(key), { exact: true });
  }

  /** The relative "tested … ago" text next to the tag (absent when never tested). */
  rowTestedAt(label: string, relative: string): Locator {
    return this.row(label).getByText(relative, { exact: true });
  }

  // Row buttons match by substring: while loading, antd prepends an img "loading" to the accessible name.
  rowButtons(label: string): Locator {
    return this.row(label).getByRole("button");
  }

  testButton(label: string): Locator {
    return this.row(label).getByRole("button", { name: this.text("credentials.actions.test") });
  }

  editButton(label: string): Locator {
    return this.row(label).getByRole("button", { name: this.text("credentials.actions.edit") });
  }

  deleteButton(label: string): Locator {
    return this.row(label).getByRole("button", { name: this.text("credentials.actions.delete") });
  }

  /** antd's loading spinner inside a button (img "loading"). */
  loadingSpinner(button: Locator): Locator {
    return button.getByRole("img", { name: "loading" });
  }

  // ── delete confirmation (Popconfirm, role tooltip) ─────────────────────────
  deleteConfirm(): Locator {
    return this.page.getByRole("tooltip").filter({ hasText: this.text("credentials.delete.confirm") });
  }

  deleteConfirmHint(): Locator {
    return this.deleteConfirm().getByText(this.text("credentials.delete.hint"), { exact: true });
  }

  deleteConfirmButton(): Locator {
    return this.deleteConfirm().getByRole("button", { name: this.text("credentials.actions.delete"), exact: true });
  }

  deleteCancelButton(): Locator {
    return this.deleteConfirm().getByRole("button", { name: this.text("action.cancel"), exact: true });
  }

  /** A toast (antd message) by its copy key. */
  toast(key: CopyKey): Locator {
    return this.page.getByText(this.text(key), { exact: true });
  }

  /** A tooltip with this exact text (the full date of a test verdict). */
  tooltipWithText(text: string): Locator {
    return this.page.getByRole("tooltip").filter({ hasText: text });
  }

  // ── actions ────────────────────────────────────────────────────────────────
  /** Open the add dialog from the card header. */
  async openAddDialog(): Promise<void> {
    await this.addButton().click();
    await this.form.waitOpen();
  }

  async openEditDialog(label: string): Promise<void> {
    await this.editButton(label).click();
    await this.form.waitOpen();
  }

  async askDelete(label: string): Promise<void> {
    await this.deleteButton(label).click();
    await this.deleteConfirm().waitFor();
  }

  /** Hover the relative time of a row to show its full-date tooltip. */
  async hoverTestedAt(label: string, relative: string): Promise<void> {
    await this.rowTestedAt(label, relative).hover();
  }

  /** The browser's own rendering of `iso` in `lng` (what the tooltip shows: Date#toLocaleString). */
  async browserDateTime(iso: string): Promise<string> {
    return this.page.evaluate(([value, lng]) => new Date(value).toLocaleString(lng), [iso, this.lng] as const);
  }

  /** What Intl.RelativeTimeFormat renders in the browser for `minutes` (negative = past), like TestStatusTag. */
  async browserRelativeMinutes(minutes: number): Promise<string> {
    return this.page.evaluate(
      ([value, lng]) => new Intl.RelativeTimeFormat(lng, { numeric: "auto" }).format(value, "minute"),
      [minutes, this.lng] as const
    );
  }

  /** Visible text of <main>, for raw-key / leak checks. */
  async mainText(): Promise<string> {
    return this.shell.main().innerText();
  }

  /** Visible text of the whole document (dialogs and popovers are portalled outside <main>). */
  async bodyText(): Promise<string> {
    return this.page.locator("body").innerText();
  }

  /** The full serialized DOM of the tab, for leak checks. */
  async html(): Promise<string> {
    return this.page.content();
  }
}
