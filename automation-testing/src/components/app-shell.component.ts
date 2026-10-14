import type { Locator, Page } from "@playwright/test";
import { t, type CopyKey } from "@/data/copy";
import { uiLanguage } from "./ui-language";

// The layout around every /_app route (client/src/layouts/AppShell/**):
//   desktop (lg ≥ 1024px)  <aside id="app-sidebar"> with logo, collapse toggle, Sidebar nav, UserCard | GuestCard
//   below lg               <header> with "Open menu", app name, AccountMenu (user) | "Sign in" (guest/anonymous);
//                          the menu opens a left Drawer holding the same Sidebar
// Labels resolve in the page's current UI language (BasePage.setLanguage), so the same calls work in en and vi.

/** Sidebar items in display order (Sidebar/index.tsx NAV_ITEMS). Guests and anonymous visitors see home + match only. */
export const NAV_ITEMS = {
  home: { key: "nav.home", path: "/" },
  match: { key: "nav.match", path: "/wizard" },
  savedCvs: { key: "nav.savedCvs", path: "/cv" },
  savedJds: { key: "nav.savedJds", path: "/jd" },
  aiCredentials: { key: "nav.aiCredentials", path: "/ai-credentials" },
  myData: { key: "nav.myData", path: "/my-data" },
} as const satisfies Record<string, { key: CopyKey; path: string }>;

export type NavItem = keyof typeof NAV_ITEMS;

export class AppShell {
  constructor(readonly page: Page) {}

  private text(key: CopyKey, vars?: Record<string, string | number>): string {
    return t(key, uiLanguage(this.page), vars);
  }

  // ── regions ──────────────────────────────────────────────────────────────
  /** Desktop sidebar (hidden below lg). */
  sidebar(): Locator {
    return this.page.locator("#app-sidebar");
  }

  /** Mobile/tablet top bar (hidden from lg up). */
  header(): Locator {
    return this.page.getByRole("banner");
  }

  /** The left drawer opened by "Open menu" (below lg). */
  drawer(): Locator {
    return this.page.getByRole("dialog").filter({ has: this.page.getByRole("navigation") });
  }

  main(): Locator {
    return this.page.getByRole("main");
  }

  /** The sidebar nav that is on screen: the drawer's when it is open, otherwise the desktop sidebar's. */
  private navRoot(): Locator {
    return this.drawer().or(this.sidebar()).filter({ visible: true }).first();
  }

  // ── navigation ───────────────────────────────────────────────────────────
  /** A nav link inside the desktop sidebar (works collapsed too: the icon link carries the label as aria-label). */
  sidebarLink(item: NavItem): Locator {
    return this.sidebar().getByRole("link", { name: this.text(NAV_ITEMS[item].key), exact: true });
  }

  drawerLink(item: NavItem): Locator {
    return this.drawer().getByRole("link", { name: this.text(NAV_ITEMS[item].key), exact: true });
  }

  /** Every nav link of the sidebar on screen, in order. */
  navLinks(): Locator {
    return this.navRoot().getByRole("navigation").getByRole("link");
  }

  /** The nav link marked aria-current="page" in the sidebar on screen. */
  activeNavLink(): Locator {
    return this.navRoot().locator('a[aria-current="page"]');
  }

  collapseButton(): Locator {
    return this.sidebar().getByRole("button", { name: this.text("nav.collapse") });
  }

  expandButton(): Locator {
    return this.sidebar().getByRole("button", { name: this.text("nav.expand") });
  }

  openMenuButton(): Locator {
    return this.header().getByRole("button", { name: this.text("nav.openMenu") });
  }

  drawerCloseButton(): Locator {
    return this.drawer().getByRole("button", { name: /close/i });
  }

  /** True below lg, where the sidebar lives in the drawer. */
  async isCompact(): Promise<boolean> {
    return this.openMenuButton().isVisible();
  }

  async collapseSidebar(): Promise<void> {
    await this.collapseButton().click();
    await this.expandButton().waitFor();
  }

  async expandSidebar(): Promise<void> {
    await this.expandButton().click();
    await this.collapseButton().waitFor();
  }

  /** Open the mobile drawer. Retried: a click that lands before React hydrates the header is a no-op. */
  async openDrawer(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await this.drawer().isVisible()) return;
      await this.openMenuButton().click();
      if (await this.drawer().waitFor({ timeout: 2_000 }).then(() => true, () => false)) return;
    }
    await this.drawer().waitFor();
  }

  async closeDrawer(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.drawer().waitFor({ state: "hidden" });
  }

  /** Go to a section the way a user would on this viewport (sidebar link, or drawer link below lg). */
  async navigate(item: NavItem): Promise<void> {
    if (await this.isCompact()) {
      await this.openDrawer();
      await this.drawerLink(item).click();
    } else {
      await this.sidebarLink(item).click();
    }
    const path = NAV_ITEMS[item].path;
    await this.page.waitForURL((url) => (path === "/" ? url.pathname === "/" : url.pathname.startsWith(path)));
  }

  // ── account (signed-in user) ─────────────────────────────────────────────
  /** Avatar button that opens the account popover (header below lg; collapsed sidebar on desktop). */
  accountButton(): Locator {
    return this.page.getByRole("button", { name: this.text("auth.account") }).first();
  }

  accountMenu(): Locator {
    return this.page.getByRole("dialog", { name: this.text("auth.account") });
  }

  /** "Sign out" on screen: in the expanded desktop UserCard, or inside the open account popover. */
  signOutButton(): Locator {
    return this.accountMenu()
      .getByRole("button", { name: this.text("auth.signOut") })
      .or(this.sidebar().getByRole("button", { name: this.text("auth.signOut") }))
      .first();
  }

  async openAccountMenu(): Promise<void> {
    await this.accountButton().click();
    await this.accountMenu().waitFor();
  }

  /** Sign out from wherever the control is on this viewport/state; waits for POST /auth/logout. */
  async signOut(): Promise<void> {
    const inSidebar = this.sidebar().getByRole("button", { name: this.text("auth.signOut") });
    // The shell renders a skeleton until /auth/me resolves: wait for either signed-in control before choosing one.
    await inSidebar.or(this.accountButton()).first().waitFor();
    if (!(await inSidebar.isVisible())) await this.openAccountMenu();
    const logout = this.page.waitForResponse((r) => r.url().includes("/auth/logout") && r.request().method() === "POST");
    await this.signOutButton().click();
    await logout;
  }

  // ── guest / anonymous ────────────────────────────────────────────────────
  /** "Sign in" link in the mobile header (guest/anonymous, below lg). */
  headerSignInLink(): Locator {
    return this.header().getByRole("link", { name: this.text("auth.signIn"), exact: true });
  }

  /** "Sign in with Ducker ID" in the GuestCard (desktop sidebar or drawer). */
  guestSignInLink(): Locator {
    return this.navRoot().getByRole("link", { name: this.text("auth.signInWithDucker") });
  }

  /** "Guest mode" card in the sidebar on screen (expanded only). */
  guestCard(): Locator {
    // Innermost div holding both the eyebrow and the sign-in link (descendants come last in document order).
    return this.navRoot()
      .locator("div")
      .filter({ has: this.page.getByText(this.text("auth.guest.eyebrow"), { exact: true }) })
      .filter({ has: this.page.getByRole("link", { name: this.text("auth.signInWithDucker") }) })
      .last();
  }

  /** The "<left> / <limit> left" quota line of the GuestCard. */
  guestQuotaText(left: number, limit: number): Locator {
    return this.navRoot().getByText(this.text("auth.quota.left", { left, limit }), { exact: true });
  }
}
