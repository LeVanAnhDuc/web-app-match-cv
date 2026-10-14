import { test, expect } from "@/fixtures";
import { OPENAPI_TAGS, SECRET_FIELDS, SHIPPED_OPERATIONS, SWAGGER, realLookingKeys } from "@/data/test-data/infra";

// REQ-INFRA-03, -04: Swagger UI + OpenAPI contract of the running server (mounted in every env — D4, tested on dev).

type Schema = { properties?: Record<string, { writeOnly?: boolean }> };
type Operation = { tags?: string[]; responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> };
type OpenApi = {
  info: { title: string };
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
};

test.describe("swagger", () => {
  test("Swagger UI phục vụ tại api v1 docs", { tag: ["@TC-INFRA-005"] }, async ({ anonApi }) => {
    const res = await anonApi.docs.ui({ maxRedirects: 1 });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain(SWAGGER.uiTitle);
  });

  test("OpenAPI liệt kê đủ endpoint đang ship dưới đúng tag", { tag: ["@TC-INFRA-006"] }, async ({ anonApi }) => {
    const res = await anonApi.docs.json();
    expect(res.status).toBe(200);
    const doc = res.body as OpenApi;

    expect(doc.info.title).toBe(SWAGGER.apiTitle);
    const documented = Object.entries(doc.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`)
    );
    expect(documented).toEqual(expect.arrayContaining([...SHIPPED_OPERATIONS]));
    const tags = new Set(Object.values(doc.paths).flatMap((ops) => Object.values(ops).flatMap((op) => op.tags ?? [])));
    expect([...tags]).toEqual(expect.arrayContaining([...OPENAPI_TAGS]));
  });

  test("OpenAPI không lộ trường mã hóa hay token AI", { tag: ["@TC-INFRA-007", "@smoke"] }, async ({ anonApi }) => {
    const res = await anonApi.docs.json();
    expect(res.status).toBe(200);
    const schemas = (res.body as OpenApi).components?.schemas ?? {};

    for (const field of SECRET_FIELDS) expect(res.text).not.toContain(field);
    expect(realLookingKeys(res.text)).toEqual([]);
    expect(schemas.CreateAiCredentialDto?.properties?.apiKey?.writeOnly).toBe(true);
    expect(schemas.UpdateAiCredentialDto?.properties?.apiKey?.writeOnly).toBe(true);
    expect(schemas.AiCredentialDto?.properties).toBeDefined();
    expect(Object.keys(schemas.AiCredentialDto?.properties ?? {})).not.toContain("apiKey");
  });

  test(
    "OpenAPI khai export dữ liệu là application zip không kèm schema",
    { tag: ["@TC-INFRA-008"] },
    async ({ anonApi }) => {
      const res = await anonApi.docs.json();
      expect(res.status).toBe(200);
      const content = (res.body as OpenApi).paths["/api/v1/me/export"]?.get?.responses?.["200"]?.content;

      expect(Object.keys(content ?? {})).toEqual(["application/zip"]);
      expect(content?.["application/zip"]?.schema).toBeUndefined();
    }
  );
});
