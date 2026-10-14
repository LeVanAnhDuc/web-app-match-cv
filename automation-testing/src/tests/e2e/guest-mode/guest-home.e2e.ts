import { test, expect } from "@/fixtures";

// REQ-GUESTMODE-17 (home of a guest) and the UI half of REQ-GUESTMODE-15 (a failed sign-in lands on /?authError=…).

test.describe("guest home", () => {
  test(
    "Trang chủ khách có hero với limit runtime và thẻ quyền lợi, không có thống kê hay kết quả gần đây",
    { tag: ["@TC-GUESTMODE-037", "@smoke"] },
    async ({ guestModeHomePage, anonApi, guestModeQuota }) => {
      await guestModeQuota.clear();
      const { limit } = (await anonApi.auth.me()).json().guestQuota!;
      await guestModeHomePage.gotoLoaded();

      await expect(guestModeHomePage.heroEyebrow()).toBeVisible();
      await expect(guestModeHomePage.guestNote(limit)).toBeVisible();
      await expect(guestModeHomePage.heroSignInLink()).toBeVisible();
      await expect(guestModeHomePage.perksTitle()).toBeVisible();
      await expect(guestModeHomePage.perkItems()).toHaveCount(guestModeHomePage.perks.length);
      for (const perk of guestModeHomePage.perks) await expect(guestModeHomePage.perkTitle(perk)).toBeVisible();
      await expect(guestModeHomePage.statCard()).toHaveCount(0);
      await expect(guestModeHomePage.recentMatchesHeading()).toHaveCount(0);

      await guestModeHomePage.startMatching();
    }
  );

  test(
    "Đăng nhập thất bại về trang chủ với toast lỗi, khách vẫn ở chế độ khách",
    { tag: ["@TC-GUESTMODE-038"] },
    async ({ guestModeHomePage, guestModeData, guestModeBrowser, shell, page }) => {
      const guest = await guestModeData.guest();
      await guestModeBrowser.useSession(guest);

      await guestModeHomePage.gotoAuthError("denied");
      await expect(guestModeHomePage.authErrorToast("denied")).toBeVisible();
      await expect(page).not.toHaveURL(/authError=/);
      await expect(guestModeHomePage.heroTitle()).toBeVisible();
      if (await shell.isCompact()) await shell.openDrawer();
      await expect(shell.guestSignInLink()).toBeVisible();
    }
  );
});
