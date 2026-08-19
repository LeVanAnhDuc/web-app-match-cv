import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the real locale JSON at runtime (rather than `import … with { type:
// "json" }`) — Playwright's ESM loader for `*.e2e.ts` does not accept JSON
// import attributes, and this keeps the assertions tied to the actual copy
// deck so a wording change fails loudly instead of the suite silently
// drifting from the app.
function loadTranslation(locale: "en" | "vi"): {
  myData: {
    title: string;
    description: string;
    contents: { documents: string; matches: string; credentials: string };
    download: string;
  };
} {
  const filePath = path.join(
    dirname,
    "..",
    "..",
    "src",
    "locales",
    locale,
    "translation.json"
  );
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

const en = loadTranslation("en");
const vi = loadTranslation("vi");

// Gate A of the §4.3 dual-gate for `data-export`
// (docs/specs/data-export/e2e.md). Covers matrix rows 1, 8, 9, 10, 11, 12 —
// the rows reachable/meaningful at the browser level. Rows 13 (credential
// leak) and 14 (byte-for-byte integrity) are proven at the BE e2e level
// against the real zip bytes, stricter than anything reachable through a
// browser — deliberately not duplicated here. The page needs no seeded data
// (it lists what an export *would* contain, not a live count), so this file
// relies on the same DB reset `global-setup.ts` already does and seeds
// nothing of its own.

const DOWNLOAD_FILENAME_RE = /^export-\d{4}-\d{2}-\d{2}\.zip$/;

/** Wait for TanStack Start hydration (dev-only window.__i18n hook). */
async function waitHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => "__i18n" in window, undefined, {
    timeout: 15_000
  });
}

/**
 * Drives the locale the app actually supports: a dev-only `window.__i18n`
 * hook wired in `src/i18n/config.ts` because no language switcher UI exists
 * yet (see `home-dashboard-library/library.e2e.ts` for the same mechanism).
 */
async function switchLanguage(page: Page, lang: "en" | "vi"): Promise<void> {
  await page.evaluate(async (l) => {
    await (
      window as unknown as {
        __i18n: { changeLanguage: (lang: string) => Promise<unknown> };
      }
    ).__i18n.changeLanguage(l);
  }, lang);
}

function downloadButton(page: Page) {
  return page.getByRole("button", { name: en.myData.download });
}

test.describe("my data export", () => {
  test("[happy] clicking download triggers a real browser download named export-<date>.zip", async ({
    page
  }) => {
    await page.goto("/my-data");
    await waitHydrated(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton(page).click()
    ]);

    expect(download.suggestedFilename()).toMatch(DOWNLOAD_FILENAME_RE);
  });

  test("[data-render] lists all three archive-contents items", async ({
    page
  }) => {
    await page.goto("/my-data");
    await waitHydrated(page);

    await expect(page.getByText(en.myData.contents.documents)).toBeVisible();
    await expect(page.getByText(en.myData.contents.matches)).toBeVisible();
    await expect(page.getByText(en.myData.contents.credentials)).toBeVisible();
  });

  test("[i18n] renders correctly in both English and Vietnamese", async ({
    page
  }) => {
    await page.goto("/my-data");
    await waitHydrated(page);

    await expect(
      page.getByRole("heading", { name: en.myData.title })
    ).toBeVisible();
    await expect(page.getByText(en.myData.description)).toBeVisible();
    await expect(
      page.getByRole("button", { name: en.myData.download })
    ).toBeVisible();

    await switchLanguage(page, "vi");

    await expect(
      page.getByRole("heading", { name: vi.myData.title })
    ).toBeVisible();
    await expect(page.getByText(vi.myData.description)).toBeVisible();
    await expect(
      page.getByRole("button", { name: vi.myData.download })
    ).toBeVisible();
  });

  test("[error][loading] a 500 shows role=alert and re-enables the button", async ({
    page
  }) => {
    await page.goto("/my-data");
    await waitHydrated(page);

    await page.route("**/me/export", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "boom" })
      })
    );

    const button = downloadButton(page);
    await button.click();

    await expect(page.getByRole("alert")).toBeVisible();
    // The specific defect this guards: a button stuck in `loading` forever
    // because the error path forgot to reset status.
    await expect(button).toBeEnabled();
  });

  test("[mutation-safety] two rapid clicks issue exactly one request", async ({
    page
  }) => {
    await page.goto("/my-data");
    await waitHydrated(page);

    let requestCount = 0;
    // Slow the response down so the assertion window is wide enough to prove
    // the second click lands while the first request is verifiably still in
    // flight. The real local backend answers fast enough that two
    // round-tripped Playwright actions could otherwise land after the first
    // request already completed, which would prove nothing about the
    // double-click guard.
    await page.route("**/me/export", async (route) => {
      requestCount++;
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ response });
    });

    // Resolve to the underlying DOM node once. The button's accessible name
    // changes to the "downloading…" label while the request is in flight, so
    // re-querying by role+name (as the `downloadButton` locator does) would
    // stall waiting for a button that currently has a different name — an
    // ElementHandle keeps pointing at the same <button> regardless of its
    // text.
    const buttonHandle = await downloadButton(page).elementHandle();
    if (!buttonHandle) throw new Error("download button not found");
    await buttonHandle.click();
    expect(
      await buttonHandle.evaluate((el) => (el as HTMLButtonElement).disabled)
    ).toBe(true);
    // The second click lands while the first is still in flight. `force:
    // true` skips Playwright's own "wait until enabled" actionability check
    // and issues a real trusted click straight away — but the browser itself
    // never fires a click event on a disabled `<button>`, so this is a no-op
    // unless the first click's guard is broken.
    await buttonHandle.click({ force: true });

    await page.waitForEvent("download");
    expect(requestCount).toBe(1);
  });

  test("[a11y] button is reachable by Tab, activates with Enter, has an accessible name", async ({
    page
  }) => {
    await page.goto("/my-data");
    await waitHydrated(page);

    const button = downloadButton(page);
    await expect(button).toBeVisible();

    let focused = false;
    for (let i = 0; i < 25 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await button.evaluate((el) => el === document.activeElement);
    }
    expect(focused).toBe(true);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.keyboard.press("Enter")
    ]);
    expect(download.suggestedFilename()).toMatch(DOWNLOAD_FILENAME_RE);
  });
});
