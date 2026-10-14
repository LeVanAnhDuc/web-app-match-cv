import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";

// POST /cv-rewrite, only the branches decided BEFORE the provider call (D1): unknown match, failed match, validation.
// A succeeded match of the caller would reach the real model, so no test here sends one — that path is @live-ai
// (live-ai.api.ts) and, in the browser, a page.route stub.

test.describe("cv rewrite — generate (before the provider)", () => {
  test(
    "match không tồn tại trả 404",
    { tag: ["@TC-CVREWRITEASSISTANT-006", "@creates-data"] },
    async ({ rewriteUsers }) => {
      const me = await rewriteUsers.signedIn();

      const res = await me.api.cvRewrite.generate({ matchResultId: randomUUID() });

      expect(res.status).toBe(404);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.matchNotFound"));
    }
  );

  test(
    "match thất bại không có gì để viết lại",
    { tag: ["@TC-CVREWRITEASSISTANT-007", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const failed = await rewriteData.match({ userId: me.userId, status: "failed" });
      const body = { matchResultId: failed.matchId };

      const en = await me.api.cvRewrite.generate(body);
      expect(en.status).toBe(400);
      expect(en.error().message).toBe(serverMessage("cvRewrite.errors.matchFailed"));

      const viHeader = await me.api.lang("vi").cvRewrite.generate(body);
      expect(viHeader.status).toBe(400);
      expect(viHeader.error().message).toBe(serverMessage("cvRewrite.errors.matchFailed", "vi"));

      const viQuery = await me.api.cvRewrite.generate(body, { params: { lang: "vi" } });
      expect(viQuery.status).toBe(400);
      expect(viQuery.error().message).toBe(serverMessage("cvRewrite.errors.matchFailed", "vi"));
    }
  );

  test(
    "body sinh sai kiểu bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-008", "@creates-data"] },
    async ({ rewriteUsers }) => {
      const me = await rewriteUsers.signedIn();
      // matchResultId is always unknown, so even a validation gap would stop at 404 — never at the provider.
      const bodies: Array<Record<string, unknown>> = [
        {},
        { matchResultId: "not-a-uuid" },
        { matchResultId: randomUUID(), credentialId: "nope" },
      ];
      for (const body of bodies) {
        const res = await me.api.cvRewrite.generate(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
    }
  );
});
