import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { LEAK_PATTERNS, MALFORMED_JSON, SAMPLE_CV_TEXT, TITLE_OVER_LIMIT } from "@/data/test-data/infra";
import { uniqueSuffix } from "@/data/test-data/shared";

// REQ-INFRA-08: global ValidationPipe({ whitelist: true, transform: true }) + body-parser errors. POST /documents is
// the representative DTO; callers are signed in, so no guest is minted by these requests.

test.describe("validation", () => {
  test(
    "field lạ trong body bị loại và không ghi đè id hay chủ sở hữu",
    { tag: ["@TC-INFRA-015", "@smoke", "@creates-data"] },
    async ({ apiAs, infraUsers }) => {
      const owner = await infraUsers.signedIn();
      const other = await infraUsers.signedIn();
      const forgedId = randomUUID();

      const res = await apiAs(owner).documents.create({
        kind: "CV",
        save: true,
        title: `infra-whitelist-${uniqueSuffix()}`,
        sourceText: SAMPLE_CV_TEXT,
        id: forgedId,
        userId: other.userId,
        parentId: forgedId,
        isGuest: true,
      });

      expect(res.status).toBe(201);
      const doc = res.json();
      expect(doc.id).not.toBe(forgedId);
      expect(doc.parentId).toBeNull();
      expect((await apiAs(owner).documents.get(doc.id)).status).toBe(200);
      expect((await apiAs(other).documents.get(doc.id)).status).toBe(404);
    }
  );

  test(
    "body sai DTO trả 400 nêu tên field",
    { tag: ["@TC-INFRA-016", "@creates-data"] },
    async ({ apiAs, infraUsers }) => {
      const user = await infraUsers.signedIn();

      const res = await apiAs(user).documents.create({
        kind: "RESUME",
        save: true,
        title: TITLE_OVER_LIMIT,
        sourceText: SAMPLE_CV_TEXT,
      });

      expect(res.status).toBe(400);
      const err = res.error();
      expect(err.statusCode).toBe(400);
      expect(err.error).toBe("Bad Request");
      expect(Array.isArray(err.message)).toBe(true);
      const messages = err.message as string[];
      // Messages are human sentences ("Title must be at most 200 characters."), so match the field name, not its case.
      expect(messages.some((m) => /\bkind\b/i.test(m))).toBe(true);
      expect(messages.some((m) => /\btitle\b/i.test(m))).toBe(true);
    }
  );

  test(
    "JSON hỏng trả 400 không phải 5xx",
    { tag: ["@TC-INFRA-017", "@creates-data"] },
    async ({ apiAs, infraUsers }) => {
      const user = await infraUsers.signedIn();

      const res = await apiAs(user).raw.post("/documents", {
        data: MALFORMED_JSON,
        headers: { "content-type": "application/json" },
      });

      expect(res.status).toBe(400);
      for (const leak of LEAK_PATTERNS) expect(res.text).not.toMatch(leak);
    }
  );
});
