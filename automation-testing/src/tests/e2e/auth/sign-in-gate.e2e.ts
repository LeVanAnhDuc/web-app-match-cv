import { test, expect } from "@/fixtures";
import { GATED_ROUTES } from "@/data/test-data/auth";
import { createGuestUser, deleteUsers } from "@/utils/sessions";

// The six account-only routes for a visitor who is not signed in (REQ-AUTH-28, 29, 25). Runs with no session;
// the guest case plants its own guest cookie.

test.use({ storageState: { cookies: [], origins: [] } });

const loginHref = (apiUrl: string, returnTo: string) => `${apiUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

test.describe("Sign-in gate", () => {
  test(
    "sáu route cần tài khoản hiện màn mời đăng nhập và không gọi API của trang",
    { tag: ["@TC-AUTH-044", "@smoke"] },
    async ({ signInGatePage, network, urls, page }) => {
      const apiCalls = network.recordRequests("**/api/v1/**");
      for (const { path, titleKey } of GATED_ROUTES) {
        await signInGatePage.goto(path);
        await expect(signInGatePage.heading(titleKey), path).toBeVisible();
        await expect(signInGatePage.description(), path).toBeVisible();
        await expect(signInGatePage.signInButton(), path).toHaveAttribute("href", loginHref(urls.apiUrl, path));
        await expect(signInGatePage.backToMatchingLink(), path).toBeVisible();
        // No silent redirect: still on the route that was asked for.
        expect(new URL(page.url()).pathname, path).toBe(path);
      }
      // The only API call a gated route makes for a visitor is "who am I".
      expect(apiCalls.map((r) => new URL(r.url).pathname).filter((p) => !p.endsWith("/auth/me"))).toEqual([]);
    }
  );

  test(
    "khách cũng thấy màn mời đăng nhập và Quay lại đối chiếu về /wizard",
    { tag: ["@TC-AUTH-045"] },
    async ({ signInGatePage, authBrowser }) => {
      const guest = await createGuestUser();
      try {
        await authBrowser.useSession(guest.cookie);
        await signInGatePage.goto("/my-data");
        await expect(signInGatePage.heading("gate.myData")).toBeVisible();
        await signInGatePage.backToMatching();
        await expect(signInGatePage.heading("gate.myData")).toHaveCount(0);
      } finally {
        await deleteUsers([guest.userId]);
      }
    }
  );

  test(
    "màn mời đăng nhập có bản tiếng Việt và nút cao 44px",
    { tag: ["@TC-AUTH-046"] },
    async ({ signInGatePage }) => {
      await signInGatePage.goto("/ai-credentials");
      await expect(signInGatePage.heading("gate.aiCredentials")).toBeVisible();
      await signInGatePage.setLanguage("vi");

      // Locators resolve their labels in the page's current language (vi now).
      await expect(signInGatePage.heading("gate.aiCredentials")).toBeVisible();
      await expect(signInGatePage.description()).toBeVisible();
      await expect(signInGatePage.signInButton()).toBeVisible();
      await expect(signInGatePage.backToMatchingLink()).toBeVisible();
      for (const control of [signInGatePage.signInButton(), signInGatePage.backToMatchingLink()]) {
        const box = await control.boundingBox();
        expect(box?.height).toBe(44);
      }
    }
  );
});
