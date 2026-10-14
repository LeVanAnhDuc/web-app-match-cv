import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { API_BULLET, API_REWORDED } from "@/data/test-data/cv-rewrite-assistant";

// Route throttles of the rewrite endpoints (REQ-15): POST /cv-rewrite 10/60s, POST /cv-rewrite/accept 20/60s, keyed
// by IP + route. Sent through `rewriteOnce` (one request, no retry): the suite's http client waits a 429 out.
// Every request names an unknown match, so it ends in 404 before any provider; the throttler counts it anyway.
//
// The counter is sliding and shared with whatever ran in the last minute, so each test first drives the route into
// its block, waits for the block to lapse (@nestjs/throttler then resets the counter to 0 and counts that request as
// the first hit), sends the rest of the budget, and expects the next one to be refused. Afterwards it waits the block
// out again so later specs never inherit a 429. Up to ~2.5 min per test.
test.describe.configure({ timeout: 240_000 });

const WINDOW_MS = 60_000;

type Send = () => Promise<{ status: number }>;

async function exhaustThenReset(send: Send, limit: number): Promise<void> {
  // 1. Into the block (at most limit + 1 requests).
  let blocked = false;
  for (let i = 0; i <= limit && !blocked; i += 1) blocked = (await send()).status === 429;
  expect(blocked, "the route never answered 429").toBe(true);
  // 2. Out of it: the first non-429 is hit #1 of a fresh window.
  await expect
    .poll(async () => (await send()).status, { timeout: WINDOW_MS + 30_000, intervals: [5_000] })
    .not.toBe(429);
}

async function waitOutBlock(send: Send): Promise<void> {
  await expect
    .poll(async () => (await send()).status, { timeout: WINDOW_MS + 30_000, intervals: [5_000] })
    .not.toBe(429);
}

test.describe("cv rewrite — throttle", () => {
  test(
    "sinh đề xuất giới hạn 10 request mỗi phút",
    { tag: ["@TC-CVREWRITEASSISTANT-027", "@creates-data"] },
    async ({ rewriteUsers, rewriteOnce }) => {
      const me = await rewriteUsers.signedIn();
      const send = () => rewriteOnce("/cv-rewrite", { matchResultId: randomUUID() }, me.cookie);

      await exhaustThenReset(send, 10);
      // Hit #1 was the poll above; nine more stay within the limit.
      for (let hit = 2; hit <= 10; hit += 1) expect((await send()).status, `hit ${hit}`).toBe(404);
      const eleventh = await send();
      expect(eleventh.status).toBe(429);
      expect(Number(eleventh.headers["retry-after"])).toBeGreaterThan(0);

      await waitOutBlock(send);
    }
  );

  test(
    "lưu bản viết lại giới hạn 20 request mỗi phút",
    { tag: ["@TC-CVREWRITEASSISTANT-028", "@creates-data"] },
    async ({ rewriteUsers, rewriteOnce }) => {
      const me = await rewriteUsers.signedIn();
      const send = () =>
        rewriteOnce(
          "/cv-rewrite/accept",
          {
            matchResultId: randomUUID(),
            title: "Throttled",
            changes: [{ original: API_BULLET, replacement: API_REWORDED }],
          },
          me.cookie
        );

      await exhaustThenReset(send, 20);
      for (let hit = 2; hit <= 20; hit += 1) expect((await send()).status, `hit ${hit}`).toBe(404);
      expect((await send()).status).toBe(429);

      await waitOutBlock(send);
    }
  );
});
