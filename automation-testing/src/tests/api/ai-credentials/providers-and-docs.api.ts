import { PLACEHOLDER_KEY_EXAMPLE, PROVIDERS } from "@/data/test-data/ai-credentials";
import type { SeededUser } from "@/utils/sessions";
import { expect, test } from "@/fixtures";

// The provider whitelist (REQ-AICREDENTIALS-14, -04) and what Swagger says about the key (REQ-AICREDENTIALS-43).

interface SchemaProperty {
  writeOnly?: boolean;
  example?: unknown;
}
interface OpenApiWithSchemas {
  components?: { schemas?: Record<string, { properties?: Record<string, SchemaProperty> }> };
}

test.describe("ai-credentials — providers and Swagger", () => {
  let user: SeededUser;

  test.beforeAll(async ({ aiCredData }) => {
    user = await aiCredData.createSignedInUser();
  });

  test.afterAll(async ({ aiCredData }) => {
    await aiCredData.deleteUsers([user.userId]);
  });

  test(
    "/providers trả đúng 3 provider với nhãn và model mặc định",
    { tag: ["@TC-AICREDENTIALS-016"] },
    async ({ apiAs }) => {
      const res = await apiAs(user).aiCredentials.providers();

      expect(res.status).toBe(200);
      expect(res.json()).toEqual(PROVIDERS);
      for (const provider of res.json()) {
        expect(Object.keys(provider).sort()).toEqual(["defaultChatModel", "defaultEmbedModel", "id", "label"]);
      }
    }
  );

  test(
    "/providers không bị route :id nuốt",
    { tag: ["@TC-AICREDENTIALS-017"] },
    async ({ apiAs }) => {
      // Were "providers" captured by GET/PATCH ":id", ParseUUIDPipe would answer 400.
      const res = await apiAs(user).aiCredentials.providers();
      expect(res.status).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    }
  );

  test(
    "Swagger đánh apiKey writeOnly, ví dụ chỉ là placeholder",
    { tag: ["@TC-AICREDENTIALS-064"] },
    async ({ anonApi }) => {
      const res = await anonApi.docs.json();
      expect(res.status).toBe(200);
      const schemas = (res.body as OpenApiWithSchemas).components?.schemas ?? {};

      for (const name of ["CreateAiCredentialDto", "UpdateAiCredentialDto"]) {
        const apiKey = schemas[name]?.properties?.apiKey;
        expect(apiKey, `${name}.apiKey`).toBeDefined();
        expect(apiKey!.writeOnly, `${name}.apiKey.writeOnly`).toBe(true);
        expect(String(apiKey!.example), `${name}.apiKey.example`).toMatch(PLACEHOLDER_KEY_EXAMPLE);
      }
      // The response DTO never documents a key at all.
      expect(Object.keys(schemas.AiCredentialDto?.properties ?? {})).not.toContain("apiKey");

      // No example anywhere in the document looks like a real provider key.
      const examples = [...res.text.matchAll(/"example":\s*"(sk-[^"]*)"/g)].map((m) => m[1]);
      for (const example of examples) expect(example).toMatch(PLACEHOLDER_KEY_EXAMPLE);
    }
  );
});
