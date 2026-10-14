import type { Locator, Page } from "@playwright/test";
import { SignInGate } from "@/components/guest-mode/sign-in-gate.component";
import { t, type CopyKey, type Vars } from "@/data/copy";
import { BasePage } from "../base.page";

// Home "/" as an anonymous visitor or a guest (client/src/views/Home, !isUser branch):
//   HeroCta (guest)  eyebrow · <h1> home.guest.title · subtitle · "Start matching →" (/wizard) · "Sign in" · footer note
//                    with {{limit}} = guestQuota.limit from GET /auth/me
//   AccountPerks     eyebrow · <h2> home.perks.title · <ul> of 4 perks (documents, history, rewrite, keys)
// A signed-in user gets StatCards + RecentMatches instead; neither may render for a guest.

export const PERKS = ["documents", "history", "rewrite", "keys"] as const;
export type Perk = (typeof PERKS)[number];

export class GuestHomePage extends BasePage {
  /** The sign-in gate a user-only route shows a guest (opened with `open(path)`). */
  readonly gate: SignInGate;
  /** The four perks of the "Everything stays in one place" card, in display order. */
  readonly perks = PERKS;

  constructor(page: Page) {
    super(page);
    this.gate = new SignInGate(page);
  }

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, this.lng, vars);
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.waitForAppReady();
  }

  /** Open any app path as this visitor (e.g. a user-only route such as /cv) and wait for hydration. */
  async open(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForAppReady();
  }

  /** Open "/" and wait until the guest hero has rendered (GET /auth/me answered). */
  async gotoLoaded(): Promise<void> {
    await this.goto();
    await this.heroTitle().waitFor();
  }

  // ── hero ────────────────────────────────────────────────────────────────
  heroTitle(): Locator {
    return this.shell.main().getByRole("heading", { level: 1, name: this.text("home.guest.title") });
  }

  heroEyebrow(): Locator {
    return this.shell.main().getByText(this.text("home.guest.eyebrow"), { exact: true });
  }

  startMatchingLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("home.guest.cta"), exact: true });
  }

  heroSignInLink(): Locator {
    return this.shell.main().getByRole("link", { name: this.text("home.guest.signIn"), exact: true });
  }

  /** The "No account needed: {{limit}} matches a day…" note with the given limit. */
  guestNote(limit: number): Locator {
    return this.shell.main().getByText(this.text("home.guest.note", { limit }), { exact: true });
  }

  // ── perks ───────────────────────────────────────────────────────────────
  perksTitle(): Locator {
    return this.shell.main().getByRole("heading", { level: 2, name: this.text("home.perks.title") });
  }

  perkItems(): Locator {
    return this.shell.main().getByRole("list").filter({ hasText: this.text("home.perks.documents.title") }).getByRole("listitem");
  }

  perkTitle(perk: Perk): Locator {
    return this.shell.main().getByText(this.text(`home.perks.${perk}.title`), { exact: true });
  }

  // ── signed-in-only parts (must be absent) ───────────────────────────────
  statCard(): Locator {
    return this.shell.main().getByText(this.text("home.stat.totalMatches"), { exact: true });
  }

  recentMatchesHeading(): Locator {
    return this.shell.main().getByText(this.text("home.recent.title"), { exact: true });
  }

  // ── sign-in failure (/?authError=<code>) ─────────────────────────────────
  /** antd message toast raised by AuthErrorToast for `/?authError=<code>`. */
  authErrorToast(code: "denied" | "state" | "iss" | "exchange" | "token" | "server"): Locator {
    return this.page.getByText(this.text(`auth.error.${code}`), { exact: true });
  }

  /** Open `/?authError=<code>`, the landing of a failed OAuth callback. */
  async gotoAuthError(code: string): Promise<void> {
    await this.page.goto(`/?authError=${encodeURIComponent(code)}`);
    await this.waitForAppReady();
  }

  async startMatching(): Promise<void> {
    await this.startMatchingLink().click();
    await this.page.waitForURL((url) => url.pathname === "/wizard");
  }
}
