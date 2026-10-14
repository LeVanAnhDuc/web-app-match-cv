import { test, expect } from "@/fixtures";
import { LG_BOUNDARY, SHELL_SIZE } from "@/data/test-data/ui-consistency-shell";

// Below lg: header + hamburger + drawer (REQ-UICONSISTENCYSHELL-10..12, -19).
// Tests that drive their own viewport sizes run once, in the desktop project "app"; the rest run on the compact
// projects (tablet 820px, mobile 390px) and skip on desktop.

const COMPACT_ONLY = "header + drawer only exist below lg (1024px); the desktop project covers the sidebar";
const RESIZES_ITSELF = "sets its own viewport sizes, so one project is enough";

test.describe("signed-in user", () => {
  test("Biên 1024px: 1023 hiện hamburger, 1024 và 1025 hiện sidebar", { tag: ["@TC-UICONSISTENCYSHELL-017"] }, async ({
    shellLayoutPage,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "app", RESIZES_ITSELF);
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    for (const { width, compact } of LG_BOUNDARY) {
      await shellLayoutPage.resize(width);
      if (compact) {
        await expect(shell.openMenuButton(), `${width}px`).toBeVisible();
        await expect(shell.sidebar(), `${width}px`).toBeHidden();
        await expect(shellLayoutPage.sidebarToggle(), `${width}px`).toBeHidden();
      } else {
        await expect(shell.sidebar(), `${width}px`).toBeVisible();
        await expect(shellLayoutPage.sidebarToggle(), `${width}px`).toBeVisible();
        await expect(shell.openMenuButton(), `${width}px`).toBeHidden();
      }
    }
  });

  test("Header mobile của user có hamburger 44×44, tên app và nút tài khoản", { tag: ["@TC-UICONSISTENCYSHELL-018"] }, async ({
    shellLayoutPage,
  }) => {
    test.skip(!shellLayoutPage.isCompactViewport(), COMPACT_ONLY);
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    const box = await shell.openMenuButton().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(SHELL_SIZE.hitArea);
    expect(box?.height).toBeGreaterThanOrEqual(SHELL_SIZE.hitArea);
    await expect(shellLayoutPage.headerAppName()).toBeVisible();
    await expect(shell.accountButton()).toBeVisible();
    await expect(shell.accountButton()).toHaveAttribute("aria-haspopup", "dialog");
    await expect(shell.headerSignInLink()).toHaveCount(0);
  });

  test("Drawer mở từ hamburger có đủ nhãn và đóng bằng Close, Esc, bấm nền", { tag: ["@TC-UICONSISTENCYSHELL-020", "@smoke"] }, async ({
    shellLayoutPage,
    page,
  }) => {
    test.skip(!shellLayoutPage.isCompactViewport(), COMPACT_ONLY);
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");

    await shell.openDrawer();
    await expect(shellLayoutPage.namedDrawer()).toBeVisible();
    for (const item of ["home", "match", "savedCvs", "savedJds", "aiCredentials", "myData"] as const) {
      await expect(shell.drawer().getByText(shellLayoutPage.navLabel(item), { exact: true }), item).toBeVisible();
    }
    await shell.drawerCloseButton().click();
    await expect(shell.drawer()).toBeHidden();

    await shell.openDrawer();
    await page.keyboard.press("Escape");
    await expect(shell.drawer()).toBeHidden();

    await shell.openDrawer();
    await shellLayoutPage.clickDrawerBackdrop();
    await expect(shell.drawer()).toBeHidden();
  });

  test("Drawer mobile vẫn đủ nhãn khi sidebar desktop đang thu gọn", { tag: ["@TC-UICONSISTENCYSHELL-021"] }, async ({
    shellLayoutPage,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "app", RESIZES_ITSELF);
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shell.collapseSidebar();

    await shellLayoutPage.resize(SHELL_SIZE.narrowPhone, 800);
    await shell.openDrawer();
    await expect(shell.drawer().getByText(shellLayoutPage.navLabel("savedCvs"), { exact: true })).toBeVisible();
    await expect(shell.drawer().getByText(shellLayoutPage.navLabel("home"), { exact: true })).toBeVisible();
  });

  test("Bấm mục nav trong drawer đi đúng route và drawer tự đóng", { tag: ["@TC-UICONSISTENCYSHELL-022"] }, async ({
    shellLayoutPage,
    page,
  }) => {
    test.skip(!shellLayoutPage.isCompactViewport(), COMPACT_ONLY);
    // BUG: defects/ui-consistency-shell.md#bug-uiconsistencyshell-01
    test.fail();
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shell.openDrawer();
    await shell.drawerLink("savedCvs").click();
    await page.waitForURL((url) => url.pathname === "/cv");
    await expect(shell.drawer()).toBeHidden({ timeout: 5_000 });
  });
});

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Header mobile của khách có link Sign in mang returnTo của trang hiện tại", { tag: ["@TC-UICONSISTENCYSHELL-019"] }, async ({
    shellLayoutPage,
    urls,
  }) => {
    test.skip(!shellLayoutPage.isCompactViewport(), COMPACT_ONLY);
    const { shell } = shellLayoutPage;
    const path = "/wizard?step=1&ref=ucs";
    await shellLayoutPage.goto(path);
    const link = shell.headerSignInLink();
    await expect(link).toBeVisible();
    // Only the href is checked: following it would start a real OIDC round-trip (D1/D5).
    const href = new URL((await link.getAttribute("href")) ?? "", urls.webUrl);
    expect(href.href.startsWith(`${urls.apiUrl}/auth/login`)).toBe(true);
    expect(href.searchParams.get("returnTo")).toBe(path);
    await expect(shell.accountButton()).toHaveCount(0);
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(SHELL_SIZE.hitArea);
  });
});
