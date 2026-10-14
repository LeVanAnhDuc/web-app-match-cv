import { test, expect } from "@/fixtures";
import { AUTH_THROTTLE_LIMIT } from "@/data/test-data/auth";

// Throttle on the sign-in routes (REQ-AUTH-23) and the CORS policy (REQ-AUTH-24).
// The throttle case runs on a throw-away instance (decision T2): its counters are its own, so it neither slows the
// other sign-in specs nor locks the dev server's /auth routes for a minute.

test.describe("Sign-in hardening", () => {
  test(
    "login và callback chặn 429 sau 20 request trong một phút",
    { tag: ["@TC-AUTH-039"] },
    async ({ authSpawnServer }) => {
      const { hitOnce } = await authSpawnServer("fake-idp");
      for (const path of ["/auth/callback?code=c&state=s", "/auth/login?returnTo=%2F"]) {
        for (let i = 1; i <= AUTH_THROTTLE_LIMIT; i += 1) {
          expect(await hitOnce(path), `${path} #${i}`).toBe(302);
        }
        expect(await hitOnce(path), `${path} #${AUTH_THROTTLE_LIMIT + 1}`).toBe(429);
      }
      // Other routes keep the looser global limit.
      expect(await hitOnce("/auth/me")).toBe(200);
    }
  );

  test(
    "CORS chỉ cho CLIENT_ORIGIN kèm credentials, không phản chiếu origin lạ",
    { tag: ["@TC-AUTH-040"] },
    async ({ anonApi, urls }) => {
      const own = await anonApi.auth.me({ headers: { Origin: urls.webUrl } });
      expect(own.headers["access-control-allow-origin"]).toBe(urls.webUrl);
      expect(own.headers["access-control-allow-credentials"]).toBe("true");

      for (const origin of ["http://evil.test", "http://localhost:5999", "null"]) {
        const res = await anonApi.auth.me({ headers: { Origin: origin } });
        expect(res.headers["access-control-allow-origin"], origin).not.toBe(origin);
        expect(res.headers["access-control-allow-origin"], origin).not.toBe("*");
      }
    }
  );
});
