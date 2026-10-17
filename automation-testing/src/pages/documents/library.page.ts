import type { Download, Locator, Page, Response } from "@playwright/test";
import { uiLanguage as uiLanguageOf } from "@/components/ui-language";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { BasePage } from "../base.page";

// Saved-document library: /cv (client/src/views/CvLibrary) and /jd (views/JdLibrary). Both render the same parts:
//   header        <h1> library.title.<kind> + <p> library.subtitle ("{{count}} saved", only once the list settled)
//   list          <ul> of DocumentRow <li>: title, format Tag, locale date, "Actions" icon button → antd Dropdown menu
//   states        Skeleton (no role) · <p role="alert"> library.loadError · empty card with library.emptyCta
//   dialogs       DocumentPreviewModal (title = document title) · DocumentRenameModal · delete Popconfirm
//   gate          RequireAuth → SignInGate for anonymous visitors and guests (no list query is sent)

export type LibraryKind = "cv" | "jd";

const LIST_URL = (kind: LibraryKind) => new RegExp(`/api/v1/documents\\?kind=${kind.toUpperCase()}&saved=true$`);

export class LibraryPage extends BasePage {
  readonly preview: PreviewModal;
  readonly rename: RenameModal;

  constructor(page: Page) {
    super(page);
    this.preview = new PreviewModal(page);
    this.rename = new RenameModal(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  /** Open /cv or /jd and wait for hydration (the list itself may still be loading). */
  async goto(kind: LibraryKind): Promise<void> {
    await this.page.goto(`/${kind}`);
    await this.waitForAppReady();
  }

  /** Open /cv or /jd and wait until GET /documents?kind=…&saved=true has answered. */
  async gotoLoaded(kind: LibraryKind): Promise<Response> {
    const list = this.waitForList(kind);
    await this.goto(kind);
    return list;
  }

  waitForList(kind: LibraryKind): Promise<Response> {
    return this.page.waitForResponse((r) => LIST_URL(kind).test(r.url()) && r.request().method() === "GET");
  }

  /** Matches the list request of a kind (for network.recordRequests / stubs). */
  listUrl(kind: LibraryKind): RegExp {
    return LIST_URL(kind);
  }

  // ── header / states ─────────────────────────────────────────────────────
  heading(kind: LibraryKind): Locator {
    return this.shell.main().getByRole("heading", { level: 1, name: this.text(`library.title.${kind}`) });
  }

  subtitle(count: number): Locator {
    return this.shell.main().getByText(this.text("library.subtitle", { count }), { exact: true });
  }

  /** Any "<n> saved" line, whatever n is. */
  anySubtitle(): Locator {
    const sample = this.text("library.subtitle", { count: 987654 });
    const [before, after] = sample.split("987654");
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.shell.main().getByText(new RegExp(`^${esc(before)}\\d+${esc(after)}$`));
  }

  loadError(): Locator {
    return this.shell.main().getByRole("alert").filter({ hasText: this.text("library.loadError") });
  }

  /** Retry control on the load-error state (REQ-DOCUMENTS-37). */
  retryButton(): Locator {
    return this.shell.main().getByRole("button", { name: /retry|try again|thử lại/i });
  }

  emptyMessage(kind: LibraryKind): Locator {
    return this.shell.main().getByText(this.text(`library.empty.${kind}`), { exact: true });
  }

  emptyHint(): Locator {
    return this.shell.main().getByText(this.text("library.emptyHint"), { exact: true });
  }

  emptyCta(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("library.emptyCta") });
  }

  // ── rows ─────────────────────────────────────────────────────────────────
  rows(): Locator {
    return this.shell.main().getByRole("listitem");
  }

  /** The row whose title is exactly `title`. */
  row(title: string): Locator {
    return this.rows().filter({ has: this.page.getByText(title, { exact: true }) });
  }

  /** Each row's first <p> is the title; read them one by one so order is kept. */
  async titlesInOrder(): Promise<string[]> {
    const count = await this.rows().count();
    const titles: string[] = [];
    for (let i = 0; i < count; i += 1) titles.push((await this.rows().nth(i).locator("p").first().innerText()).trim());
    return titles;
  }

  formatBadge(title: string, format: "pdf" | "docx" | "text"): Locator {
    return this.row(title).getByText(this.text(`format.${format}`), { exact: true });
  }

  /** The row's date line as rendered (second <p> of the row). */
  dateText(title: string): Locator {
    return this.row(title).locator("p").nth(1);
  }

  actionsButton(title: string): Locator {
    return this.row(title).getByRole("button", { name: this.text("library.action.menu") });
  }

  /** The open actions menu (antd Dropdown renders role="menu" in a portal). */
  menu(): Locator {
    return this.page.getByRole("menu").filter({ visible: true });
  }

  menuItem(
    action: "preview" | "rename" | "compare" | "setLineage" | "download" | "delete"
  ): Locator {
    return this.menu().getByRole("menuitem", { name: this.text(`library.action.${action}`) });
  }

  async openMenu(title: string): Promise<void> {
    await this.actionsButton(title).click();
    await this.menu().waitFor();
  }

  /**
   * Reopen the row's menu after the delete Popconfirm was answered. Confirming closes the Dropdown, and while it is
   * closing (or closed) antd keeps the old menu DOM without re-rendering it, so the fresh state (e.g. the Delete item
   * disabled while the request is in flight) only shows on a menu opened after the old one is gone.
   */
  async ensureMenuOpen(title: string): Promise<void> {
    await this.confirmText().waitFor({ state: "hidden" });
    await this.menu().waitFor({ state: "hidden" });
    await this.openMenu(title);
  }

  /** Visible labels of the open actions menu, in order. */
  async menuLabels(): Promise<string[]> {
    return (await this.menu().getByRole("menuitem").allInnerTexts()).map((s) => s.trim());
  }

  // ── preview ──────────────────────────────────────────────────────────────
  async openPreview(title: string): Promise<void> {
    await this.openMenu(title);
    await this.menuItem("preview").click();
    await this.preview.dialog().waitFor();
  }

  // ── rename ───────────────────────────────────────────────────────────────
  async openRename(title: string): Promise<void> {
    await this.openMenu(title);
    await this.menuItem("rename").click();
    await this.rename.dialog().waitFor();
  }

  // ── delete ───────────────────────────────────────────────────────────────
  confirmText(): Locator {
    return this.page.getByText(this.text("library.delete.confirm"), { exact: true });
  }

  /** The danger "Delete" button of the Popconfirm (the menu entry is a menuitem, not a button). */
  confirmDeleteButton(): Locator {
    return this.page.getByRole("button", { name: this.text("library.action.delete"), exact: true });
  }

  cancelDeleteButton(): Locator {
    return this.page.getByRole("button", { name: this.text("action.cancel"), exact: true });
  }

  /** Open the menu and click "Delete": the Popconfirm shows, nothing is sent yet. */
  async askDelete(title: string): Promise<void> {
    await this.openMenu(title);
    // The Popconfirm trigger is the label <span> inside the menu item, not the whole <li>: a click on the item's
    // padding/icon reaches antd's Dropdown, which closes the menu without ever opening the Popconfirm.
    await this.menuItem("delete").getByText(this.text("library.action.delete"), { exact: true }).click();
    await this.confirmText().waitFor();
  }

  // ── download ─────────────────────────────────────────────────────────────
  /** Menu → Download; resolves with the browser download. */
  async downloadFromMenu(title: string): Promise<Download> {
    await this.openMenu(title);
    const download = this.page.waitForEvent("download");
    await this.menuItem("download").click();
    return download;
  }

  // ── feedback ─────────────────────────────────────────────────────────────
  /** antd message toast with this text. */
  toast(key: CopyKey): Locator {
    return this.page.getByText(this.text(key), { exact: true });
  }

  /** True when the page scrolls sideways (a long title must truncate, not widen the page). */
  async hasHorizontalOverflow(): Promise<boolean> {
    return this.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  }

  /** Collect uncaught page errors from now on (the returned array fills live). */
  collectPageErrors(): Error[] {
    const errors: Error[] = [];
    this.page.on("pageerror", (error) => errors.push(error));
    return errors;
  }

  // ── sign-in gate (anonymous / guest) ────────────────────────────────────
  gateTitle(kind: LibraryKind): Locator {
    return this.shell.main().getByRole("heading", { name: this.text(`gate.${kind}`) });
  }

  gateDescription(): Locator {
    return this.shell.main().getByText(this.text("gate.description"), { exact: true });
  }

  gateSignInLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("auth.signInWithDucker") });
  }

  gateBackLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("gate.backMatching") });
  }
}

/** DocumentPreviewModal: title = document title, body by format, footer Download (pdf/docx) + Close. */
export class PreviewModal {
  constructor(readonly page: Page) {}

  private get lng() {
    return uiLanguageOf(this.page);
  }

  dialog(title?: string): Locator {
    return title === undefined ? this.page.getByRole("dialog") : this.page.getByRole("dialog", { name: title });
  }

  loadingText(): Locator {
    return this.dialog().getByText(t("preview.loading", this.lng));
  }

  error(): Locator {
    return this.dialog().getByRole("alert").filter({ hasText: t("preview.error", this.lng) });
  }

  pdf(): Locator {
    return this.dialog().getByTestId("pdf-preview");
  }

  /** Rendered PDF pages (react-pdf draws each <Page> on its own canvas). */
  pdfCanvases(): Locator {
    return this.pdf().locator("canvas");
  }

  docx(): Locator {
    return this.dialog().getByTestId("docx-preview");
  }

  /** Any PDF/DOCX preview body still in the DOM, hidden or not (destroyOnHidden must remove it on close). */
  mountedPreviewBodies(): Locator {
    return this.page.getByTestId("pdf-preview").or(this.page.getByTestId("docx-preview"));
  }

  /** Elements the pasted HTML would have produced if the text preview rendered it as markup. */
  renderedMarkup(): Locator {
    return this.text().locator("b, img");
  }

  /** The <pre> a pasted-text document renders into. */
  text(): Locator {
    return this.dialog().locator("pre");
  }

  /** Footer Download (an <a href=…/file?download=1 download>). */
  downloadLink(): Locator {
    return this.dialog().getByRole("link", { name: t("preview.download", this.lng) });
  }

  /** Footer Close (the antd X also answers to "Close", so take the footer one: last in DOM order). */
  closeButton(): Locator {
    return this.dialog().getByRole("button", { name: t("preview.close", this.lng), exact: true }).last();
  }

  async close(): Promise<void> {
    await this.closeButton().click();
    await this.dialog().waitFor({ state: "detached" });
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}

/** DocumentRenameModal: label "Document name" bound to #rename-doc-title, Save disabled while blank. */
export class RenameModal {
  constructor(readonly page: Page) {}

  private get lng() {
    return uiLanguageOf(this.page);
  }

  dialog(): Locator {
    return this.page.getByRole("dialog", { name: t("library.rename.title", this.lng) });
  }

  input(): Locator {
    return this.dialog().getByLabel(t("library.rename.label", this.lng));
  }

  saveButton(): Locator {
    return this.dialog().getByRole("button", { name: t("library.rename.confirm", this.lng) });
  }

  cancelButton(): Locator {
    return this.dialog().getByRole("button", { name: t("action.cancel", this.lng) });
  }

  /** Waits for the PATCH it triggers. */
  async save(): Promise<Response> {
    const patch = this.page.waitForResponse((r) => r.request().method() === "PATCH" && /\/documents\/[^/]+$/.test(r.url()));
    await this.saveButton().click();
    return patch;
  }

  async fill(title: string): Promise<void> {
    await this.input().fill(title);
  }

  /** True while keyboard focus sits inside the dialog (focus trap). */
  async holdsFocus(): Promise<boolean> {
    return this.dialog().evaluate((el) => el.contains(document.activeElement));
  }
}
