import { test, expect } from "@/fixtures";

// REQ-INFRA-07 (browser side of CORS) and REQ-INFRA-11. Runs on the desktop "app" project only: playwright.config.ts
// leaves e2e/infra/ out of app-tablet / app-mobile; reachability does not depend on the viewport (decision Q8).

test.describe("web reachability", () => {
  test(
    "web client trả lời ở origin web và hydrate",
    { tag: ["@TC-INFRA-024", "@smoke"] },
    async ({ webRootPage, shell }) => {
      const res = await webRootPage.goto();

      expect(res).not.toBeNull();
      expect(res!.status()).toBeLessThan(400);
      expect(res!.headers()["content-type"]).toContain("text/html");
      await expect(shell.main()).toBeVisible();
    }
  );

  test(
    "trình duyệt ở origin web gọi được API kèm cookie phiên",
    { tag: ["@TC-INFRA-014", "@smoke"] },
    async ({ webRootPage, shell }) => {
      const me = webRootPage.waitForAuthMe();
      await webRootPage.goto();

      expect((await me).status()).toBe(200);
      await expect(webRootPage.signedInMarker()).toBeVisible();
      await expect(shell.guestSignInLink()).toBeHidden();
    }
  );

  test("tải trang gốc không có response 5xx", { tag: ["@TC-INFRA-025"] }, async ({ webRootPage }) => {
    const failures = webRootPage.recordServerErrors();
    await webRootPage.goto();
    await webRootPage.waitForSettled();

    expect(failures).toEqual([]);
  });
});
