import type { Response } from "@playwright/test";
import type { AuthMeDto } from "#/types/Auth";
import { BasePage } from "../base.page";

// Any /_app route seen for what the shell shows about the session (sign-in entry points, nav, account, sign-out).
// The shell itself is BasePage.shell (AppShell); this page only adds a way to open a route and read the GET /auth/me
// answer the client got for it.
export class AccountShellPage extends BasePage {
  /** Open a route (relative path) and wait for the app shell. */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForAppReady();
  }

  /** Open a route and return the client's own GET /auth/me response (sent with credentials: "include"). */
  async gotoAndReadMe(path: string): Promise<{ response: Response; body: AuthMeDto }> {
    const me = this.page.waitForResponse(
      (r) => r.url().endsWith("/auth/me") && r.request().method() === "GET" && r.status() === 200
    );
    await this.goto(path);
    const response = await me;
    return { response, body: (await response.json()) as AuthMeDto };
  }
}
