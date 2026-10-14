import { test, expect } from "@/fixtures";
import { NAV_ITEMS, type NavItem } from "@/components/app-shell.component";
import { LANGUAGES, t } from "@/data/copy";
import { RAW_KEY } from "@/data/test-data/ui-consistency-shell";

// Shell copy in en + vi (REQ-UICONSISTENCYSHELL-18). There is no language switcher in the app (Q1 / D4): vi is reached
// through the dev hook window.__i18n via setLanguage(), after goto() because the choice does not survive a reload.
// AppShell resolves its labels in the page's current language, so the same locators work in both.

const USER_ITEMS = Object.keys(NAV_ITEMS) as NavItem[];

test.describe("signed-in user", () => {
  test("Shell desktop hiển thị tiếng Việt cho nav, toggle, tên app và khối tài khoản", { tag: ["@TC-UICONSISTENCYSHELL-034"] }, async ({
    shellLayoutPage,
  }) => {
    test.skip(shellLayoutPage.isCompactViewport(), "desktop sidebar; the compact header/drawer is TC-UICONSISTENCYSHELL-035");
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shellLayoutPage.setLanguage("vi");

    for (const item of USER_ITEMS) await expect(shell.sidebarLink(item), item).toHaveText(t(NAV_ITEMS[item].key, "vi"));
    await expect(shell.sidebar().getByText(t("appName", "vi"), { exact: true })).toBeVisible();
    await expect(shell.sidebar().getByRole("button", { name: t("auth.signOut", "vi") })).toBeVisible();
    await expect(shell.collapseButton()).toBeVisible();

    await shell.collapseSidebar();
    await expect(shell.expandButton()).toHaveAccessibleName(t("nav.expand", "vi"));
    await expect(shell.sidebar().getByRole("button", { name: t("auth.account", "vi") })).toBeVisible();
    await shell.sidebarLink("savedJds").hover();
    await expect(shellLayoutPage.tooltip()).toHaveText(t("nav.savedJds", "vi"));
  });

  test("Header và drawer mobile hiển thị tiếng Việt", { tag: ["@TC-UICONSISTENCYSHELL-035"] }, async ({ shellLayoutPage }) => {
    test.skip(!shellLayoutPage.isCompactViewport(), "header + drawer only exist below lg (1024px)");
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shellLayoutPage.setLanguage("vi");

    await expect(shell.openMenuButton()).toHaveAccessibleName(t("nav.openMenu", "vi"));
    await expect(shellLayoutPage.headerAppName()).toHaveText(t("appName", "vi"));
    await expect(shell.accountButton()).toHaveAccessibleName(t("auth.account", "vi"));
    await shell.openDrawer();
    await expect(shellLayoutPage.namedDrawer()).toBeVisible();
    for (const item of USER_ITEMS) await expect(shell.drawerLink(item), item).toHaveText(t(NAV_ITEMS[item].key, "vi"));
  });
});

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Shell không hiện raw key i18n ở cả en và vi", { tag: ["@TC-UICONSISTENCYSHELL-036"] }, async ({ shellLayoutPage }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    for (const lng of LANGUAGES) {
      await shellLayoutPage.setLanguage(lng);
      await shellLayoutPage.showNav();
      await expect(shell.guestCard(), lng).toBeVisible();
      await expect(shell.guestCard().getByText(t("auth.guest.eyebrow", lng), { exact: true }), lng).toBeVisible();
      await expect(shell.guestCard().getByText(t("auth.guest.pitch", lng), { exact: true }), lng).toBeVisible();
      await expect(shell.guestSignInLink(), lng).toHaveText(t("auth.signInWithDucker", lng));
      expect(await shellLayoutPage.shellText(), lng).not.toMatch(RAW_KEY);
    }
  });
});
