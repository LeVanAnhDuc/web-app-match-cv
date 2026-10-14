import { expect, test } from "@/fixtures";
import { GENERATE_LIMIT_PER_MINUTE, GLOBAL_LIMIT_PER_MINUTE } from "@/data/test-data/cover-letter-generator";

// POST /cover-letters is throttled tighter than the rest (REQ-COVERLETTERGENERATOR-13). The throttler runs before the
// auth guard, so anonymous calls (401, no DB write, no AI) count toward the same per-IP bucket: the burst below spends
// nothing. This file exhausts that bucket for ~60 s, so it is named to run after the other cover-letter API files.

test.describe("cover letters — throttle", () => {
  test(
    "POST /cover-letters allows 10 calls per minute, the next one is 429; other routes keep the global limit",
    { tag: ["@TC-COVERLETTERGENERATOR-026"] },
    async ({ coverLetterRawApi }) => {
      const body = { tone: "formal", length: "standard", language: "en" };

      const first = await coverLetterRawApi.coverLetters.generate(body);
      expect(first.status).toBe(401);
      expect(first.headers["x-ratelimit-limit"]).toBe(String(GENERATE_LIMIT_PER_MINUTE));

      // Spend the rest of the window. Earlier specs may already have used part of it, so stop at the first 429:
      // `remaining` says exactly when it must come.
      let remaining = Number(first.headers["x-ratelimit-remaining"]);
      let throttled: unknown;
      for (let call = 0; call <= GENERATE_LIMIT_PER_MINUTE && throttled === undefined; call += 1) {
        const expectThrottle = remaining === 0;
        const res = await coverLetterRawApi.coverLetters.generate(body).catch((error: unknown) => {
          throttled = error;
          return undefined;
        });
        if (res === undefined) {
          expect(expectThrottle, "429 came before the 10-per-minute budget was spent").toBe(true);
        } else {
          expect(expectThrottle, "a call went through after remaining reached 0").toBe(false);
          expect(res.status).toBe(401);
          remaining = Number(res.headers["x-ratelimit-remaining"]);
        }
      }
      // coverLetterRawApi turns a throttler 429 (Retry-After present) into this error instead of waiting it out.
      expect(String(throttled)).toContain("throttled: 429");

      const list = await coverLetterRawApi.coverLetters.list(undefined);
      expect(list.status).toBe(401);
      expect(list.headers["x-ratelimit-limit"]).toBe(String(GLOBAL_LIMIT_PER_MINUTE));
    }
  );
});
