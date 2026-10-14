import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { DEFAULT_GUEST_LIMIT } from "@/data/test-data/guest-mode";

// REQ-GUESTMODE-16 (+ the VI half of REQ-GUESTMODE-23): the shell an anonymous visitor / guest sees.
// Runs in app-guest (desktop) and app-guest-mobile with no session cookie. Below lg the sidebar lives in the drawer,
// so every check opens it first when the viewport is compact.

const signInHref = (apiUrl: string, returnTo: string) => `${apiUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

test.describe("guest shell", () => {
  test.beforeEach(async ({ guestModeQuota }) => {
    await guestModeQuota.clear();
  });

  test(
    "Sidebar khách chỉ có Dashboard và CV ↔ JD Matching, kèm thẻ Chế độ khách và thanh quota",
    { tag: ["@TC-GUESTMODE-032", "@smoke"] },
    async ({ guestModeHomePage, shell, urls }) => {
      await guestModeHomePage.gotoLoaded();
      if (await shell.isCompact()) await shell.openDrawer();

      await expect(shell.navLinks()).toHaveCount(2);
      await expect(shell.navLinks().nth(0)).toHaveAccessibleName(t("nav.home"));
      await expect(shell.navLinks().nth(1)).toHaveAccessibleName(t("nav.match"));
      await expect(shell.guestCard()).toContainText(t("auth.guest.eyebrow"));
      await expect(shell.guestCard()).toContainText(t("auth.guest.pitch"));
      await expect(shell.guestCard()).toContainText(t("auth.quota.label"));
      await expect(shell.guestQuotaText(DEFAULT_GUEST_LIMIT, DEFAULT_GUEST_LIMIT)).toBeVisible();
      await expect(shell.guestSignInLink()).toHaveAttribute("href", signInHref(urls.apiUrl, "/"));
    }
  );

  test(
    "Nút đăng nhập mang đường dẫn hiện tại làm returnTo",
    { tag: ["@TC-GUESTMODE-033"] },
    async ({ guestModeWizardPage, shell, urls }) => {
      await guestModeWizardPage.goto();
      if (await shell.isCompact()) {
        await expect(shell.headerSignInLink()).toHaveAttribute("href", signInHref(urls.apiUrl, "/wizard"));
        await shell.openDrawer();
      }
      await expect(shell.guestSignInLink()).toHaveAttribute("href", signInHref(urls.apiUrl, "/wizard"));
    }
  );

  test(
    "Header mobile/tablet của khách có nút Sign in",
    { tag: ["@TC-GUESTMODE-034"] },
    async ({ guestModeHomePage, shell, urls }) => {
      await guestModeHomePage.gotoLoaded();
      test.skip(!(await shell.isCompact()), "The header only exists below lg (desktop shows the sidebar card instead)");

      await expect(shell.headerSignInLink()).toBeVisible();
      await expect(shell.headerSignInLink()).toHaveAttribute("href", signInHref(urls.apiUrl, "/"));
      await expect(shell.accountButton()).toHaveCount(0);
    }
  );

  test(
    "Route cần tài khoản hiện màn gate đăng nhập thay cho nội dung",
    { tag: ["@TC-GUESTMODE-035"] },
    async ({ guestModeHomePage, urls }) => {
      await guestModeHomePage.open("/cv");

      await expect(guestModeHomePage.gate.routeTitle("cv")).toBeVisible();
      await expect(guestModeHomePage.gate.signInLink()).toHaveAttribute("href", signInHref(urls.apiUrl, "/cv"));
      await expect(guestModeHomePage.gate.backMatchingLink()).toBeVisible();
    }
  );

  test(
    "Thẻ khách và thanh quota hiển thị tiếng Việt",
    { tag: ["@TC-GUESTMODE-036"] },
    async ({ guestModeHomePage, shell }) => {
      await guestModeHomePage.gotoLoaded();
      await guestModeHomePage.setLanguage("vi");
      if (await shell.isCompact()) await shell.openDrawer();

      await expect(shell.guestCard()).toContainText(t("auth.guest.eyebrow", "vi"));
      await expect(shell.guestCard()).toContainText(t("auth.quota.label", "vi"));
      await expect(shell.guestQuotaText(DEFAULT_GUEST_LIMIT, DEFAULT_GUEST_LIMIT)).toBeVisible();
      await expect(shell.guestSignInLink()).toBeVisible();
    }
  );
});
