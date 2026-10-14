import { test, expect } from "@/fixtures";
import { GUEST_CV_TEXT, GUEST_JD_TEXT, systemKeyResult } from "@/data/test-data/guest-mode";

// REQ-GUESTMODE-13 / 15 / 22 end to end in the browser. D5: the app's "Sign in" links are sent to the auth module's
// dedicated Match CV instance wired to the fake IdP (authBrowser.routeSignInToFakeIdp, auto-consent or deny), which
// shares the dev database — so the guest made by the wizard here is the guest that instance claims. D1: POST /match is
// stubbed, so the claimed run carries no persisted result; what is asserted is the round trip, the banner and who owns
// the run afterwards.

test.describe("sign-in round trip from guest mode", () => {
  test(
    "Khách bấm Sign in to keep it, đăng nhập qua IdP giả và quay lại bước 4 với banner đã lưu",
    { tag: ["@TC-GUESTMODE-049", "@smoke", "@creates-data"] },
    async ({ guestModeWizardPage: wizard, guestModeData, guestModeBrowser, network, authBrowser, authFlow, page }) => {
      const identity = authFlow.identity();
      authFlow.idp.nextIdentity = identity;
      await authBrowser.routeSignInToFakeIdp();
      await network.stubJson("**/api/v1/match", systemKeyResult(), { method: "POST", status: 201 });

      await wizard.goto();
      await wizard.pasteJdAndCv(GUEST_JD_TEXT, GUEST_CV_TEXT);
      const runId = ((await (await wizard.runMatch()).json()) as { id: string }).id;
      const guestId = await guestModeBrowser.adoptGuest();
      expect(guestId).not.toBeNull();

      await wizard.keepSignInLink().click();
      await page.waitForURL((url) => url.pathname === "/wizard" && url.searchParams.get("claimed") === "1");
      await wizard.waitForAppReady();
      await expect(wizard.claimedBanner()).toBeVisible();

      const user = await authFlow.userBySub(identity.sub);
      expect(user?.isGuest).toBe(false);
      expect(await guestModeData.runOwner(runId)).toBe(user!.id);
      expect(await guestModeData.findUser(guestId!)).toBeNull();
    }
  );

  test(
    "Khách huỷ đăng nhập ở IdP quay về app với toast lỗi và vẫn là khách",
    { tag: ["@TC-GUESTMODE-050"] },
    async ({ guestModeHomePage: home, guestModeData, guestModeBrowser, authBrowser, authFlow, shell, apiAs }) => {
      const guest = await guestModeData.guest();
      const { cvId } = await guestModeData.pair(guest.userId);
      await guestModeBrowser.useSession(guest);
      await authBrowser.routeSignInToFakeIdp();
      authFlow.idp.authorizeBehaviour = "deny";
      try {
        await home.gotoLoaded();
        if (await shell.isCompact()) await shell.headerSignInLink().click();
        else await shell.guestSignInLink().click();

        await expect(home.authErrorToast("denied")).toBeVisible();
        await expect(home.heroTitle()).toBeVisible();
      } finally {
        authFlow.idp.authorizeBehaviour = "consent";
      }
      expect((await apiAs(guest).auth.me()).json().status).toBe("guest");
      expect((await apiAs(guest).documents.get(cvId)).status).toBe(200);
    }
  );
});
