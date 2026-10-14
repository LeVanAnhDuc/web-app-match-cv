import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";

// REQ-INFRA-09: nestjs-i18n resolves ?lang= first, then Accept-Language, fallback en. Probed on the anonymous 401 of
// GET /me/export, whose message comes from server/src/i18n/<lng>/auth.json.

const KEY = "auth.errors.signInRequired" as const;

test.describe("server message language", () => {
  test("message server theo tham số lang", { tag: ["@TC-INFRA-018"] }, async ({ anonApi }) => {
    const res = await anonApi.me.export({ params: { lang: "vi" } });

    expect(res.status).toBe(401);
    expect(res.error().code).toBe("SIGN_IN_REQUIRED");
    expect(res.error().message).toBe(serverMessage(KEY, "vi"));
  });

  test("message server theo Accept-Language khi không có lang", { tag: ["@TC-INFRA-019"] }, async ({ anonApi }) => {
    const res = await anonApi.lang("vi").me.export();

    expect(res.status).toBe(401);
    expect(res.error().message).toBe(serverMessage(KEY, "vi"));
  });

  test("tham số lang thắng Accept-Language", { tag: ["@TC-INFRA-020"] }, async ({ anonApi }) => {
    const res = await anonApi.lang("vi").me.export({ params: { lang: "en" } });

    expect(res.status).toBe(401);
    expect(res.error().message).toBe(serverMessage(KEY, "en"));
  });

  test("ngôn ngữ thiếu hoặc không hỗ trợ rơi về tiếng Anh", { tag: ["@TC-INFRA-021"] }, async ({ anonApi }) => {
    const responses = [
      await anonApi.me.export(),
      await anonApi.me.export({ params: { lang: "fr" } }),
      await anonApi.me.export({ headers: { "Accept-Language": "fr" } }),
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.error().message).toBe(serverMessage(KEY, "en"));
    }
  });
});
