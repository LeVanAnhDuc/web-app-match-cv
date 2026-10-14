import { test, expect } from "@/fixtures";
import { NAV_ITEMS, type NavItem } from "@/components/app-shell.component";
import { t } from "@/data/copy";
import { LEGACY_LABELS, appRoutes } from "@/data/test-data/ui-consistency-shell";

// Shell navigation (REQ-UICONSISTENCYSHELL-01..04). Runs on desktop, tablet and mobile: on compact viewports the nav
// lives in the drawer, which ShellLayoutPage.showNav() opens.

const USER_ITEMS = Object.keys(NAV_ITEMS) as NavItem[];

test.describe("signed-in user", () => {
  test("Mọi route trong /_app render trong shell với nội dung ở main", { tag: ["@TC-UICONSISTENCYSHELL-001", "@smoke"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    for (const path of appRoutes()) {
      await shellLayoutPage.goto(path);
      await expect(shell.main(), path).toBeVisible();
      if (shellLayoutPage.isCompactViewport()) {
        await expect(shell.openMenuButton(), path).toBeVisible();
        await expect(shell.sidebar(), path).toBeHidden();
      } else {
        await expect(shell.sidebar(), path).toBeVisible();
        await expect(shell.openMenuButton(), path).toBeHidden();
      }
    }
  });

  test("User đã đăng nhập thấy đủ 6 mục nav đúng thứ tự", { tag: ["@TC-UICONSISTENCYSHELL-002", "@smoke"] }, async ({
    shellLayoutPage,
  }) => {
    await shellLayoutPage.goto("/");
    await shellLayoutPage.showNav();
    await expect(shellLayoutPage.shell.navLinks()).toHaveCount(USER_ITEMS.length);
    expect(await shellLayoutPage.navLabels()).toEqual(USER_ITEMS.map((item) => shellLayoutPage.navLabel(item)));
  });

  test("Bấm từng mục nav đi đúng route và chỉ mục đó active", { tag: ["@TC-UICONSISTENCYSHELL-004", "@smoke"] }, async ({
    shellLayoutPage,
  }) => {
    // The drawer path is TC-UICONSISTENCYSHELL-022: on compact viewports the drawer stays open after a nav click
    // (BUG-UICONSISTENCYSHELL-01), which would make every later step here fail for that one reason.
    test.skip(shellLayoutPage.isCompactViewport(), "desktop sidebar flow; drawer navigation is TC-UICONSISTENCYSHELL-022");
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    for (const item of USER_ITEMS) {
      await shell.navigate(item);
      await expect(shell.activeNavLink(), item).toHaveCount(1);
      await expect(shell.activeNavLink(), item).toHaveAccessibleName(shellLayoutPage.navLabel(item));
    }
  });

  test("Deep-link đánh dấu đúng mục và Dashboard chỉ active ở đúng /", { tag: ["@TC-UICONSISTENCYSHELL-005"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    const cases: Array<{ path: string; active: NavItem | null }> = [
      { path: "/", active: "home" },
      { path: "/cv", active: "savedCvs" },
      { path: "/wizard?step=1", active: "match" },
      { path: "/my-data", active: "myData" },
      // A route outside the nav list: no item at all may be active (Dashboard is exact-match, not a prefix of "/compare").
      { path: appRoutes()[6], active: null },
    ];
    for (const { path, active } of cases) {
      await shellLayoutPage.goto(path);
      await shellLayoutPage.showNav();
      if (active === null) {
        await expect(shell.activeNavLink(), path).toHaveCount(0);
      } else {
        await expect(shell.activeNavLink(), path).toHaveCount(1);
        await expect(shell.activeNavLink(), path).toHaveAccessibleName(shellLayoutPage.navLabel(active));
      }
    }
  });

  test("Nav, tiêu đề /cv /jd và thẻ thống kê dùng nhãn mới, không còn Saved CVs/JDs", { tag: ["@TC-UICONSISTENCYSHELL-006"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await expect(shell.main().getByText(t("home.stat.savedCvs"), { exact: true })).toBeVisible();
    await expect(shell.main().getByText(t("home.stat.savedJds"), { exact: true })).toBeVisible();
    await expect(shell.main().getByText(LEGACY_LABELS)).toHaveCount(0);
    await shellLayoutPage.showNav();
    expect(await shellLayoutPage.navLabels()).toEqual(expect.arrayContaining([t("nav.savedCvs"), t("nav.savedJds")]));
    expect(await shellLayoutPage.shellText()).not.toMatch(LEGACY_LABELS);

    for (const [path, key] of [["/cv", "library.title.cv"], ["/jd", "library.title.jd"]] as const) {
      await shellLayoutPage.goto(path);
      await expect(shellLayoutPage.pageHeading(), path).toHaveText(t(key));
      await expect(shell.main().getByText(LEGACY_LABELS), path).toHaveCount(0);
    }
  });
});

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Khách chưa đăng nhập chỉ thấy Dashboard và CV ↔ JD Matching", { tag: ["@TC-UICONSISTENCYSHELL-003"] }, async ({
    shellLayoutPage,
  }) => {
    await shellLayoutPage.goto("/");
    await shellLayoutPage.showNav();
    // The guest card renders once GET /auth/me has answered, so the filtered list is final by then.
    await expect(shellLayoutPage.shell.guestSignInLink()).toBeVisible();
    await expect(shellLayoutPage.shell.navLinks()).toHaveCount(2);
    expect(await shellLayoutPage.navLabels()).toEqual([shellLayoutPage.navLabel("home"), shellLayoutPage.navLabel("match")]);
  });
});
