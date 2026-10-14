import type { Page, Response } from "@playwright/test";
import { BasePage } from "../base.page";

// The web client's root URL ("/", CLIENT_ORIGIN) as the infra module sees it: does the site answer, does the bundle
// hydrate, and can the browser call the API with credentials from this origin (CORS). Sidebar / account UI: `shell`.
export class WebRootPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** Response of the API call the shell makes on load to learn who the session cookie is (GET /api/v1/auth/me). */
  waitForAuthMe(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => new URL(r.url()).pathname.endsWith("/api/v1/auth/me") && r.request().method() === "GET"
    );
  }

  /** Marker of a signed-in shell: "Sign out" in the expanded sidebar, or the account avatar when it is collapsed. */
  signedInMarker() {
    return this.shell.signOutButton().or(this.shell.accountButton()).first();
  }

  /**
   * Starts recording every response with status >= 500 on this tab (document, assets, API). Call before `goto()`;
   * read the returned array after the page has settled.
   */
  recordServerErrors(): string[] {
    const failures: string[] = [];
    this.page.on("response", (r) => {
      if (r.status() >= 500) failures.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    });
    return failures;
  }

  /** Waits until the network is idle (every request the first render fired has answered). */
  async waitForSettled(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Opens "/" and waits for the app to hydrate. Returns the document response (null only for same-document
   * navigations, which "/" from about:blank never is).
   */
  async goto(): Promise<Response | null> {
    const res = await this.page.goto("/");
    await this.waitForAppReady();
    return res;
  }
}
