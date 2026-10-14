import type { Locator } from "@playwright/test";
import { t, type CopyKey } from "@/data/copy";
import { BasePage } from "../base.page";

// The "sign in to open this page" screen RequireAuth renders on the six account routes for a guest or an anonymous
// visitor (client/src/components/RequireAuth + SignInGate, variant "route"), plus the skeleton it shows while
// GET /auth/me is still pending.
export class SignInGatePage extends BasePage {
  /** Open a gated route (relative path, e.g. "/cv") and wait for the app shell. */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForAppReady();
  }

  /** The gate's own region: the card inside <main>. */
  private root(): Locator {
    return this.shell.main();
  }

  heading(titleKey: CopyKey): Locator {
    return this.root().getByRole("heading", { name: t(titleKey, this.lng), exact: true });
  }

  description(): Locator {
    return this.root().getByText(t("gate.description", this.lng), { exact: true });
  }

  /** "Sign in with Ducker ID" — a link to <API>/auth/login?returnTo=… */
  signInButton(): Locator {
    return this.root().getByRole("link", { name: t("auth.signInWithDucker", this.lng), exact: true });
  }

  backToMatchingLink(): Locator {
    return this.root().getByRole("link", { name: t("gate.backMatching", this.lng), exact: true });
  }

  /** RequireAuth's loading placeholder (aria-busy) while /auth/me has not answered. */
  skeleton(): Locator {
    return this.root().locator('[aria-busy="true"]');
  }

  async backToMatching(): Promise<void> {
    await this.backToMatchingLink().click();
    await this.page.waitForURL((url) => url.pathname === "/wizard");
  }

  /**
   * Follow "Sign in with Ducker ID" (a full-page navigation through the API and the IdP): waits for the API's
   * /auth/callback answer, then for the app to be ready again on wherever it redirected.
   */
  async signIn(): Promise<void> {
    const callback = this.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/auth/callback"), {
      timeout: 30_000,
    });
    // The whole login → authorize → callback → web chain is ONE navigation: the main frame commits only the final
    // document, so wait for that commit rather than the URL (which still reads the old page until then).
    const landed = this.page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === this.page.mainFrame() && !new URL(frame.url()).pathname.startsWith("/api/"),
      timeout: 30_000,
    });
    await this.signInButton().click();
    await callback;
    await landed;
    await this.waitForAppReady();
  }
}
