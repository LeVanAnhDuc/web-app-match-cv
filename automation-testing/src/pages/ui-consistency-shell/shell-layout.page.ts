import type { Locator, Page, Response } from "@playwright/test";
import { NAV_ITEMS, type NavItem } from "@/components/app-shell.component";
import { t, type CopyKey } from "@/data/copy";
import { SIDEBAR_STORAGE_KEY } from "@/data/test-data/ui-consistency-shell";
import { BasePage } from "@/pages/base.page";

// The frame around every /_app route (client/src/layouts/AppShell/**, components/PageContainer, components/SectionCard),
// probed the way module ui-consistency-shell needs: sidebar geometry, persisted state, layout primitives. The sidebar /
// header / drawer locators themselves live in AppShell (`this.shell`); this page adds measurements on top of them.

export interface BoxStyle {
  maxWidth: string;
  paddingLeft: string;
  paddingRight: string;
}

export interface CardStyle {
  radius: string;
  borderWidth: string;
  background: string;
}

export interface TextStyle {
  fontSize: string;
  fontWeight: number;
  textTransform: string;
}

export class ShellLayoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private text(key: CopyKey, vars?: Record<string, string | number>): string {
    return t(key, this.lng, vars);
  }

  /** Open a /_app route and wait for hydration. Returns the document response (its body is the server-rendered HTML). */
  async goto(path = "/"): Promise<Response | null> {
    const response = await this.page.goto(path);
    await this.waitForAppReady();
    return response;
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForAppReady();
  }

  /** True when the viewport is below lg (header + drawer instead of the desktop sidebar). */
  isCompactViewport(): boolean {
    return (this.page.viewportSize()?.width ?? 0) < 1024;
  }

  async resize(width: number, height = 900): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  /** Make the nav list visible on any viewport: opens the drawer below lg (no-op on desktop or when already open). */
  async showNav(): Promise<void> {
    if (!this.isCompactViewport()) return;
    if (await this.shell.drawer().isVisible()) return;
    await this.shell.openDrawer();
  }

  // ── nav ──────────────────────────────────────────────────────────────────
  /** Accessible names of the nav links on screen, in order (works on the rail too: icon links carry aria-label). */
  async navLabels(): Promise<string[]> {
    const links = this.shell.navLinks();
    await links.first().waitFor();
    return links.evaluateAll((els) => els.map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim()));
  }

  navLabel(item: NavItem): string {
    return this.text(NAV_ITEMS[item].key);
  }

  /** The nav link of `item` in the sidebar on screen (drawer below lg). */
  navLink(item: NavItem): Locator {
    return this.shell.navLinks().and(this.page.getByRole("link", { name: this.navLabel(item), exact: true }));
  }

  /** Tooltip shown next to a hovered rail link. */
  tooltip(): Locator {
    return this.page.getByRole("tooltip").filter({ visible: true });
  }

  // ── sidebar toggle ───────────────────────────────────────────────────────
  /** The collapse/expand toggle whatever its current state. */
  sidebarToggle(): Locator {
    return this.shell.collapseButton().or(this.shell.expandButton());
  }

  async sidebarWidth(): Promise<number> {
    return this.shell.sidebar().evaluate((el) => Math.round(el.getBoundingClientRect().width));
  }

  async mainWidth(): Promise<number> {
    return this.shell.main().evaluate((el) => Math.round(el.getBoundingClientRect().width));
  }

  /** Computed transition-duration of the sidebar's width animation, in seconds. */
  async sidebarTransitionSeconds(): Promise<number> {
    return this.shell.sidebar().evaluate((el) => {
      const first = getComputedStyle(el).transitionDuration.split(",")[0].trim();
      return first.endsWith("ms") ? parseFloat(first) / 1000 : parseFloat(first);
    });
  }

  /** Wait until the sidebar has finished resizing to `width` px (the width animates). */
  async waitForSidebarWidth(width: number): Promise<void> {
    await this.page.waitForFunction(
      (target) => Math.round(document.getElementById("app-sidebar")?.getBoundingClientRect().width ?? -1) === target,
      width
    );
  }

  async storedSidebarState(): Promise<string | null> {
    return this.page.evaluate((key) => window.localStorage.getItem(key), SIDEBAR_STORAGE_KEY);
  }

  /** Write (or remove, with null) the persisted sidebar value on the current origin. Reload to apply it. */
  async setStoredSidebarState(value: string | null): Promise<void> {
    await this.page.evaluate(
      ([key, v]) => (v === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, v)),
      [SIDEBAR_STORAGE_KEY, value] as const
    );
  }

  /** Make every localStorage read/write throw (private mode / blocked storage), from the next navigation on. */
  async blockStorage(): Promise<void> {
    await this.page.addInitScript(() => {
      const deny = () => {
        throw new DOMException("Storage is disabled", "SecurityError");
      };
      Storage.prototype.getItem = deny;
      Storage.prototype.setItem = deny;
      Storage.prototype.removeItem = deny;
    });
  }

  /** Uncaught page errors and console errors from now on (live array). */
  collectErrors(): string[] {
    const errors: string[] = [];
    this.page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    this.page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    return errors;
  }

  // ── account block ────────────────────────────────────────────────────────
  /** A line of text inside the desktop sidebar's account block (name, email). */
  sidebarText(text: string): Locator {
    return this.shell.sidebar().getByText(text, { exact: true });
  }

  /** "Sign in with Ducker ID" icon link of the collapsed rail (guest/anonymous). */
  railSignInLink(): Locator {
    return this.shell.sidebar().getByRole("link", { name: this.text("auth.signInWithDucker"), exact: true });
  }

  /** The app name in the mobile header. */
  headerAppName(): Locator {
    return this.shell.header().getByText(this.text("appName"), { exact: true });
  }

  /** The drawer by its accessible name (= appName). */
  namedDrawer(): Locator {
    return this.page.getByRole("dialog", { name: this.text("appName") });
  }

  /** Close the drawer by clicking the dimmed backdrop to its right. */
  async clickDrawerBackdrop(): Promise<void> {
    const size = this.page.viewportSize() ?? { width: 390, height: 844 };
    await this.page.mouse.click(size.width - 10, Math.round(size.height / 2));
  }

  // ── layout primitives ────────────────────────────────────────────────────
  /** The PageContainer: first element child of <main>. */
  pageContainer(): Locator {
    // Home renders a bare placeholder div while GET /auth/me is pending; skip it.
    return this.shell.main().locator(':scope > div:not([data-testid="home-loading"])').first();
  }

  async pageContainerStyle(): Promise<BoxStyle> {
    return this.pageContainer().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { maxWidth: cs.maxWidth, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight };
    });
  }

  /** Horizontal overflow of the document in px (0 = no horizontal scroll). */
  async horizontalOverflow(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }

  pageHeading(): Locator {
    return this.shell.main().getByRole("heading", { level: 1 });
  }

  sectionHeadings(): Locator {
    return this.shell.main().getByRole("heading", { level: 2 });
  }

  /** Eyebrow line of a SectionCard, by its text. */
  eyebrow(key: CopyKey): Locator {
    return this.shell.main().getByText(this.text(key), { exact: true });
  }

  async textStyle(locator: Locator): Promise<TextStyle> {
    return locator.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fontSize: cs.fontSize, fontWeight: Number(cs.fontWeight), textTransform: cs.textTransform };
    });
  }

  /** Shape of the SectionCard around `heading`: the nearest ancestor drawn as a card (rounded + bordered). */
  async cardStyleAround(heading: Locator): Promise<CardStyle> {
    return heading.evaluate((el) => {
      let node: HTMLElement | null = el.parentElement;
      while (node && node.tagName !== "MAIN") {
        const cs = getComputedStyle(node);
        if (parseFloat(cs.borderTopLeftRadius) > 0 && parseFloat(cs.borderTopWidth) > 0) {
          return { radius: cs.borderTopLeftRadius, borderWidth: cs.borderTopWidth, background: cs.backgroundColor };
        }
        node = node.parentElement;
      }
      return { radius: "0px", borderWidth: "0px", background: "" };
    });
  }

  async emulateColorScheme(scheme: "light" | "dark"): Promise<void> {
    await this.page.emulateMedia({ colorScheme: scheme });
  }

  // ── library states (inside the layout) ───────────────────────────────────
  libraryEmptyText(kind: "cv" | "jd"): string {
    return this.text(kind === "cv" ? "library.empty.cv" : "library.empty.jd");
  }

  libraryEmpty(kind: "cv" | "jd"): Locator {
    return this.shell.main().getByText(this.libraryEmptyText(kind), { exact: true });
  }

  libraryLoadError(): Locator {
    return this.shell.main().getByRole("alert").filter({ hasText: this.text("library.loadError") });
  }

  /** Every visible text of the shell chrome (sidebar or header, plus the drawer when open). */
  async shellText(): Promise<string> {
    const parts = await this.shell
      .sidebar()
      .or(this.shell.header())
      .or(this.shell.drawer())
      .filter({ visible: true })
      .allInnerTexts();
    return parts.join("\n");
  }
}
