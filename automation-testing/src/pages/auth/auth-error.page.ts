import type { Locator } from "@playwright/test";
import { t, type CopyKey } from "@/data/copy";
import { BasePage } from "../base.page";

// Where a failed sign-in lands: CLIENT_ORIGIN/?authError=<code> (client/src/components/AuthErrorToast shows one toast
// for the code, then strips the param from the URL).
export class AuthErrorPage extends BasePage {
  /** Open "/?authError=<code>" the way the callback redirect does. */
  async goto(code: string): Promise<void> {
    await this.page.goto(`/?authError=${encodeURIComponent(code)}`);
    await this.waitForAppReady();
  }

  /** The toast carrying the copy of `key`. */
  toast(key: CopyKey): Locator {
    return this.page.getByText(t(key, this.lng), { exact: true });
  }

  /** Every on-screen text that is one of the auth.error.* toasts (to count them). */
  anyAuthErrorToast(keys: readonly CopyKey[]): Locator {
    const [first, ...rest] = keys.map((key) => this.toast(key));
    return rest.reduce((acc, loc) => acc.or(loc), first);
  }

  /** Wait until the client has removed ?authError from the address bar. */
  async waitForParamCleared(): Promise<void> {
    await this.page.waitForURL((url) => !url.searchParams.has("authError"));
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForAppReady();
  }
}
