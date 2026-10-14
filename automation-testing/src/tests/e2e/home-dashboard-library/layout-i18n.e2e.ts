import { t } from "@/data/copy";
import { longTitle } from "@/data/test-data/home-dashboard-library";
import { uniqueSuffix } from "@/data/test-data/shared";
import { expect, test } from "@/fixtures";

// Signed-in home in Vietnamese (switched through the dev hook window.__i18n — the app has no switcher, D4) and its
// layout on the desktop / tablet / mobile projects. Viewport-agnostic: expectations derive from the actual width.

const RAW_KEY = /\bhome\.[a-z]/;

test(
  "dashboard user hiển thị tiếng Việt",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-050"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Vi");
    const createdAt = new Date(Date.now() - 86_400_000);
    await homeData.result(user.userId, { ...pair, score: 77, createdAt });
    await homeSession.use(user);
    await home.goto();
    await home.waitForDashboard();

    await home.setLanguage("vi");

    await expect(home.heroTitle()).toHaveText(t("home.hero.title", "vi"));
    await expect(home.heroCta()).toBeVisible();
    for (const tile of ["savedCvs", "savedJds", "totalMatches", "highest"] as const) {
      await expect(home.statLabel(tile), tile).toBeVisible();
    }
    await expect(home.averageLine(77)).toBeVisible();
    await expect(home.recentTitle()).toBeVisible();
    for (const col of ["cv", "jd", "score", "date"] as const) await expect(home.columnHeader(col), col).toBeVisible();
    await expect(home.recentRow(pair.cvTitle, pair.jdTitle)).toContainText(
      new Intl.DateTimeFormat("vi").format(createdAt)
    );
    expect(await home.mainText()).not.toMatch(RAW_KEY);
  }
);

test(
  "empty state tiếng Việt",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-051"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    await homeSession.use(await homeData.signedIn());
    await home.goto();
    await home.waitForDashboard();

    await home.setLanguage("vi");

    await expect(home.emptyText()).toHaveText(t("home.recent.empty", "vi"));
    await expect(home.emptyCta()).toBeVisible();
    expect(await home.mainText()).not.toMatch(RAW_KEY);
  }
);

test(
  "thẻ thống kê xếp 1 / 2 / 4 cột theo bề rộng màn hình",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-052"] },
  async ({ homeData, homeSession, homeDashboardPage: home, page }) => {
    await homeSession.use(await homeData.signedIn());
    await home.goto();
    await home.waitForDashboard();
    await expect(home.statFigure("totalMatches", 0)).toBeVisible();

    const width = page.viewportSize()!.width;
    const expected = width >= 1024 ? 4 : width >= 640 ? 2 : 1;
    expect(await home.statTilesInFirstRow(), `columns at ${width}px`).toBe(expected);
  }
);

test(
  "title dài không làm trang cuộn ngang",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-053"] },
  async ({ homeData, homeSession, homeDashboardPage: home, page }) => {
    const user = await homeData.signedIn();
    const suffix = uniqueSuffix();
    const cvTitle = longTitle(`CV${suffix}`);
    const jdTitle = longTitle(`JD${suffix}`);
    const cvId = await homeData.document(user.userId, "CV", { title: cvTitle });
    const jdId = await homeData.document(user.userId, "JD", { title: jdTitle });
    await homeData.result(user.userId, { cvId, jdId, score: 64 });
    await homeSession.use(user);
    await home.goto();
    await home.waitForDashboard();
    await expect(home.recentRow(cvTitle, jdTitle)).toBeVisible();

    for (const width of [page.viewportSize()!.width, 375]) {
      await page.setViewportSize({ width, height: page.viewportSize()!.height });
      await expect(home.recentRow(cvTitle, jdTitle)).toBeVisible();
      const { scrollWidth, viewportWidth } = await home.horizontalOverflow();
      expect(scrollWidth, `page scroll width at ${width}px`).toBeLessThanOrEqual(viewportWidth);
    }
  }
);
