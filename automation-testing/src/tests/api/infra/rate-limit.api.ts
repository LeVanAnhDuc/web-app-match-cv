import { test, expect } from "@/fixtures";
import { LEAK_PATTERNS, RATE_LIMIT } from "@/data/test-data/infra";

// REQ-INFRA-05: global ThrottlerGuard, 100 req / 60 s per IP and per route. The 429 case uses the infra slot's
// single-shot probe: the shared client waits out Retry-After and retries, which would hide the 429 (decision Q7).
// After it, /health stays throttled for this IP for up to 60 s; other callers of /health only get slower.

test.describe("rate limit", () => {
  test("response API báo hạn mức 100 request mỗi phút", { tag: ["@TC-INFRA-009"] }, async ({ anonApi }) => {
    const res = await anonApi.auth.me();

    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe(String(RATE_LIMIT.limit));
    const remaining = Number(res.headers["x-ratelimit-remaining"]);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThan(RATE_LIMIT.limit);
  });

  test(
    "vượt 100 request trong 60 giây trên health trả 429 kèm Retry-After",
    { tag: ["@TC-INFRA-010"] },
    async ({ infraProbe }) => {
      const statuses: number[] = [];
      let throttled: Awaited<ReturnType<typeof infraProbe>> | undefined;
      for (let i = 0; i <= RATE_LIMIT.limit && !throttled; i += 1) {
        const res = await infraProbe("GET", "/health");
        statuses.push(res.status);
        if (res.status === 429) throttled = res;
      }

      expect(throttled, `no 429 after ${statuses.length} requests`).toBeDefined();
      const before = statuses.slice(0, -1);
      expect(before.every((s) => s === 200)).toBe(true);
      expect(before.length).toBeLessThanOrEqual(RATE_LIMIT.limit);
      const retryAfter = Number(throttled!.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(RATE_LIMIT.ttlSeconds);
      for (const leak of LEAK_PATTERNS) expect(throttled!.text).not.toMatch(leak);
    }
  );
});
