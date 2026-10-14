import { test, expect } from "@/fixtures";

// REQ-INFRA-01, -02: liveness endpoint, public for every caller, and the /api/v1 global prefix.

test.describe("health", () => {
  test("health ẩn danh trả 200 status ok và không set cookie", { tag: ["@TC-INFRA-001", "@smoke"] }, async ({ anonApi }) => {
    const res = await anonApi.health.check();

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.json()).toEqual({ status: "ok" });
    expect(res.setCookies).toEqual([]);
  });

  test(
    "health trả 200 với phiên user và phiên khách mà không đổi cookie",
    { tag: ["@TC-INFRA-002", "@creates-data"] },
    async ({ apiAs, infraUsers }) => {
      for (const caller of [await infraUsers.signedIn(), await infraUsers.guest()]) {
        const res = await apiAs(caller).health.check();

        expect(res.status).toBe(200);
        expect(res.json()).toEqual({ status: "ok" });
        expect(res.setCookies).toEqual([]);
      }
    }
  );

  test("health vẫn 200 khi cookie phiên giả", { tag: ["@TC-INFRA-003"] }, async ({ apiAs }) => {
    const res = await apiAs("mcv_session=forged-token-that-matches-no-session").health.check();

    expect(res.status).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  test("đường dẫn ngoài tiền tố api v1 trả 404", { tag: ["@TC-INFRA-004"] }, async ({ infraRootApi }) => {
    expect((await infraRootApi.raw.get("/api/v1/health")).status).toBe(200);
    expect((await infraRootApi.raw.get("/health")).status).toBe(404);
    expect((await infraRootApi.raw.get("/api/v2/health")).status).toBe(404);
  });
});
