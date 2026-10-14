import type { Locator, Page } from "@playwright/test";
import { t, type CopyKey } from "@/data/copy";
import { BasePage } from "../base.page";

// Home "/" (client/src/views/Home/**). Three shapes on one route:
//   loading     <div data-testid="home-loading"> while GET /auth/me is in flight
//   guest/anon  HeroCta (guest copy) + AccountPerks
//   user        HeroCta + StatCards (4 tiles) + RecentMatches (antd Table; each row is role="button",
//               aria-label "<cvTitle> × <jdTitle>", score cell data-testid "home-score-<id>")
// Labels resolve in the tab's current UI language (setLanguage), so the same locators work in en and vi.

export type StatTileName = "savedCvs" | "savedJds" | "totalMatches" | "highest";

const STAT_TILES: Record<StatTileName, { testId: string; label: CopyKey }> = {
  savedCvs: { testId: "home-stat-saved-cvs", label: "home.stat.savedCvs" },
  savedJds: { testId: "home-stat-saved-jds", label: "home.stat.savedJds" },
  totalMatches: { testId: "home-stat-total-matches", label: "home.stat.totalMatches" },
  highest: { testId: "home-stat-highest", label: "home.stat.highest" },
};

export const STAT_TILE_NAMES = Object.keys(STAT_TILES) as StatTileName[];

export class HomeDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private text(key: CopyKey, vars?: Record<string, string | number>): string {
    return t(key, this.lng, vars);
  }

  private main(): Locator {
    return this.shell.main();
  }

  /** Open "/" and wait for hydration. Does not wait for the auth state: see waitForGuestHero / waitForDashboard. */
  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.waitForAppReady();
  }

  async waitForDashboard(): Promise<void> {
    await this.heroTitle().waitFor();
  }

  async waitForGuestHero(): Promise<void> {
    await this.guestTitle().waitFor();
  }

  // ── loading ──────────────────────────────────────────────────────────────
  loading(): Locator {
    return this.page.getByTestId("home-loading");
  }

  // ── guest / anonymous ────────────────────────────────────────────────────
  guestEyebrow(): Locator {
    return this.main().getByText(this.text("home.guest.eyebrow"), { exact: true });
  }

  guestTitle(): Locator {
    return this.main().getByRole("heading", { level: 1, name: this.text("home.guest.title") });
  }

  guestSubtitle(): Locator {
    return this.main().getByText(this.text("home.guest.subtitle"), { exact: true });
  }

  guestStartLink(): Locator {
    return this.main().getByRole("link", { name: this.text("home.guest.cta"), exact: true });
  }

  /** The hero's "Sign in" (the mobile header has its own "Sign in" link outside <main>). */
  guestSignInLink(): Locator {
    return this.main().getByRole("link", { name: this.text("home.guest.signIn"), exact: true });
  }

  guestNote(limit: number): Locator {
    return this.main().getByText(this.text("home.guest.note", { limit }), { exact: true });
  }

  perksEyebrow(): Locator {
    return this.main().getByText(this.text("home.perks.eyebrow"), { exact: true });
  }

  perksTitle(): Locator {
    return this.main().getByRole("heading", { name: this.text("home.perks.title") });
  }

  perk(key: "documents" | "history" | "rewrite" | "keys"): Locator {
    return this.main()
      .getByRole("listitem")
      .filter({ hasText: this.text(`home.perks.${key}.title`) })
      .filter({ hasText: this.text(`home.perks.${key}.meta`) });
  }

  // ── hero (signed in) ─────────────────────────────────────────────────────
  heroTitle(): Locator {
    return this.main().getByRole("heading", { level: 1, name: this.text("home.hero.title") });
  }

  heroSubtitle(): Locator {
    return this.main().getByText(this.text("home.hero.subtitle"), { exact: true });
  }

  heroCta(): Locator {
    return this.main().getByRole("link", { name: this.text("home.hero.cta") });
  }

  async startMatching(): Promise<void> {
    await this.heroCta().click();
    await this.page.waitForURL("**/wizard");
  }

  // ── stat tiles ───────────────────────────────────────────────────────────
  statTile(name: StatTileName): Locator {
    return this.page.getByTestId(STAT_TILES[name].testId);
  }

  statLabel(name: StatTileName): Locator {
    return this.statTile(name).getByText(this.text(STAT_TILES[name].label), { exact: true });
  }

  /** The tile's figure, e.g. "2" (counts) or "—" (no score yet). */
  statFigure(name: StatTileName, figure: string | number): Locator {
    return this.statTile(name).getByText(String(figure), { exact: true });
  }

  /** The 0–100 meter of the Highest tile (aria-valuenow = the score). */
  highestMeter(): Locator {
    return this.statTile("highest").getByRole("meter");
  }

  averageLine(value: number): Locator {
    return this.statTile("highest").getByText(this.text("home.stat.avg", { value }), { exact: true });
  }

  /** Any "avg …" line in the Highest tile (to prove there is none). */
  anyAverageLine(): Locator {
    const prefix = this.text("home.stat.avg", { value: 0 }).split("0")[0];
    return this.statTile("highest").getByText(prefix, { exact: false });
  }

  /** How many stat tiles share the first tile's row (the grid's column count at this viewport). */
  async statTilesInFirstRow(): Promise<number> {
    const tops: number[] = [];
    for (const name of STAT_TILE_NAMES) {
      const box = await this.statTile(name).boundingBox();
      if (!box) throw new Error(`stat tile ${name} is not rendered`);
      tops.push(Math.round(box.y));
    }
    return tops.filter((top) => Math.abs(top - tops[0]) <= 2).length;
  }

  /** Skeleton bars shown while the tile's query loads (antd Skeleton paragraph = <ul><li>). */
  statSkeletonLines(name: StatTileName): Locator {
    return this.statTile(name).getByRole("listitem");
  }

  // ── recent matches ───────────────────────────────────────────────────────
  recentTitle(): Locator {
    return this.main().getByRole("heading", { name: this.text("home.recent.title") });
  }

  recentTable(): Locator {
    return this.main().getByRole("table");
  }

  columnHeader(col: "cv" | "jd" | "score" | "date"): Locator {
    return this.recentTable().getByRole("columnheader", { name: this.text(`home.cols.${col}`), exact: true });
  }

  /** Every result row (rows are role="button" named "<cv> × <jd>"), in display order. */
  recentRows(): Locator {
    return this.recentTable().getByRole("button", { name: / × / });
  }

  recentRow(cvTitle: string, jdTitle: string): Locator {
    return this.recentTable().getByRole("button", { name: `${cvTitle} × ${jdTitle}`, exact: true });
  }

  scoreCell(matchId: string): Locator {
    return this.page.getByTestId(`home-score-${matchId}`);
  }

  viewAll(): Locator {
    return this.main().getByText(this.text("home.recent.viewAll"), { exact: true });
  }

  /** "View all" exposed as something clickable (link or button) — must not exist while there is no /history page. */
  viewAllControl(): Locator {
    const name = this.text("home.recent.viewAll");
    return this.main().getByRole("link", { name }).or(this.main().getByRole("button", { name }));
  }

  emptyText(): Locator {
    return this.main().getByText(this.text("home.recent.empty"), { exact: true });
  }

  emptyCta(): Locator {
    return this.main().getByRole("button", { name: this.text("home.recent.emptyCta") });
  }

  /** An error state anywhere on the dashboard (REQ-HOMEDASHBOARDLIBRARY-20). */
  errorAlert(): Locator {
    return this.main().getByRole("alert").first();
  }

  async matchNowFromEmptyState(): Promise<void> {
    await this.emptyCta().click();
    await this.page.waitForURL("**/wizard");
  }

  /** Click a result row; returns the report view of the wizard it opens. */
  async openResult(cvTitle: string, jdTitle: string): Promise<MatchReportView> {
    await this.recentRow(cvTitle, jdTitle).click();
    await this.page.waitForURL("**/wizard");
    return new MatchReportView(this.page);
  }

  /** Focus a result row and press a key on it ("Enter" or " "); returns the report view it opens. */
  async openResultWithKey(cvTitle: string, jdTitle: string, key: "Enter" | " "): Promise<MatchReportView> {
    const row = this.recentRow(cvTitle, jdTitle);
    await row.focus();
    await row.press(key === " " ? "Space" : key);
    await this.page.waitForURL("**/wizard");
    return new MatchReportView(this.page);
  }

  /** Width the document scrolls to vs the viewport width (horizontal overflow check). */
  async horizontalOverflow(): Promise<{ scrollWidth: number; viewportWidth: number }> {
    return this.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
  }

  /** Tag the current document; `documentIsTagged()` is false after any full page load (client-side nav keeps it). */
  async tagDocument(): Promise<void> {
    await this.page.evaluate(() => {
      (window as Window & { __hdlTag?: boolean }).__hdlTag = true;
    });
  }

  async documentIsTagged(): Promise<boolean> {
    return this.page.evaluate(() => (window as Window & { __hdlTag?: boolean }).__hdlTag === true);
  }

  /** Every text node of <main>, for "no raw i18n key" checks. */
  async mainText(): Promise<string> {
    return this.main().innerText();
  }
}

/** The wizard's step-4 report as reached from a home row (only what this module asserts: whose report it is). */
export class MatchReportView {
  constructor(readonly page: Page) {}

  /** A report line (strength / gap / suggestion) of the stored result. */
  reportLine(text: string): Locator {
    return this.page.getByRole("main").getByText(text, { exact: true });
  }
}
