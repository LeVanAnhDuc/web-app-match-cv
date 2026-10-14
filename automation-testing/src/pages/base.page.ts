import type { Page } from "@playwright/test";
import { AppShell } from "@/components/app-shell.component";
import { rememberUiLanguage, uiLanguage } from "@/components/ui-language";
import type { Lng } from "@/data/copy";

type I18nWindow = Window & { __i18n?: { language: string; changeLanguage(lng: string): Promise<unknown> } };

// Shared parts of every screen. Relative URLs resolve against the project's baseURL (the web host).
export abstract class BasePage {
  /** Sidebar / header / drawer / account menu around every /_app route. */
  readonly shell: AppShell;

  constructor(readonly page: Page) {
    this.shell = new AppShell(page);
  }

  /** The UI language this tab was last switched to (en until setLanguage is called). */
  get lng(): Lng {
    return uiLanguage(this.page);
  }

  /**
   * Hydrated and interactive. `window.__i18n` is attached by the client bundle (client/src/i18n/config.ts, dev builds
   * only), so its presence means React has run; then the shell's <main> must be on screen. Call after `page.goto`.
   */
  async waitForAppReady(): Promise<void> {
    await this.page.waitForFunction(() => "__i18n" in window, undefined, { timeout: 30_000 });
    await this.page.getByRole("main").first().waitFor();
  }

  /**
   * Switch the UI language through the dev hook `window.__i18n` (there is no language switcher in the app — D4).
   * Waits for the hook, changes the language, and records it so page objects/components resolve labels in `lng`.
   * The choice is not persisted: a reload or new navigation goes back to en, so call it after `goto()`.
   */
  async setLanguage(lng: Lng): Promise<void> {
    await this.page.waitForFunction(() => "__i18n" in window, undefined, { timeout: 30_000 });
    await this.page.evaluate(async (target) => {
      await (window as I18nWindow).__i18n!.changeLanguage(target);
    }, lng);
    await this.page.waitForFunction((target) => (window as I18nWindow).__i18n?.language === target, lng);
    rememberUiLanguage(this.page, lng);
  }
}
