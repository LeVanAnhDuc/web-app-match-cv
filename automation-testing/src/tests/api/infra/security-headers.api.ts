import { test, expect } from "@/fixtures";
import { HELMET_HEADERS } from "@/data/test-data/infra";

// REQ-INFRA-06: helmet() in server/src/main.ts runs before routing, so success and error responses carry it alike.

test("response API có header helmet và không có X-Powered-By", { tag: ["@TC-INFRA-011"] }, async ({ anonApi }) => {
  const responses = {
    ok: await anonApi.health.check(),
    unauthorized: await anonApi.me.export(),
    notFound: await anonApi.raw.get("/no-such-route"),
  };
  expect(responses.ok.status).toBe(200);
  expect(responses.unauthorized.status).toBe(401);
  expect(responses.notFound.status).toBe(404);

  for (const [name, res] of Object.entries(responses)) {
    for (const [header, value] of Object.entries(HELMET_HEADERS)) {
      if (typeof value === "string") expect(res.headers[header], `${name}: ${header}`).toBe(value);
      else expect(res.headers[header], `${name}: ${header}`).toMatch(value);
    }
    expect(res.headers["x-powered-by"], `${name}: x-powered-by`).toBeUndefined();
  }
});
