import type { Page } from "@playwright/test";
import type { Lng } from "@/data/copy";

// The language a page's UI is currently rendered in, as far as the suite set it (BasePage.setLanguage). Kept per
// Page so every page object and component on that tab resolves its labels in the same language without being told.
const languages = new WeakMap<Page, Lng>();
const watched = new WeakSet<Page>();

export function uiLanguage(page: Page): Lng {
  return languages.get(page) ?? "en";
}

export function rememberUiLanguage(page: Page, lng: Lng): void {
  languages.set(page, lng);
  // The app does not persist the language: every full document load (goto, reload) boots in en again, so the
  // remembered language must follow it — otherwise the next page object waits for labels in a language the page
  // is no longer in. Client-side navigation keeps the i18n instance, and fires no "load", so it keeps the language.
  if (!watched.has(page)) {
    watched.add(page);
    page.on("load", () => languages.delete(page));
  }
}
