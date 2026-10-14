import { BAND_CASES, daysAgo, reportFor } from "@/data/test-data/home-dashboard-library";
import { uniqueSuffix } from "@/data/test-data/shared";
import { expect, test } from "@/fixtures";

// "Recent matches" on the signed-in home: order, columns, score bands, the 5-row cap, the empty state, and re-opening
// a stored report from a row. Results are seeded in the DB under a throwaway user (no AI call anywhere).

const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

test(
  "bảng recent hiện kết quả mới nhất trước với title, điểm và ngày theo locale",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-040", "@smoke"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const seeded = [];
    for (const [i, score] of [82, 55, 30].entries()) {
      const pair = await homeData.pair(user.userId, `Recent${i}`);
      const createdAt = daysAgo(i + 1);
      const id = await homeData.result(user.userId, { ...pair, score, createdAt });
      seeded.push({ ...pair, id, score, createdAt });
    }
    await homeSession.use(user);

    await home.goto();
    await home.waitForDashboard();

    await expect(home.recentTitle()).toBeVisible();
    for (const col of ["cv", "jd", "score", "date"] as const) await expect(home.columnHeader(col), col).toBeVisible();
    const rows = home.recentRows();
    await expect(rows).toHaveCount(3);
    for (const [i, match] of seeded.entries()) {
      const row = rows.nth(i);
      await expect(row).toHaveAccessibleName(`${match.cvTitle} × ${match.jdTitle}`);
      await expect(row).toContainText(match.cvTitle);
      await expect(row).toContainText(match.jdTitle);
      await expect(home.scoreCell(match.id)).toHaveText(`${match.score}%`);
      await expect(row).toContainText(new Intl.DateTimeFormat("en").format(match.createdAt));
      await expect(row).not.toContainText(match.id);
      await expect(row).not.toContainText(ISO_TIMESTAMP);
    }
  }
);

test(
  "màu điểm theo band ở biên 49 / 50 / 74 / 75",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-041"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Band");
    const ids = [];
    for (const { score } of BAND_CASES) ids.push(await homeData.result(user.userId, { ...pair, score }));
    await homeSession.use(user);

    await home.goto();
    await home.waitForDashboard();

    for (const [i, { score, band }] of BAND_CASES.entries()) {
      const cell = home.scoreCell(ids[i]);
      await expect(cell, `${score}`).toHaveText(`${score}%`);
      await expect(cell, `${score} → ${band}`).toHaveClass(new RegExp(`\\btext-${band}\\b`));
    }
  }
);

test(
  "đúng 5 kết quả thì hiện 5 dòng và không có \"View all\"",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-042"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Five");
    for (let i = 0; i < 5; i += 1) await homeData.result(user.userId, { ...pair, createdAt: daysAgo(i + 1) });
    await homeSession.use(user);

    await home.goto();
    await home.waitForDashboard();

    await expect(home.recentRows()).toHaveCount(5);
    await expect(home.statFigure("totalMatches", 5)).toBeVisible();
    await expect(home.viewAll()).toHaveCount(0);
  }
);

test(
  "6 kết quả thì chỉ 5 dòng mới nhất và \"View all\" không bấm được",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-043"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const oldest = await homeData.pair(user.userId, "Oldest");
    await homeData.result(user.userId, { ...oldest, createdAt: daysAgo(10) });
    const pair = await homeData.pair(user.userId, "Six");
    for (let i = 0; i < 5; i += 1) await homeData.result(user.userId, { ...pair, createdAt: daysAgo(i + 1) });
    await homeSession.use(user);

    await home.goto();
    await home.waitForDashboard();

    await expect(home.recentRows()).toHaveCount(5);
    await expect(home.recentRow(oldest.cvTitle, oldest.jdTitle)).toHaveCount(0);
    await expect(home.statFigure("totalMatches", 6)).toBeVisible();
    await expect(home.viewAll()).toBeVisible();
    await expect(home.viewAllControl()).toHaveCount(0);
  }
);

test(
  "nút \"Match now\" của empty state mở trình ghép",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-044"] },
  async ({ homeData, homeSession, homeDashboardPage: home, page }) => {
    await homeSession.use(await homeData.signedIn());
    await home.goto();
    await home.waitForDashboard();

    await home.matchNowFromEmptyState();

    await expect(page).toHaveURL(/\/wizard$/);
  }
);

test(
  "bấm một dòng mở đúng báo cáo của kết quả đó mà không chạy lại match",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-045", "@smoke"] },
  async ({ homeData, homeSession, homeDashboardPage: home, network, page }) => {
    const user = await homeData.signedIn();
    const tag = uniqueSuffix();
    const older = await homeData.pair(user.userId, "Older");
    const olderReport = reportFor(`${tag}-older`);
    const olderId = await homeData.result(user.userId, { ...older, report: olderReport, createdAt: daysAgo(2) });
    const newer = await homeData.pair(user.userId, "Newer");
    const newerReport = reportFor(`${tag}-newer`);
    await homeData.result(user.userId, { ...newer, report: newerReport, createdAt: daysAgo(1) });
    await homeSession.use(user);
    const reads = network.recordRequests(`**/api/v1/match/${olderId}`, { method: "GET" });
    const runs = network.recordRequests(/\/api\/v1\/match(\/runs)?(\?.*)?$/, { method: "POST" });

    await home.goto();
    await home.waitForDashboard();
    const report = await home.openResult(older.cvTitle, older.jdTitle);

    await expect(page).toHaveURL(/\/wizard$/);
    await expect(report.reportLine(olderReport.strengths[0])).toBeVisible();
    await expect(report.reportLine(newerReport.strengths[0])).toHaveCount(0);
    expect(reads.length).toBeGreaterThan(0);
    expect(runs).toEqual([]);
  }
);

test(
  "dòng kết quả mở được bằng bàn phím Enter và Space",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-046"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Keyboard");
    const report = reportFor(uniqueSuffix());
    await homeData.result(user.userId, { ...pair, report });
    await homeSession.use(user);

    for (const key of ["Enter", " "] as const) {
      await home.goto();
      await home.waitForDashboard();
      const row = home.recentRow(pair.cvTitle, pair.jdTitle);
      await expect(row).toHaveAttribute("tabindex", "0");

      const opened = await home.openResultWithKey(pair.cvTitle, pair.jdTitle, key);

      await expect(opened.reportLine(report.strengths[0]), `key "${key}"`).toBeVisible();
    }
  }
);
