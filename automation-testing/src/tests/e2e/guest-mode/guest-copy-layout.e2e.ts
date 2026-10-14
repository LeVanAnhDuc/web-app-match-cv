import type { Locator } from "@playwright/test";
import { test, expect } from "@/fixtures";
import { LANGUAGES, t } from "@/data/copy";

// REQ-GUESTMODE-23: guest copy exists in EN and VI, always names the 24-hour retention, never hard-codes the limit;
// buttons on the guest screens are 44px tall and full-width below md (768px).

const RETENTION_KEYS = ["home.guest.note", "input.guestNote", "result.keep.title"] as const;
const MD = 768;

/** Rendered height, and width relative to the element's parent box. */
async function box(locator: Locator): Promise<{ height: number; widthRatio: number }> {
  return locator.evaluate((el) => {
    const own = el.getBoundingClientRect();
    const parent = el.parentElement!.getBoundingClientRect();
    return { height: own.height, widthRatio: own.width / parent.width };
  });
}

test.describe("guest copy and layout", () => {
  test(
    "Copy khách có đủ EN/VI, nói rõ 24 giờ và hiển thị tiếng Việt với limit runtime",
    { tag: ["@TC-GUESTMODE-047"] },
    async ({ guestModeHomePage, guestModeWizardPage, guestModeData, guestModeBrowser, anonApi, guestModeQuota }) => {
      for (const lng of LANGUAGES) {
        for (const key of RETENTION_KEYS) expect(t(key, lng), `${key} (${lng})`).toContain("24");
      }
      await guestModeQuota.clear();
      const { limit } = (await anonApi.auth.me()).json().guestQuota!;

      await guestModeHomePage.gotoLoaded();
      await guestModeHomePage.setLanguage("vi");
      await expect(guestModeHomePage.heroTitle()).toBeVisible();
      await expect(guestModeHomePage.guestNote(limit)).toBeVisible();
      await expect(guestModeHomePage.perksTitle()).toBeVisible();

      const guest = await guestModeData.guest();
      const run = await guestModeData.run(guest.userId);
      await guestModeBrowser.useSession(guest);
      await guestModeWizardPage.goto(`?runId=${run.runId}`);
      await guestModeWizardPage.setLanguage("vi");
      await expect(guestModeWizardPage.keepTitle()).toBeVisible();
      await expect(guestModeWizardPage.keepSignInLink()).toBeVisible();
      await guestModeWizardPage.startOverButton().click();
      await expect(guestModeWizardPage.guestNote()).toBeVisible();
    }
  );

  test(
    "Nút trên màn khách cao 44px và full-width dưới md",
    { tag: ["@TC-GUESTMODE-048"] },
    async ({ guestModeHomePage, guestModeWizardPage, guestModeData, guestModeBrowser, shell, page }) => {
      const narrow = (page.viewportSize()?.width ?? 1280) < MD;
      const check = async (name: string, locator: Locator, fullWidthBelowMd = true) => {
        await expect(locator, name).toBeVisible();
        const { height, widthRatio } = await box(locator);
        expect(height, `${name} height`).toBeCloseTo(44, 0);
        if (narrow && fullWidthBelowMd) expect(widthRatio, `${name} width`).toBeGreaterThanOrEqual(0.99);
      };

      await guestModeHomePage.gotoLoaded();
      await check("Start matching", guestModeHomePage.startMatchingLink());
      await check("hero Sign in", guestModeHomePage.heroSignInLink());
      if (await shell.isCompact()) await check("header Sign in", shell.headerSignInLink(), false);
      else await check("guest card Sign in", shell.guestSignInLink());

      await guestModeHomePage.open("/cv");
      await check("gate Sign in", guestModeHomePage.gate.signInLink());
      await check("gate Back to matching", guestModeHomePage.gate.backMatchingLink());

      const guest = await guestModeData.guest();
      const run = await guestModeData.run(guest.userId);
      await guestModeBrowser.useSession(guest);
      await guestModeWizardPage.goto(`?runId=${run.runId}`);
      await check("Sign in to keep it", guestModeWizardPage.keepSignInLink());
    }
  );
});
