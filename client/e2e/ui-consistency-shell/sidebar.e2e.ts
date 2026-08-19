import { expect, test, type Page } from "@playwright/test";

// Gate A of the §4.3 dual-gate for `ui-consistency-shell`
// (docs/specs/ui-consistency-shell/e2e.md). Read-only: the only state these
// touch is this browser context's own localStorage, so they are safe to
// re-run and never collide with the other suites.

const STORAGE_KEY = "ui.sidebarCollapsed";

/** Wait for TanStack Start hydration (dev-only window.__i18n hook). */
async function waitHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => "__i18n" in window, undefined, {
    timeout: 15_000
  });
}

// The rail is a desktop affordance; force a desktop viewport regardless of the
// project so one file covers the behaviour once (the breakpoint test drives its
// own sizes).
test.use({ viewport: { width: 1440, height: 900 } });

// Each test gets a fresh browser context, so localStorage starts empty on its
// own. Do NOT clear it from an init script: init scripts re-run on every
// navigation, which would wipe the persisted state the reload test asserts on.
test.describe("app shell sidebar", () => {
  // Scenario 1 — happy path
  test("[happy] desktop shows 4 nav items and highlights only the current one", async ({
    page
  }) => {
    await page.goto("/");
    await waitHydrated(page);

    for (const name of [
      "Dashboard",
      "CV ↔ JD Matching",
      "Curriculum Vitae",
      "Job Descriptions"
    ]) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }

    await expect(
      page.getByRole("link", { name: "Dashboard", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Curriculum Vitae", exact: true })
    ).not.toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "Curriculum Vitae" }).click();
    await expect(
      page.getByRole("link", { name: "Curriculum Vitae", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Dashboard", exact: true })
    ).not.toHaveAttribute("aria-current", "page");
  });

  // Scenario 11 — state transitions + persistence [ST]
  test("[state] collapse to rail, survives navigation and reload", async ({
    page
  }) => {
    await page.goto("/");
    await waitHydrated(page);

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await expect(
      page.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();
    // Label text is gone from the sidebar, but the link keeps its accessible
    // name. Scoped to #app-sidebar: "Curriculum Vitae" is also the Home stat
    // card label, so an unscoped getByText would match that instead.
    await expect(
      page.locator("#app-sidebar").getByText("Curriculum Vitae")
    ).toHaveCount(0);
    await expect(
      page.locator("#app-sidebar").getByRole("link", {
        name: "Curriculum Vitae"
      })
    ).toBeVisible();

    await page.getByRole("link", { name: "Job Descriptions" }).click();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();

    await page.reload();
    await waitHydrated(page);
    await expect(
      page.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeVisible();
  });

  // Scenario 4 — persisted-value classes [EP]
  test("[validation] a garbage persisted value falls back to expanded", async ({
    page
  }) => {
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, "maybe"),
      STORAGE_KEY
    );
    await page.goto("/");
    await waitHydrated(page);

    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeVisible();
  });

  // Scenario 6 — the lg breakpoint [BVA]
  test("[boundary] the rail control exists at 1024 but not at 1023", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1023, height: 900 });
    await page.goto("/");
    await waitHydrated(page);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeHidden();

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });

  // Scenario 11 — viewport × collapsed state [DT]
  test("[state] a collapsed desktop preference does not affect the mobile drawer", async ({
    page
  }) => {
    await page.goto("/");
    await waitHydrated(page);
    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByRole("button", { name: "Open menu" }).click();

    // Scoped to the Drawer: the Home stat card carries the same label.
    await expect(
      page.getByRole("dialog").getByText("Curriculum Vitae")
    ).toBeVisible();
  });

  // Scenario 12 — accessibility
  test("[a11y] the toggle is keyboard operable and reports its state", async ({
    page
  }) => {
    await page.goto("/");
    await waitHydrated(page);

    const toggle = page.getByRole("button", { name: "Collapse sidebar" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "app-sidebar");

    await toggle.focus();
    await page.keyboard.press("Enter");

    const expanded = page.getByRole("button", { name: "Expand sidebar" });
    await expect(expanded).toHaveAttribute("aria-expanded", "false");
    await expect(expanded).toBeFocused();
  });

  // Scenario 9 — i18n
  test("[i18n] nav labels and the toggle render in Vietnamese", async ({
    page
  }) => {
    await page.goto("/");
    await waitHydrated(page);

    await page.evaluate(async () => {
      await (
        window as unknown as {
          __i18n: { changeLanguage: (l: string) => Promise<unknown> };
        }
      ).__i18n.changeLanguage("vi");
    });

    await expect(
      page.getByRole("link", { name: "Tổng quan", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sơ yếu lý lịch", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Mô tả công việc", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Thu gọn thanh bên" })
    ).toBeVisible();
  });
});
