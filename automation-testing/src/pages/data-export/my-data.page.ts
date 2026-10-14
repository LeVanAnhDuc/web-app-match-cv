import type { Download, Locator } from "@playwright/test";
import type { NavItem } from "@/components/app-shell.component";
import { t, type CopyKey } from "@/data/copy";
import { CONTENTS_KEYS } from "@/data/test-data/data-export";
import { BasePage } from "../base.page";

// /my-data (client/src/routes/_app/my-data.tsx):
//   signed-in user      MyDataPanel — h1 title, description, "The archive contains" card (3 items), primary Download
//                       button (loading + disabled + aria-busy while pending), <div aria-live="polite"> holding the
//                       error Alert (role="alert") or the success Alert, privacy note
//   guest / anonymous   RequireAuth → SignInGate variant "route": h2 gate.myData, description, "Sign in with Ducker ID"
//                       (antd Button with href → <a>), "Back to matching" link to /wizard
//   /auth/me pending    RequireAuth skeleton inside <div aria-busy="true">
// Labels resolve in the tab's current UI language (setLanguage).


export class MyDataPage extends BasePage {
  static readonly path = "/my-data";

  private text(key: CopyKey): string {
    return t(key, this.lng);
  }

  async goto(): Promise<void> {
    await this.page.goto(MyDataPage.path);
    await this.waitForAppReady();
  }

  /** Open another route of the app (e.g. "/") to reach this page the way a user would, through the nav. */
  async openFrom(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForAppReady();
  }

  /**
   * The nav link for `item` in the sidebar on this viewport: the desktop sidebar's, or the drawer's below lg (the
   * drawer is opened first). Count 0 = the item is not offered to this visitor.
   */
  async navLink(item: NavItem): Promise<Locator> {
    if (await this.shell.isCompact()) {
      if (!(await this.shell.drawer().isVisible())) await this.shell.openDrawer();
      return this.shell.drawerLink(item);
    }
    return this.shell.sidebarLink(item);
  }

  /** Start waiting for the next browser download (call before the action that triggers it). */
  waitForDownload(): Promise<Download> {
    return this.page.waitForEvent("download");
  }

  // ── signed-in panel ──────────────────────────────────────────────────────
  heading(): Locator {
    return this.page.getByRole("heading", { level: 1, name: this.text("myData.title"), exact: true });
  }

  description(): Locator {
    return this.page.getByText(this.text("myData.description"), { exact: true });
  }

  contentsHeading(): Locator {
    return this.page.getByText(this.text("myData.contents.heading"), { exact: true });
  }

  /** The bullet items of the "The archive contains" card. */
  contentsItems(): Locator {
    return this.shell.main().getByRole("listitem");
  }

  contentsItem(item: keyof typeof CONTENTS_KEYS): Locator {
    return this.contentsItems().filter({ hasText: this.text(CONTENTS_KEYS[item]) });
  }

  privacyNote(): Locator {
    return this.page.getByText(this.text("myData.privacyNote"), { exact: true });
  }

  /** The download button in its idle state ("Download my data"). */
  downloadButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("myData.download") });
  }

  /** The same button while the archive is being prepared ("Preparing your archive…", antd adds a loading icon). */
  busyDownloadButton(): Locator {
    return this.shell.main().getByRole("button", { name: this.text("myData.downloading") });
  }

  /** The download button whatever its state (same <button>, its name changes while pending). */
  anyDownloadButton(): Locator {
    return this.downloadButton().or(this.busyDownloadButton());
  }

  /** <div aria-live="polite"> that announces both outcomes. */
  liveRegion(): Locator {
    return this.shell.main().locator('[aria-live="polite"]');
  }

  /** The error Alert. antd's success Alert also carries role="alert", so the success copy is excluded. */
  errorAlert(): Locator {
    return this.liveRegion()
      .getByRole("alert")
      .filter({ hasNotText: this.text("myData.done") });
  }

  /**
   * Uncaught page errors and console errors from now on (live array), minus dev-build noise that says nothing about
   * this page: antd/React warnings such as the global "[antd: App] When using cssVar…" (decisions/ui-consistency-shell.md),
   * also when the Vite dev server echoes them back prefixed "[Server]". Same list as cv-jd-matching-wizard/happy-path.
   */
  collectErrors(): string[] {
    const benign = [/^Warning:/, /\[antd:/, /React DevTools/];
    const errors: string[] = [];
    this.page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    this.page.on("console", (message) => {
      if (message.type() === "error" && !benign.some((re) => re.test(message.text()))) {
        errors.push(`console: ${message.text()}`);
      }
    });
    return errors;
  }

  successMessage(): Locator {
    return this.liveRegion().getByText(this.text("myData.done"), { exact: true });
  }

  // ── sign-in gate (guest / anonymous) ─────────────────────────────────────
  gateHeading(): Locator {
    return this.page.getByRole("heading", { name: this.text("gate.myData"), exact: true });
  }

  gateDescription(): Locator {
    return this.page.getByText(this.text("gate.description"), { exact: true });
  }

  gateSignInLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("auth.signInWithDucker") });
  }

  gateBackLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("gate.backMatching"), exact: true });
  }

  // ── loading ──────────────────────────────────────────────────────────────
  /** RequireAuth's skeleton while /auth/me is pending. */
  loadingSkeleton(): Locator {
    return this.page.locator('[aria-busy="true"]');
  }

  // ── actions ──────────────────────────────────────────────────────────────
  /** Click "Download my data" and wait for the browser download it starts. */
  async download(): Promise<Download> {
    const download = this.page.waitForEvent("download");
    await this.downloadButton().click();
    return download;
  }

  /** Press `key` (Enter / Space) on the focused element and wait for the download it starts. */
  async downloadWithKey(key: "Enter" | "Space"): Promise<Download> {
    const download = this.page.waitForEvent("download");
    await this.page.keyboard.press(key);
    return download;
  }

  /**
   * Tab from the top of the page until the download button holds focus. Returns false if it never does within
   * `maxTabs` presses (the assertion belongs to the spec).
   */
  async tabToDownloadButton(maxTabs = 40): Promise<boolean> {
    const button = this.downloadButton();
    for (let i = 0; i < maxTabs; i += 1) {
      await this.page.keyboard.press("Tab");
      if (await button.evaluate((el) => el === document.activeElement)) return true;
    }
    return false;
  }

  /** Computed focus styles of the download button (outline + box-shadow), to tell whether focus is visible. */
  async downloadButtonFocusStyle(): Promise<{ outlineStyle: string; outlineWidth: string; boxShadow: string }> {
    return this.downloadButton().evaluate((el) => {
      const style = getComputedStyle(el);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
    });
  }
}
