import { ANY_CREDENTIAL_ENDPOINT } from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// Who reaches /ai-credentials and how (REQ-AICREDENTIALS-01, -05).

test.describe("ai-credentials — no account", () => {
  // A visitor with no session cookie at all (the project's storage state is the seeded e2e user).
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "khách chưa đăng nhập thấy cổng đăng nhập và không có request credential nào",
    { tag: ["@TC-AICREDENTIALS-001", "@smoke"] },
    async ({ aiCredentialsPage, network }) => {
      const credentialCalls = network.recordRequests(ANY_CREDENTIAL_ENDPOINT);

      await aiCredentialsPage.goto();

      await expect(aiCredentialsPage.gateHeading()).toBeVisible();
      await expect(aiCredentialsPage.gateBackLink()).toHaveAttribute("href", "/wizard");
      await expect(aiCredentialsPage.heading()).toHaveCount(0);
      await expect(aiCredentialsPage.addButtons()).toHaveCount(0);
      expect(credentialCalls).toHaveLength(0);
    }
  );
});

test.describe("ai-credentials — signed in", () => {
  test(
    "trong lúc xác định phiên trang hiện khung chờ aria-busy",
    { tag: ["@TC-AICREDENTIALS-002"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredDelay }) => {
      void aiCredUser;
      await aiCredDelay("**/api/v1/auth/me", 2_500, "GET");

      await aiCredentialsPage.goto();

      await expect(aiCredentialsPage.busyPlaceholder()).toBeVisible();
      await expect(aiCredentialsPage.gateHeading()).toHaveCount(0);
      await expect(aiCredentialsPage.heading()).toBeVisible({ timeout: 15_000 });
      await expect(aiCredentialsPage.busyPlaceholder()).toHaveCount(0);
    }
  );

  test(
    "mục AI credentials trên sidebar dẫn tới trang credential",
    { tag: ["@TC-AICREDENTIALS-004"] },
    async ({ aiCredUser, aiCredentialsPage, page }) => {
      void aiCredUser;
      await page.goto("/");
      await aiCredentialsPage.waitForAppReady();

      // Sidebar on desktop, drawer below lg — AppShell picks the one on screen.
      await aiCredentialsPage.shell.navigate("aiCredentials");

      await expect(page).toHaveURL(/\/ai-credentials$/);
      await expect(aiCredentialsPage.heading()).toBeVisible();
    }
  );
});
