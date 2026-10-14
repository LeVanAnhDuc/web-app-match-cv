import { test, expect } from "@/fixtures";
import { foreignOrigins } from "@/data/test-data/infra";

// REQ-INFRA-07: enableCors({ origin: CLIENT_ORIGIN, credentials: true }). The web origin of the run is CLIENT_ORIGIN
// (a worktree on other ports sets both E2E_BASE_URL and the API's CLIENT_ORIGIN — src/config/urls.ts).

const preflight = (origin: string) => ({
  headers: {
    Origin: origin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
  },
});

test.describe("cors", () => {
  test(
    "CORS cho phép origin web kèm credentials",
    { tag: ["@TC-INFRA-012", "@smoke"] },
    async ({ anonApi, infraProbe, urls }) => {
      const webOrigin = new URL(urls.webUrl).origin;

      const simple = await anonApi.health.check({ headers: { Origin: webOrigin } });
      expect(simple.status).toBe(200);
      expect(simple.headers["access-control-allow-origin"]).toBe(webOrigin);
      expect(simple.headers["access-control-allow-credentials"]).toBe("true");

      const pre = await infraProbe("OPTIONS", "/documents", preflight(webOrigin));
      expect(pre.status).toBe(204);
      expect(pre.headers["access-control-allow-origin"]).toBe(webOrigin);
      expect(pre.headers["access-control-allow-credentials"]).toBe("true");
      const methods = (pre.headers["access-control-allow-methods"] ?? "").split(",").map((m) => m.trim());
      expect(methods).toEqual(expect.arrayContaining(["POST", "PATCH", "DELETE"]));
    }
  );

  test("CORS không phản hồi lại origin lạ", { tag: ["@TC-INFRA-013"] }, async ({ anonApi, infraProbe, urls }) => {
    for (const origin of foreignOrigins(new URL(urls.webUrl).origin)) {
      const simple = await anonApi.health.check({ headers: { Origin: origin } });
      const pre = await infraProbe("OPTIONS", "/documents", preflight(origin));

      for (const res of [simple, pre]) {
        const allowed = res.headers["access-control-allow-origin"];
        expect(allowed, `${origin} echoed back`).not.toBe(origin);
        expect(allowed, `${origin} got *`).not.toBe("*");
      }
    }
  });
});
