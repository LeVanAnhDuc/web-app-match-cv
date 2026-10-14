import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";

// Where a visitor starts a sign-in (REQ-AUTH-25) and the whole round trip in a real browser (REQ-AUTH-06, 27).
// Runs with no session. Nothing here reaches the real Ducker ID: links are only read, and the one flow that follows
// a link has the dev API's /auth/login sent to the dedicated instance + fake IdP first (authBrowser, decision D5).

test.use({ storageState: { cookies: [], origins: [] } });

const loginHref = (apiUrl: string, returnTo: string) => `${apiUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

test.describe("Sign-in entry points", () => {
  test(
    "nút đăng nhập trên shell dẫn tới API login kèm đường dẫn hiện tại",
    { tag: ["@TC-AUTH-041"] },
    async ({ accountShellPage, urls }) => {
      const here = "/wizard?from=e2e";
      await accountShellPage.goto(here);
      const shell = accountShellPage.shell;

      if (await shell.isCompact()) {
        // Below lg: "Sign in" in the header, and the GuestCard's "Sign in with Ducker ID" inside the drawer.
        await expect(shell.headerSignInLink()).toHaveAttribute("href", loginHref(urls.apiUrl, here));
        await shell.openDrawer();
      }
      await expect(shell.guestSignInLink()).toBeVisible();
      await expect(shell.guestSignInLink()).toHaveAttribute("href", loginHref(urls.apiUrl, here));
    }
  );

  test(
    "sidebar thu gọn vẫn có nút đăng nhập dạng icon với nhãn đọc được",
    { tag: ["@TC-AUTH-042"] },
    async ({ accountShellPage, urls }, testInfo) => {
      test.skip(testInfo.project.name !== "app", "the collapsible sidebar only exists from lg up (desktop project)");
      const here = "/wizard?x=2";
      await accountShellPage.goto(here);
      const shell = accountShellPage.shell;
      await expect(shell.guestSignInLink()).toBeVisible();
      await shell.collapseSidebar();

      // Collapsed: an icon-only link whose accessible name is its aria-label.
      const iconLink = shell.guestSignInLink();
      await expect(iconLink).toBeVisible();
      await expect(iconLink).toHaveAttribute("aria-label", t("auth.signInWithDucker"));
      await expect(iconLink).toHaveAttribute("href", loginHref(urls.apiUrl, here));
      await expect(shell.guestCard()).toHaveCount(0);
    }
  );

  test(
    "đăng nhập đầy đủ từ màn mời đăng nhập qua IdP giả quay về đúng trang với giao diện user",
    { tag: ["@TC-AUTH-043", "@smoke", "@creates-data"] },
    async ({ signInGatePage, authBrowser, authFlow, accountIdentity, page, urls }) => {
      const identity = authFlow.identity({ name: "Grace Hopper" });
      authFlow.idp.nextIdentity = identity;
      await authBrowser.routeSignInToFakeIdp();

      await signInGatePage.goto("/cv");
      await expect(signInGatePage.heading("gate.cv")).toBeVisible();
      await signInGatePage.signIn();

      expect(page.url()).toBe(`${urls.webUrl}/cv`);
      await expect(signInGatePage.heading("gate.cv")).toHaveCount(0);
      const region = await accountIdentity.open();
      await expect(accountIdentity.text(region, "Grace Hopper")).toBeVisible();
      await expect(accountIdentity.text(region, identity.email!)).toBeVisible();
      expect(await authFlow.userBySub(identity.sub)).toMatchObject({ isGuest: false, email: identity.email });
    }
  );
});
