import { test, expect } from "@/fixtures";
import { NAV_ITEMS } from "@/components/app-shell.component";
import { t } from "@/data/copy";
import { initialsOf } from "@/data/test-data/auth";
import { createSignedInUser, deleteUsers, resolveSession } from "@/utils/sessions";

// The signed-in shell (REQ-AUTH-27, 18), signing out from it (REQ-AUTH-16, 15) and what the client does when it
// cannot learn who it is (REQ-AUTH-18).

test.describe("Signed-in shell (seeded e2e user, read only)", () => {
  test(
    "shell của user hiện đủ 6 mục điều hướng và danh tính tài khoản",
    { tag: ["@TC-AUTH-050"] },
    async ({ accountShellPage, accountIdentity }) => {
      // The client's own /auth/me answers "user": the session cookie travelled cross-origin (credentials: "include").
      const { body } = await accountShellPage.gotoAndReadMe("/wizard");
      expect(body.status).toBe("user");
      const shell = accountShellPage.shell;

      if (await shell.isCompact()) await shell.openDrawer();
      await expect(shell.navLinks()).toHaveText(
        (["home", "match", "savedCvs", "savedJds", "aiCredentials", "myData"] as const).map((item) =>
          t(NAV_ITEMS[item].key)
        )
      );
      if (await shell.drawer().isVisible()) await shell.closeDrawer();

      const user = body.user!;
      await expect(accountIdentity.avatar(initialsOf(user.fullName, user.email))).toBeVisible();
      const region = await accountIdentity.open();
      await expect(accountIdentity.text(region, (user.fullName ?? user.email)!)).toBeVisible();
      if (user.fullName && user.email) await expect(accountIdentity.text(region, user.email)).toBeVisible();
      await expect(shell.signOutButton()).toBeVisible();
    }
  );
});

test.describe("Signing out and an unreachable /auth/me (no shared session)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "đăng xuất từ shell về trang chủ ở giao diện khách",
    { tag: ["@TC-AUTH-051", "@smoke", "@creates-data"] },
    async ({ accountShellPage, authBrowser, signInGatePage, page }) => {
      // Never the seeded e2e user: signing out revokes the session for every spec that shares it.
      const user = await createSignedInUser();
      try {
        await authBrowser.useSession(user.cookie);
        await accountShellPage.goto("/cv");
        await expect(signInGatePage.heading("gate.cv")).toHaveCount(0);
        const shell = accountShellPage.shell;

        await shell.signOut();
        await page.waitForURL((url) => url.pathname === "/");
        // Guest view: "Sign in" in the header below lg, the GuestCard's sign-in link in the sidebar from lg up.
        if (await shell.isCompact()) {
          await expect(shell.headerSignInLink()).toBeVisible();
          await shell.openDrawer();
        }
        await expect(shell.guestSignInLink()).toBeVisible();
        await expect(shell.navLinks()).toHaveCount(2);
        expect(await resolveSession(user.cookie.slice("mcv_session=".length))).toBeNull();

        // The account page is gated again (nothing served from a stale cache).
        await signInGatePage.goto("/cv");
        await expect(signInGatePage.heading("gate.cv")).toBeVisible();
      } finally {
        await deleteUsers([user.userId]);
      }
    }
  );

  test(
    "/auth/me lỗi mạng thì hiện giao diện khách, không kẹt skeleton",
    { tag: ["@TC-AUTH-052"] },
    async ({ signInGatePage, network }) => {
      // BUG: defects/auth.md#bug-auth-01
      test.fail();
      await network.abort("**/api/v1/auth/me");
      await signInGatePage.goto("/cv");
      // React Query retries 3 times (≈7 s) before the hook may degrade to anonymous.
      await expect(signInGatePage.heading("gate.cv")).toBeVisible({ timeout: 20_000 });
      await expect(signInGatePage.skeleton()).toHaveCount(0);
    }
  );
});
