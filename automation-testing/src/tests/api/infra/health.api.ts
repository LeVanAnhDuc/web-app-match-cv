import { test, expect } from "@/fixtures";

// Infrastructure smoke, ported from server/test/health.e2e-spec.ts. No test case — not product behaviour.

test.describe("Health (e2e)", () => {
  test("GET /api/v1/health → 200 ok", async ({ http }) => {
    const res = await http().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
