import { test, expect } from "@/fixtures";

// Infrastructure smoke, ported from server/test/app-config.e2e-spec.ts. The in-process suite mounted Swagger itself
// (mirroring main.ts); over HTTP this asserts the running server's own mount. No test case — not product behaviour.

test.describe("App config (e2e)", () => {
  test("Swagger docs served", async ({ http }) => {
    const res = await http().get("/docs", { maxRedirects: 1 });
    expect([200, 301]).toContain(res.status);
  });
});
