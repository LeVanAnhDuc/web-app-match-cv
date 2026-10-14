import { roundedAverage } from "@/data/test-data/home-dashboard-library";
import { expect, test } from "@/fixtures";

// Signed-in home: hero CTA and the four stat tiles. Every test signs the browser in as its own throwaway user
// (homeData + homeSession), so counts are exact whatever else lives in the shared dev DB.

const API_CALL = /\/api\/v1\//;

test(
  "nút \"Start matching now\" mở trình ghép không tải lại trang",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-030", "@smoke"] },
  async ({ homeData, homeSession, homeDashboardPage: home, page }) => {
    await homeSession.use(await homeData.signedIn());
    await home.goto();
    await home.waitForDashboard();

    await expect(home.heroSubtitle()).toBeVisible();
    await home.tagDocument();
    await home.startMatching();

    await expect(page).toHaveURL(/\/wizard$/);
    expect(await home.documentIsTagged(), "client-side navigation keeps the same document").toBe(true);
  }
);

test(
  "thẻ thống kê đếm đúng CV, JD đã lưu, số kết quả, điểm cao nhất và trung bình",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-031", "@smoke"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Stats");
    await homeData.document(user.userId, "CV");
    await homeData.document(user.userId, "CV", { saved: false });
    const scores = [40, 81, 60];
    for (const score of scores) await homeData.result(user.userId, { ...pair, score });
    await homeSession.use(user);

    await home.goto();
    await home.waitForDashboard();

    await expect(home.statLabel("savedCvs")).toBeVisible();
    await expect(home.statFigure("savedCvs", 2)).toBeVisible();
    await expect(home.statLabel("savedJds")).toBeVisible();
    await expect(home.statFigure("savedJds", 1)).toBeVisible();
    await expect(home.statLabel("totalMatches")).toBeVisible();
    await expect(home.statFigure("totalMatches", 3)).toBeVisible();
    await expect(home.statLabel("highest")).toBeVisible();
    await expect(home.highestMeter()).toHaveAttribute("aria-valuenow", "81");
    await expect(home.averageLine(roundedAverage(scores))).toBeVisible();
  }
);

test(
  "user chưa có dữ liệu thấy số 0, điểm \"—\" và empty state",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-032"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    await homeSession.use(await homeData.signedIn());

    await home.goto();
    await home.waitForDashboard();

    await expect(home.statFigure("savedCvs", 0)).toBeVisible();
    await expect(home.statFigure("savedJds", 0)).toBeVisible();
    await expect(home.statFigure("totalMatches", 0)).toBeVisible();
    await expect(home.statFigure("highest", "—")).toBeVisible();
    await expect(home.highestMeter()).toHaveCount(0);
    await expect(home.anyAverageLine()).toHaveCount(0);
    await expect(home.emptyText()).toBeVisible();
    await expect(home.emptyCta()).toBeVisible();
    await expect(home.viewAll()).toHaveCount(0);
  }
);

test(
  "thẻ thống kê hiện skeleton khi lịch sử đang tải",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-033"] },
  async ({ homeData, homeSession, homeDashboardPage: home, homeLatency }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Skeleton");
    await homeData.result(user.userId, { ...pair, score: 66 });
    await homeSession.use(user);
    await homeLatency("**/api/v1/match", 3_000, { method: "GET" });

    await home.goto();
    await home.waitForDashboard();

    for (const tile of ["totalMatches", "highest"] as const) {
      await expect(home.statSkeletonLines(tile).first(), tile).toBeVisible();
      await expect(home.statLabel(tile), tile).toHaveCount(0);
    }
    await expect(home.statFigure("totalMatches", 1)).toBeVisible({ timeout: 15_000 });
    await expect(home.highestMeter()).toHaveAttribute("aria-valuenow", "66");
    await expect(home.statSkeletonLines("totalMatches")).toHaveCount(0);
  }
);

test(
  "kết quả provider lỗi không được tính vào thống kê và bảng",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-034"] },
  async ({ homeData, homeSession, homeDashboardPage: home }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Failed");
    await homeData.result(user.userId, { ...pair, score: 80, createdAt: new Date(Date.now() - 3 * 60_000) });
    await homeData.result(user.userId, { ...pair, score: 70, createdAt: new Date(Date.now() - 2 * 60_000) });
    const failed = await homeData.result(user.userId, { ...pair, score: 0, status: "failed" });
    await homeSession.use(user);

    await home.goto();
    await home.waitForDashboard();

    await expect(home.statFigure("totalMatches", 2)).toBeVisible();
    await expect(home.highestMeter()).toHaveAttribute("aria-valuenow", "80");
    await expect(home.averageLine(75)).toBeVisible();
    await expect(home.recentRows()).toHaveCount(2);
    await expect(home.scoreCell(failed)).toHaveCount(0);
  }
);

test(
  "tải trang chủ chỉ gọi các endpoint đọc, không gọi AI",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-035"] },
  async ({ homeData, homeSession, homeDashboardPage: home, network }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "ReadOnly");
    await homeData.result(user.userId, pair);
    await homeSession.use(user);
    const calls = network.recordRequests(API_CALL);

    await home.goto();
    await expect(home.recentRow(pair.cvTitle, pair.jdTitle)).toBeVisible();
    await expect(home.statFigure("savedCvs", 1)).toBeVisible();

    const seen = new Set(
      calls.map((c) => {
        const url = new URL(c.url);
        const query = [...url.searchParams.entries()].sort().map(([k, v]) => `${k}=${v}`).join("&");
        return `${c.method} ${url.pathname.replace(/^.*\/api\/v1/, "")}${query ? `?${query}` : ""}`;
      })
    );
    expect([...seen].sort()).toEqual([
      "GET /auth/me",
      "GET /documents?kind=CV&saved=true",
      "GET /documents?kind=JD&saved=true",
      "GET /match",
    ]);
  }
);

test(
  "GET /match lỗi thì trang chủ báo lỗi thay vì \"No matches yet\"",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-036"] },
  async ({ homeData, homeSession, homeDashboardPage: home, network }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "MatchDown");
    await homeData.result(user.userId, pair);
    await homeSession.use(user);
    await network.failWith("**/api/v1/match", 500, { method: "GET" });

    await home.goto();
    await home.waitForDashboard();

    // React Query retries 3 times (~7 s) before the query is in error.
    await expect(home.errorAlert()).toBeVisible({ timeout: 20_000 });
    await expect(home.emptyText()).toHaveCount(0);
    await expect(home.statFigure("totalMatches", 0)).toHaveCount(0);
  }
);

test(
  "GET /documents lỗi thì thẻ thống kê báo lỗi thay vì số 0",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-037"] },
  async ({ homeData, homeSession, homeDashboardPage: home, network }) => {
    const user = await homeData.signedIn();
    await homeData.document(user.userId, "CV");
    await homeData.document(user.userId, "CV");
    await homeSession.use(user);
    await network.failWith("**/api/v1/documents?**", 500, { method: "GET" });

    await home.goto();
    await home.waitForDashboard();

    await expect(home.errorAlert()).toBeVisible({ timeout: 20_000 });
    await expect(home.statFigure("savedCvs", 0)).toHaveCount(0);
  }
);
