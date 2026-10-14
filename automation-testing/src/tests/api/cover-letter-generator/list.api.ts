import { expect, test } from "@/fixtures";
import type { SeededMatch } from "@/fixtures/modules/cover-letter-generator.fixture";
import type { SeededUser } from "@/utils/sessions";

// GET /cover-letters?matchResultId= (REQ-COVERLETTERGENERATOR-16).

test.describe("cover letters — list", () => {
  let owner: SeededUser;
  let match: SeededMatch;
  let sibling: SeededMatch;

  test.beforeAll(async ({ coverLetterDb }) => {
    owner = await coverLetterDb.signedInUser();
    match = await coverLetterDb.match(owner.userId);
    sibling = await coverLetterDb.match(owner.userId);
  });

  test.afterAll(async ({ coverLetterDb }) => {
    await coverLetterDb.cleanMatches([match, sibling]);
  });

  test(
    "lists only the letters of the requested match, newest first",
    { tag: ["@TC-COVERLETTERGENERATOR-013"] },
    async ({ apiAs, coverLetterDb }) => {
      const now = Date.now();
      const oldest = await coverLetterDb.letter(owner.userId, match.matchId, { createdAt: new Date(now - 30_000) });
      const middle = await coverLetterDb.letter(owner.userId, match.matchId, {
        tone: "friendly",
        status: "failed",
        errorCode: "timeout",
        createdAt: new Date(now - 20_000),
      });
      const newest = await coverLetterDb.letter(owner.userId, match.matchId, {
        language: "vi",
        createdAt: new Date(now - 10_000),
      });
      const elsewhere = await coverLetterDb.letter(owner.userId, sibling.matchId);

      const res = await apiAs(owner).coverLetters.list(match.matchId);

      expect(res.status).toBe(200);
      const ids = res.json().map((row) => row.id);
      expect(ids).toEqual([newest, middle, oldest]);
      expect(ids).not.toContain(elsewhere);
      expect(res.json().every((row) => row.matchResultId === match.matchId)).toBe(true);
    }
  );

  test(
    "a missing or non-UUID matchResultId is rejected with 400",
    { tag: ["@TC-COVERLETTERGENERATOR-014"] },
    async ({ apiAs }) => {
      for (const matchResultId of [undefined, "not-a-uuid", "123"]) {
        const res = await apiAs(owner).coverLetters.list(matchResultId);
        expect(res.status, String(matchResultId)).toBe(400);
      }
    }
  );
});
