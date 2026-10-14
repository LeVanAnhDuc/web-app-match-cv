import { test, expect } from "@/fixtures";

// REQ-GUESTMODE-22: where "Sign in to keep it" comes back to — /wizard?runId=<id>&claimed=1. The run and its result
// are seeded in the DB (no AI call); the browser carries a seeded session cookie (signed-in user, or guest).

test.describe("claimed return", () => {
  test(
    "Sau đăng nhập về /wizard?runId&claimed=1 mở bước 4 của run và hiện banner đã lưu, đóng banner bỏ claimed",
    { tag: ["@TC-GUESTMODE-045", "@smoke"] },
    async ({ guestModeWizardPage: wizard, guestModeData, guestModeBrowser, page }) => {
      const user = await guestModeData.user();
      const run = await guestModeData.run(user.userId);
      await guestModeBrowser.useSession(user);

      await wizard.goto(`?runId=${run.runId}&claimed=1`);
      await expect(wizard.claimedBanner()).toBeVisible();
      await expect(wizard.claimedBody()).toBeVisible();
      await expect(wizard.overallMeter()).toBeVisible();
      await expect(page).toHaveURL(/[?&]claimed=1/);

      await wizard.dismissClaimed();
      await expect(wizard.claimedBanner()).toHaveCount(0);
      expect(new URL(page.url()).searchParams.has("claimed")).toBe(false);
      await expect(wizard.overallMeter()).toBeVisible();
    }
  );

  test(
    "Khách mở lại run qua ?runId thấy bước 4 với thẻ giữ 24 giờ nhưng không có banner claimed",
    { tag: ["@TC-GUESTMODE-046"] },
    async ({ guestModeWizardPage: wizard, guestModeData, guestModeBrowser }) => {
      const guest = await guestModeData.guest();
      const run = await guestModeData.run(guest.userId);
      await guestModeBrowser.useSession(guest);

      await wizard.goto(`?runId=${run.runId}&claimed=1`);
      await expect(wizard.systemKeyCardTitle()).toBeVisible();
      await expect(wizard.keepTitle()).toBeVisible();
      await expect(wizard.claimedBanner()).toHaveCount(0);
    }
  );
});
