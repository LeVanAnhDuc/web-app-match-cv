import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom has no matchMedia implementation. antd's responsive helpers
// (Grid/Table breakpoints, ConfigProvider dark-mode detection) call it on
// mount, which otherwise throws "window.matchMedia is not a function" and
// crashes the render tree in any test using those components.
// Guarded: this setup file also runs for `@vitest-environment node` test
// files (SSR-safety smoke tests), which have no `window` at all.
if (typeof window !== "undefined") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList;
}

// Reset i18n to default language after each test
afterEach(() => {
  if (typeof window !== "undefined") {
    const w = window as unknown as Record<string, unknown>;
    if ("__i18n" in w) {
      const i18nInstance = w.__i18n as {
        changeLanguage: (lang: string) => Promise<void>;
      };
      void i18nInstance.changeLanguage("en");
    }
  }
});
