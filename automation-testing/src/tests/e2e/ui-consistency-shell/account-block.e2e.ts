import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { OVERDRAWN_QUOTA, SHELL_SIZE } from "@/data/test-data/ui-consistency-shell";

// Account block at the foot of the sidebar (REQ-UICONSISTENCYSHELL-13, -14). Sign out is never clicked here: on the
// shared e2e session it would revoke the Session row every other spec uses (the sign-out flow belongs to module auth).

const DESKTOP_ONLY = "the sidebar account block (expanded card / collapsed rail) only exists from lg (1024px) up";

test.describe("signed-in user", () => {
  test("User thấy tên, email và nút Sign out ở chân sidebar mở rộng", { tag: ["@TC-UICONSISTENCYSHELL-023"] }, async ({
    shellLayoutPage,
    api,
  }) => {
    test.skip(shellLayoutPage.isCompactViewport(), DESKTOP_ONLY);
    const me = (await api.auth.me()).json();
    expect(me.status).toBe("user");
    const { fullName, email } = me.user!;

    await shellLayoutPage.goto("/");
    await expect(shellLayoutPage.sidebarText(fullName ?? email ?? "")).toBeVisible();
    if (fullName && email) await expect(shellLayoutPage.sidebarText(email)).toBeVisible();
    await expect(shellLayoutPage.shell.sidebar().getByRole("button", { name: t("auth.signOut") })).toBeVisible();
    await expect(shellLayoutPage.shell.guestSignInLink()).toHaveCount(0);
  });

  test("Rail: nút avatar mở popover tài khoản, Esc đóng và trả focus về nút", { tag: ["@TC-UICONSISTENCYSHELL-024"] }, async ({
    shellLayoutPage,
    api,
    page,
  }) => {
    test.skip(shellLayoutPage.isCompactViewport(), DESKTOP_ONLY);
    const { user } = (await api.auth.me()).json();
    const name = user?.fullName ?? user?.email ?? "";
    const { shell } = shellLayoutPage;

    await shellLayoutPage.goto("/");
    await shell.collapseSidebar();
    const avatar = shell.sidebar().getByRole("button", { name: t("auth.account") });
    await expect(avatar).toHaveAttribute("aria-haspopup", "dialog");
    await expect(shellLayoutPage.sidebarText(name)).toHaveCount(0);

    await avatar.click();
    await expect(shell.accountMenu()).toBeVisible();
    await expect(shell.accountMenu().getByText(name, { exact: true })).toBeVisible();
    await expect(shell.accountMenu().getByRole("button", { name: t("auth.signOut") })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(shell.accountMenu()).toBeHidden();
    await expect(avatar).toBeFocused();
  });
});

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Khách thấy thẻ Guest mode với link đăng nhập và quota còn lại", { tag: ["@TC-UICONSISTENCYSHELL-025"] }, async ({
    shellLayoutPage,
    anonApi,
  }) => {
    const { guestQuota } = (await anonApi.auth.me()).json();
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await shellLayoutPage.showNav();

    await expect(shell.guestCard()).toBeVisible();
    await expect(shell.guestCard().getByText(t("auth.guest.pitch"), { exact: true })).toBeVisible();
    await expect(shell.guestSignInLink()).toBeVisible();
    expect(guestQuota).not.toBeNull();
    const { limit, used } = guestQuota!;
    await expect(shell.guestCard().getByText(t("auth.quota.label"), { exact: true })).toBeVisible();
    await expect(shell.guestQuotaText(Math.max(0, limit - used), limit)).toBeVisible();
  });

  test("Rail của khách chỉ còn link đăng nhập 44×44", { tag: ["@TC-UICONSISTENCYSHELL-026"] }, async ({ shellLayoutPage }) => {
    test.skip(shellLayoutPage.isCompactViewport(), DESKTOP_ONLY);
    const { shell } = shellLayoutPage;
    await shellLayoutPage.goto("/");
    await expect(shell.guestCard()).toBeVisible();
    await shell.collapseSidebar();

    const link = shellLayoutPage.railSignInLink();
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(SHELL_SIZE.hitArea);
    expect(box?.height).toBeGreaterThanOrEqual(SHELL_SIZE.hitArea);
    await expect(shell.sidebar().getByText(t("auth.guest.eyebrow"), { exact: true })).toHaveCount(0);
  });

  test("Quota đã dùng quá giới hạn hiển thị 0 lượt còn lại", { tag: ["@TC-UICONSISTENCYSHELL-027"] }, async ({
    shellLayoutPage,
    network,
  }) => {
    // Q5: an overdrawn quota cannot be reached against the real backend without spending AI calls, so only the
    // read of GET /auth/me is stubbed.
    await network.stubJson(
      "**/api/v1/auth/me",
      { status: "anonymous", user: null, guestQuota: { ...OVERDRAWN_QUOTA, resetsAt: new Date().toISOString() } },
      { method: "GET" }
    );
    await shellLayoutPage.goto("/");
    await shellLayoutPage.showNav();
    await expect(shellLayoutPage.shell.guestQuotaText(0, OVERDRAWN_QUOTA.limit)).toBeVisible();
  });
});
