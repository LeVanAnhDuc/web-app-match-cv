import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { HYDRATION_ERROR, PERSISTED_VALUES, SHELL_SIZE } from "@/data/test-data/ui-consistency-shell";

// Desktop sidebar collapse / expand and its persistence (REQ-UICONSISTENCYSHELL-05..09, -20).
// Each test gets a fresh browser context, so localStorage starts empty on its own. Never clear it from an init script:
// init scripts re-run on every navigation, which would wipe the state the reload tests assert on.

test.describe("desktop sidebar", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < SHELL_SIZE.lgBreakpoint,
    "the collapsible sidebar only exists from lg (1024px) up; compact viewports are covered by responsive.e2e.ts"
  );

  test("Sidebar mặc định mở rộng 288px với nút Collapse đúng thuộc tính", { tag: ["@TC-UICONSISTENCYSHELL-007"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    const toggle = shell.collapseButton();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "app-sidebar");
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.expandedSidebar);
    // Labels are visible text, not only accessible names.
    await expect(shell.sidebar().getByText(shellLayoutPage.navLabel("savedCvs"), { exact: true })).toBeVisible();
    expect(await shellLayoutPage.storedSidebarState()).toBeNull();
  });

  test("Thu gọn thành rail 64px, link giữ accessible name, nội dung rộng ra và mở lại được", { tag: ["@TC-UICONSISTENCYSHELL-008", "@smoke"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.expandedSidebar);
    const mainBefore = await shellLayoutPage.mainWidth();

    await shell.collapseSidebar();
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.rail);
    await expect(shell.expandButton()).toHaveAttribute("aria-expanded", "false");
    // Label text is gone from the rail, but every link keeps its accessible name.
    await expect(shell.sidebar().getByText(shellLayoutPage.navLabel("savedCvs"), { exact: true })).toHaveCount(0);
    await expect(shell.sidebarLink("savedCvs")).toBeVisible();
    // ±1px for sub-pixel rounding of the flex layout.
    expect(Math.abs((await shellLayoutPage.mainWidth()) - (mainBefore + SHELL_SIZE.expandedSidebar - SHELL_SIZE.rail))).toBeLessThanOrEqual(1);
    expect(await shellLayoutPage.storedSidebarState()).toBe("true");

    await shell.expandSidebar();
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.expandedSidebar);
    await expect(shell.collapseButton()).toHaveAttribute("aria-expanded", "true");
    expect(await shellLayoutPage.storedSidebarState()).toBe("false");
  });

  test("Rail hiện tooltip nhãn khi hover vào icon", { tag: ["@TC-UICONSISTENCYSHELL-009"] }, async ({ shellLayoutPage }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shell.collapseSidebar();
    await shell.sidebarLink("match").hover();
    await expect(shellLayoutPage.tooltip()).toHaveText(shellLayoutPage.navLabel("match"));
  });

  test("Double-click toggle để giao diện khớp giá trị đã lưu", { tag: ["@TC-UICONSISTENCYSHELL-010"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shellLayoutPage.sidebarToggle().dblclick();
    // Whatever the two clicks settled on, the UI, the persisted value and the reloaded UI must agree.
    await expect.poll(() => shellLayoutPage.storedSidebarState()).not.toBeNull();
    const stored = await shellLayoutPage.storedSidebarState();
    const collapsed = stored === "true";
    const expected = collapsed ? shell.expandButton() : shell.collapseButton();
    await expect(expected).toBeVisible();
    await shellLayoutPage.waitForSidebarWidth(collapsed ? SHELL_SIZE.rail : SHELL_SIZE.expandedSidebar);
    await shellLayoutPage.reload();
    await expect(expected).toBeVisible();
  });

  test("Trạng thái thu gọn giữ nguyên khi đổi route và sau khi tải lại", { tag: ["@TC-UICONSISTENCYSHELL-011"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shell.collapseSidebar();

    await shell.navigate("savedJds");
    await expect(shell.expandButton()).toBeVisible();

    await shellLayoutPage.reload();
    await expect(shell.expandButton()).toBeVisible();
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.rail);

    await shell.expandSidebar();
    await shellLayoutPage.reload();
    await expect(shell.collapseButton()).toBeVisible();
  });

  test("Chỉ giá trị lưu true/false có tác dụng, giá trị khác quay về mở rộng", { tag: ["@TC-UICONSISTENCYSHELL-012"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    for (const { value, collapsed } of PERSISTED_VALUES) {
      await shellLayoutPage.setStoredSidebarState(value);
      await shellLayoutPage.reload();
      await expect(collapsed ? shell.expandButton() : shell.collapseButton(), `stored ${JSON.stringify(value)}`).toBeVisible();
    }
  });

  test("Storage bị chặn không làm crash, toggle vẫn chạy trong bộ nhớ", { tag: ["@TC-UICONSISTENCYSHELL-013"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    const errors = shellLayoutPage.collectErrors();
    await shellLayoutPage.blockStorage();
    await shellLayoutPage.goto("/");
    await expect(shell.collapseButton()).toBeVisible();
    await shell.collapseSidebar();
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.rail);
    await shell.expandSidebar();
    await shellLayoutPage.waitForSidebarWidth(SHELL_SIZE.expandedSidebar);
    expect(errors.filter((e) => e.startsWith("pageerror:"))).toEqual([]);
  });

  test("Toggle dùng bàn phím: Enter và Space đổi trạng thái, focus ở lại nút", { tag: ["@TC-UICONSISTENCYSHELL-014"] }, async ({
    shellLayoutPage,
    page,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shell.collapseButton().focus();
    await page.keyboard.press("Enter");
    await expect(shell.expandButton()).toHaveAttribute("aria-expanded", "false");
    await expect(shell.expandButton()).toBeFocused();

    await page.keyboard.press("Space");
    await expect(shell.collapseButton()).toHaveAttribute("aria-expanded", "true");
    await expect(shell.collapseButton()).toBeFocused();
  });

  test("HTML server luôn mở rộng, trạng thái lưu áp sau hydrate, không lỗi hydration", { tag: ["@TC-UICONSISTENCYSHELL-015"] }, async ({
    shellLayoutPage,
  }) => {
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shellLayoutPage.setStoredSidebarState("true");

    const errors = shellLayoutPage.collectErrors();
    const response = await shellLayoutPage.goto("/cv");
    const html = (await response?.text()) ?? "";
    expect(html).toContain(`aria-label="${t("nav.collapse")}"`);
    expect(html).not.toContain(`aria-label="${t("nav.expand")}"`);

    await expect(shell.expandButton()).toBeVisible();
    expect(errors.filter((e) => HYDRATION_ERROR.test(e))).toEqual([]);
  });

  test("Sidebar không có chuyển động khi bật giảm chuyển động", { tag: ["@TC-UICONSISTENCYSHELL-016"] }, async ({
    shellLayoutPage,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await shellLayoutPage.goto("/");
    await expect(shellLayoutPage.shell.collapseButton()).toBeVisible();
    expect(await shellLayoutPage.sidebarTransitionSeconds()).toBe(0);
  });
});
