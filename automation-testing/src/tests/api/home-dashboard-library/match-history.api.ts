import { randomUUID } from "node:crypto";
import { serverMessage } from "@/data/copy";
import { ISO_UTC, NEAR_MIDNIGHT_UTC, daysAgo, reportFor } from "@/data/test-data/home-dashboard-library";
import { expect, test } from "@/fixtures";

// GET /match (history) and GET /match/:id (re-open a stored report). No AI: every result is seeded in the DB
// (decisions Q3) under throwaway users from homeData, deleted after each test.

test.describe("GET /match — history", () => {
  test(
    "GET /match trả lịch sử của chính user, mới nhất trước, đủ trường",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-001", "@smoke"] },
    async ({ homeData, apiAs }) => {
      const user = await homeData.signedIn();
      const pair = await homeData.pair(user.userId, "History");
      const oldest = await homeData.result(user.userId, { ...pair, score: 41, createdAt: daysAgo(3) });
      const newest = await homeData.result(user.userId, { ...pair, score: 87, createdAt: daysAgo(1) });
      const middle = await homeData.result(user.userId, { ...pair, score: 64, createdAt: daysAgo(2) });

      const res = await apiAs(user).match.list();

      expect(res.status).toBe(200);
      const history = res.json();
      expect(history.map((m) => m.id)).toEqual([newest, middle, oldest]);
      expect(history.map((m) => m.overallScore)).toEqual([87, 64, 41]);
      for (const item of history) {
        expect(Object.keys(item).sort()).toEqual(["createdAt", "cvTitle", "id", "jdTitle", "overallScore"]);
        expect(item.cvTitle).toBe(pair.cvTitle);
        expect(item.jdTitle).toBe(pair.jdTitle);
      }
    }
  );

  test(
    "đổi tên tài liệu thì lịch sử hiện tên mới",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-002"] },
    async ({ homeData, apiAs }) => {
      const user = await homeData.signedIn();
      const pair = await homeData.pair(user.userId, "Rename");
      const id = await homeData.result(user.userId, pair);
      const renamed = `${pair.cvTitle} renamed`;

      const rename = await apiAs(user).documents.rename(pair.cvId, renamed);
      expect(rename.status).toBe(200);

      const [item] = (await apiAs(user).match.list()).json();
      expect(item.id).toBe(id);
      expect(item.cvTitle).toBe(renamed);
      expect(item.jdTitle).toBe(pair.jdTitle);
    }
  );

  test("user chưa chạy match nào nhận mảng rỗng", { tag: ["@TC-HOMEDASHBOARDLIBRARY-003"] }, async ({ homeData, apiAs }) => {
    const user = await homeData.signedIn();

    const res = await apiAs(user).match.list();

    expect(res.status).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test(
    "GET /match không có phiên trả 401 SIGN_IN_REQUIRED",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-004", "@smoke"] },
    async ({ anonApi }) => {
      const res = await anonApi.match.list();

      expect(res.status).toBe(401);
      expect(res.error().code).toBe("SIGN_IN_REQUIRED");
      expect(res.error().message).toBe(serverMessage("auth.errors.signInRequired"));
    }
  );

  test(
    "GET /match bằng phiên khách trả 401, kể cả khi khách đã có kết quả",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-005"] },
    async ({ homeData, apiAs }) => {
      const guest = await homeData.guest();
      const pair = await homeData.pair(guest.userId, "Guest");
      const id = await homeData.result(guest.userId, pair);

      const res = await apiAs(guest).match.list();

      expect(res.status).toBe(401);
      expect(res.error().code).toBe("SIGN_IN_REQUIRED");
      expect(res.text).not.toContain(id);
    }
  );

  test("thông báo 401 của GET /match theo tiếng Việt", { tag: ["@TC-HOMEDASHBOARDLIBRARY-006"] }, async ({ anonApi }) => {
    const res = await anonApi.lang("vi").match.list();

    expect(res.status).toBe(401);
    expect(res.error().message).toBe(serverMessage("auth.errors.signInRequired", "vi"));
  });

  test(
    "kết quả của user khác không bao giờ xuất hiện trong GET /match",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-007", "@smoke"] },
    async ({ homeData, apiAs }) => {
      const userA = await homeData.signedIn();
      const pairA = await homeData.pair(userA.userId, "Mine");
      const mine = await homeData.result(userA.userId, pairA);
      const userB = await homeData.signedIn();
      const pairB = await homeData.pair(userB.userId, "Theirs");
      const theirs = [
        await homeData.result(userB.userId, { ...pairB, score: 90 }),
        await homeData.result(userB.userId, { ...pairB, score: 20 }),
      ];

      const ids = (await apiAs(userA).match.list()).json().map((m) => m.id);

      expect(ids).toEqual([mine]);
      for (const id of theirs) expect(ids).not.toContain(id);
    }
  );
});

test.describe("GET /match/:id — stored report", () => {
  test(
    "GET /match/:id của user khác và id không tồn tại trả cùng một 404",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-008", "@smoke"] },
    async ({ homeData, apiAs }) => {
      const userA = await homeData.signedIn();
      const userB = await homeData.signedIn();
      const pairB = await homeData.pair(userB.userId, "Private");
      const theirs = await homeData.result(userB.userId, pairB);

      const foreign = await apiAs(userA).match.get(theirs);
      const missing = await apiAs(userA).match.get(randomUUID());

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.error().message).toBe(serverMessage("matching.errors.matchNotFound"));
      expect(foreign.body).toEqual(missing.body);
    }
  );

  test("GET /match/:id với id không phải UUID trả 400", { tag: ["@TC-HOMEDASHBOARDLIBRARY-009"] }, async ({ homeData, apiAs }) => {
    const user = await homeData.signedIn();

    for (const id of ["not-a-uuid", "123"]) {
      const res = await apiAs(user).match.get(id);
      expect(res.status, `GET /match/${id}`).toBe(400);
    }
  });

  test("thông báo 404 của GET /match/:id theo tiếng Việt", { tag: ["@TC-HOMEDASHBOARDLIBRARY-010"] }, async ({ homeData, apiAs }) => {
    const user = await homeData.signedIn();

    const res = await apiAs(user).lang("vi").match.get(randomUUID());

    expect(res.status).toBe(404);
    expect(res.error().message).toBe(serverMessage("matching.errors.matchNotFound", "vi"));
  });

  test(
    "user đọc lại kết quả của mình đúng như lúc chấm",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-011", "@smoke"] },
    async ({ homeData, apiAs }) => {
      const user = await homeData.signedIn();
      const pair = await homeData.pair(user.userId, "Reopen");
      const report = reportFor("reopen");
      const id = await homeData.result(user.userId, { ...pair, scores: [73, 88, 50], report });

      const first = await apiAs(user).match.get(id);
      const second = await apiAs(user).match.get(id);

      expect(first.status).toBe(200);
      const stored = first.json();
      expect(stored).toMatchObject({
        id,
        cvDocumentId: pair.cvId,
        jdDocumentId: pair.jdId,
        overallScore: 73,
        semanticScore: 88,
        keywordScore: 50,
        status: "succeeded",
      });
      expect(stored.report).toEqual(report);
      expect(second.body).toEqual(first.body);
      // Re-opening is a read: no new result was produced.
      expect((await apiAs(user).match.list()).json().map((m) => m.id)).toEqual([id]);
    }
  );

  test("khách đọc lại kết quả của chính mình", { tag: ["@TC-HOMEDASHBOARDLIBRARY-012"] }, async ({ homeData, apiAs }) => {
    const guest = await homeData.guest();
    const pair = await homeData.pair(guest.userId, "GuestReopen");
    const report = reportFor("guest");
    const id = await homeData.result(guest.userId, { ...pair, scores: [55, 60, 47], report });

    const res = await apiAs(guest).match.get(id);

    expect(res.status).toBe(200);
    expect(res.json()).toMatchObject({ id, overallScore: 55, semanticScore: 60, keywordScore: 47 });
    expect(res.json().report).toEqual(report);
  });

  test(
    "khách không đọc được kết quả của khách khác, người chưa đăng nhập bị 401",
    { tag: ["@TC-HOMEDASHBOARDLIBRARY-013"] },
    async ({ homeData, apiAs, anonApi }) => {
      const owner = await homeData.guest();
      const pair = await homeData.pair(owner.userId, "GuestPrivate");
      const id = await homeData.result(owner.userId, pair);
      const other = await homeData.guest();

      const foreign = await apiAs(other).match.get(id);
      const anonymous = await anonApi.match.get(id);

      expect(foreign.status).toBe(404);
      expect(foreign.error().message).toBe(serverMessage("matching.errors.matchNotFound"));
      expect(anonymous.status).toBe(401);
      expect(anonymous.error().code).toBe("SIGN_IN_REQUIRED");
    }
  );
});

test(
  "createdAt là ISO UTC có hậu tố Z, đúng thời điểm đã lưu",
  { tag: ["@TC-HOMEDASHBOARDLIBRARY-014"] },
  async ({ homeData, apiAs }) => {
    const user = await homeData.signedIn();
    const pair = await homeData.pair(user.userId, "Utc");
    await homeData.result(user.userId, { ...pair, createdAt: NEAR_MIDNIGHT_UTC });

    const [item] = (await apiAs(user).match.list()).json();

    expect(item.createdAt).toMatch(ISO_UTC);
    expect(new Date(item.createdAt).toISOString()).toBe(NEAR_MIDNIGHT_UTC);
  }
);
