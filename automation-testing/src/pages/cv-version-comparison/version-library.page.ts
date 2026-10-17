import type { Locator, Page } from "@playwright/test";
import { t, type Lng } from "@/data/copy";
import { uiLanguage } from "@/components/ui-language";
import { BasePage } from "../base.page";

export type LibraryKind = "cv" | "jd";

// The two saved-document libraries (/cv, /jd) as far as lineage is concerned: each row's Actions menu
// (client/src/components/DocumentRow) and the "Version history" dialog (client/src/components/DocumentLineageModal).
// The libraries themselves (preview, rename, delete) belong to the documents / home-dashboard-library modules.
export class VersionLibraryPage extends BasePage {
  readonly lineageDialog: LineageDialog;

  constructor(page: Page) {
    super(page);
    this.lineageDialog = new LineageDialog(page);
  }

  /** Opens /cv or /jd and waits for its heading. */
  async goto(kind: LibraryKind = "cv"): Promise<void> {
    await this.page.goto(`/${kind}`);
    await this.waitForAppReady();
    await this.heading(kind).waitFor();
  }

  heading(kind: LibraryKind = "cv"): Locator {
    return this.page.getByRole("heading", { level: 1, name: t(`library.title.${kind}`, this.lng) });
  }

  /** The row of a document, by its exact title (titles that contain one another stay apart). */
  row(title: string): Locator {
    return this.page.getByRole("listitem").filter({ has: this.page.getByText(title, { exact: true }) });
  }

  actionsButton(title: string): Locator {
    return this.row(title).getByRole("button", { name: t("library.action.menu", this.lng) });
  }

  /** Opens a row's Actions dropdown (portaled to <body>) and waits for the menu. */
  async openActions(title: string): Promise<void> {
    // Keyboard activation (focus + Enter fires the button's click): on small viewports a row near the bottom sits
    // under the dev server's fixed "Open TanStack Devtools" button, which swallows a pointer click.
    await this.actionsButton(title).focus();
    await this.page.keyboard.press("Enter");
    await this.menu().waitFor();
  }

  /** Closes an open Actions dropdown. */
  async closeActions(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.menu().waitFor({ state: "hidden" });
  }

  /** The Actions dropdown that is open (antd keeps closed menus in the DOM, hidden). */
  menu(): Locator {
    return this.page.getByRole("menu").filter({ visible: true });
  }

  compareItem(): Locator {
    return this.menu().getByRole("menuitem", { name: t("library.action.compare", this.lng) });
  }

  setLineageItem(): Locator {
    return this.menu().getByRole("menuitem", { name: t("library.action.setLineage", this.lng) });
  }

  /** Row → Actions → "Mark as a new version of…" → dialog open. */
  async openLineage(title: string): Promise<void> {
    await this.ensureActions(title, this.setLineageItem());
    await this.setLineageItem().click();
    await this.lineageDialog.root().waitFor();
  }

  /** Row → Actions → "Compare versions" → /compare/<id>. */
  async openCompare(title: string): Promise<void> {
    await this.ensureActions(title, this.compareItem());
    await this.compareItem().click();
    await this.page.waitForURL(/\/compare\//);
  }

  /**
   * Opens the row's Actions menu unless the caller already has it open showing `item` — the trigger toggles, so a
   * second activation would close the menu the caller just inspected.
   */
  private async ensureActions(title: string, item: Locator): Promise<void> {
    if (!(await item.isVisible())) await this.openActions(title);
  }

  successToast(): Locator {
    return this.page.getByText(t("library.lineage.success", this.lng), { exact: true });
  }
}

// "Version history" — one Select ("Previous version", allowClear) and Save / Cancel.
export class LineageDialog {
  constructor(readonly page: Page) {}

  private get lng(): Lng {
    return uiLanguage(this.page);
  }

  root(): Locator {
    return this.page.getByRole("dialog", { name: t("library.lineage.title", this.lng) });
  }

  description(title: string): Locator {
    return this.root().getByText(t("library.lineage.description", this.lng, { title }), { exact: true });
  }

  select(): Locator {
    return this.root().getByRole("combobox", { name: t("library.lineage.label", this.lng) });
  }

  placeholder(): Locator {
    return this.root().getByText(t("library.lineage.placeholder", this.lng), { exact: true });
  }

  /** The selected value shown in the Select. */
  selected(title: string): Locator {
    return this.root().getByTitle(title, { exact: true });
  }

  /** An option of the open dropdown (portaled outside the dialog; the option is the last element with the title). */
  option(title: string): Locator {
    return this.page.getByTitle(title, { exact: true }).last();
  }

  /** Every element on the page titled `title` (the selected value and/or an open option). */
  titled(title: string): Locator {
    return this.page.getByTitle(title, { exact: true });
  }

  /** Opens the dropdown from the keyboard (focus + ArrowDown). */
  async openOptions(): Promise<void> {
    await this.select().focus();
    await this.page.keyboard.press("ArrowDown");
    // rc-select forwards arrow / Enter keys to the option list only once it is mounted; a key sent earlier is dropped.
    const listId = await this.select().getAttribute("aria-controls");
    await this.page.locator(`[id="${listId}"]`).waitFor({ state: "attached" });
  }

  /**
   * Closes the open dropdown with Escape (rc-select stops the key there, so the dialog stays open). On a phone the
   * portaled option list overlaps the dialog footer, so it has to be closed before Cancel / Save can be clicked.
   */
  async closeOptions(): Promise<void> {
    await this.select().press("Escape");
    await this.root()
      .getByRole("combobox", { name: t("library.lineage.label", this.lng), expanded: false })
      .waitFor();
  }

  async choose(title: string): Promise<void> {
    await this.openOptions();
    await this.option(title).click();
    await this.selected(title).waitFor();
  }

  /**
   * The allowClear "×" of the Select (antd icon, role img "close-circle"); shown on hover. rc-select wraps it in an
   * aria-hidden span, so it is only reachable with includeHidden.
   */
  clearIcon(): Locator {
    return this.root().getByRole("img", { name: "close-circle", includeHidden: true });
  }

  async clear(currentTitle: string): Promise<void> {
    await this.selected(currentTitle).hover();
    await this.clearIcon().click();
    await this.placeholder().waitFor();
  }

  saveButton(): Locator {
    return this.root().getByRole("button", { name: t("library.lineage.confirm", this.lng), exact: true });
  }

  cancelButton(): Locator {
    return this.root().getByRole("button", { name: t("action.cancel", this.lng), exact: true });
  }

  errorAlert(): Locator {
    return this.root().getByRole("alert");
  }
}
