import { t } from "@/data/copy";
import { expect, test } from "@/fixtures";

// Home "/" before the dashboard: the auth-loading block and the guest / anonymous hero. These run in the signed-in
// projects; homeSession swaps the browser's cookie for an anonymous visitor or a throwaway guest.

const API_CALL = /\/api\/v1\//;
const AI_CALL = /\/api\/v1\/(match|cover-letters|cv-rewrite|ai-credentials\/[^/]+\/test)(\?.*)?$/;

test(
  "người chưa đăng nhập thấy hero khách và quyền lợi tài khoản, không tải dữ liệu riêng",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-020", "@smoke"] },
  async ({ homeSession, homeDashboardPage: home, network }) => {
    await homeSession.anonymous();
    const calls = network.recordRequests(API_CALL);

    await home.goto();
    await home.waitForGuestHero();

    await expect(home.guestEyebrow()).toBeVisible();
    await expect(home.guestSubtitle()).toBeVisible();
    await expect(home.guestStartLink()).toBeVisible();
    await expect(home.guestSignInLink()).toBeVisible();
    await expect(home.guestNote(5)).toBeVisible();
    await expect(home.perksEyebrow()).toBeVisible();
    await expect(home.perksTitle()).toBeVisible();
    for (const perk of ["documents", "history", "rewrite", "keys"] as const) {
      await expect(home.perk(perk), perk).toBeVisible();
    }
    await expect(home.statTile("savedCvs")).toHaveCount(0);
    await expect(home.recentTitle()).toHaveCount(0);

    const paths = calls.map((c) => `${c.method} ${new URL(c.url).pathname}`);
    expect(paths.filter((p) => /\/documents|\/match/.test(p))).toEqual([]);
    expect(calls.filter((c) => c.method === "POST" && AI_CALL.test(c.url))).toEqual([]);
  }
);

test(
  "khách thấy ghi chú hạn mức lấy từ guestQuota",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-021"] },
  async ({ homeData, homeSession, homeDashboardPage: home, network, apiAs }) => {
    const guest = await homeData.guest();
    const me = (await apiAs(guest).auth.me()).json();
    expect(me.status).toBe("guest");
    const limit = me.guestQuota!.limit;
    await homeSession.use(guest);
    const history = network.recordRequests("**/api/v1/match", { method: "GET" });

    await home.goto();
    await home.waitForGuestHero();

    await expect(home.guestNote(limit)).toBeVisible();
    await expect(home.heroTitle()).toHaveCount(0);
    await expect(home.statTile("totalMatches")).toHaveCount(0);
    expect(history).toEqual([]);
  }
);

test(
  "nút \"Start matching →\" của khách mở trình ghép",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-022"] },
  async ({ homeSession, homeDashboardPage: home, page }) => {
    await homeSession.anonymous();
    await home.goto();
    await home.waitForGuestHero();

    await home.guestStartLink().click();

    await expect(page).toHaveURL(/\/wizard$/);
  }
);

test(
  "nút Sign in của khách trỏ tới /auth/login kèm returnTo",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-023"] },
  async ({ homeSession, homeDashboardPage: home, urls }) => {
    await homeSession.anonymous();
    await home.goto();
    await home.waitForGuestHero();

    // Read, never click: following it would reach the real OIDC provider (D1/D5).
    const href = await home.guestSignInLink().getAttribute("href");
    expect(href).not.toBeNull();
    const target = new URL(href!, urls.webUrl);
    expect(`${target.origin}${target.pathname}`).toBe(`${urls.apiUrl}/auth/login`);
    expect(target.searchParams.get("returnTo")).toBeTruthy();
  }
);

test(
  "trong lúc chờ /auth/me trang chủ chỉ hiện khối loading",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-024"] },
  async ({ homeData, homeSession, homeDashboardPage: home, homeLatency }) => {
    await homeSession.use(await homeData.signedIn());
    await homeLatency("**/api/v1/auth/me", 3_000);

    await home.goto();

    await expect(home.loading()).toBeVisible();
    await expect(home.guestTitle()).toHaveCount(0);
    await expect(home.heroTitle()).toHaveCount(0);
    await expect(home.heroTitle()).toBeVisible({ timeout: 15_000 });
    await expect(home.loading()).toHaveCount(0);
  }
);

test(
  "trang chủ khách hiển thị tiếng Việt",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-025"] },
  async ({ homeSession, homeDashboardPage: home }) => {
    await homeSession.anonymous();
    await home.goto();
    await home.waitForGuestHero();

    await home.setLanguage("vi");

    await expect(home.guestTitle()).toHaveText(t("home.guest.title", "vi"));
    await expect(home.guestStartLink()).toBeVisible();
    await expect(home.guestSignInLink()).toBeVisible();
    await expect(home.guestNote(5)).toBeVisible();
    await expect(home.perksTitle()).toBeVisible();
    await expect(home.perk("history")).toBeVisible();
    expect(await home.mainText()).not.toMatch(/\bhome\.[a-z]/);
  }
);
