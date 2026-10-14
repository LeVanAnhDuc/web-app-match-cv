import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import type { SeededMatch } from "@/fixtures/modules/cover-letter-generator.fixture";
import type { SeededUser } from "@/utils/sessions";

// POST /cover-letters branches decided BEFORE the provider call (D1): DTO validation (REQ-COVERLETTERGENERATOR-08) and
// the match / credential checks in their fixed order (REQ-COVERLETTERGENERATOR-09). Every body below is invalid in at
// least one way, so none of them can reach the AI.

const VALID = { tone: "formal", length: "standard", language: "en" } as const;

test.describe("cover letters — generate validation", () => {
  let owner: SeededUser;
  let succeeded: SeededMatch;
  let failed: SeededMatch;

  test.beforeAll(async ({ coverLetterDb }) => {
    owner = await coverLetterDb.signedInUser();
    succeeded = await coverLetterDb.match(owner.userId);
    failed = await coverLetterDb.match(owner.userId, { status: "failed", errorCode: "no_quota" });
  });

  test.afterAll(async ({ coverLetterDb }) => {
    await coverLetterDb.cleanMatches([succeeded, failed]);
  });

  test(
    "a missing tone, length or language is rejected with 400",
    { tag: ["@TC-COVERLETTERGENERATOR-007"] },
    async ({ apiAs, coverLetterDb }) => {
      for (const missing of ["tone", "length", "language"] as const) {
        // Against the SUCCEEDED match: the 400 must come from validation (no server-side default), not from a later
        // check. With the option present this body would go on to the provider.
        const body: Record<string, unknown> = { matchResultId: succeeded.matchId, ...VALID };
        delete body[missing];
        const res = await apiAs(owner).coverLetters.generate(body);
        expect(res.status, `without ${missing}`).toBe(400);
        expect(JSON.stringify(res.error().message)).toContain(missing);
      }
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(0);
    }
  );

  test(
    "a tone, length or language outside its enum is rejected with 400",
    { tag: ["@TC-COVERLETTERGENERATOR-008"] },
    async ({ apiAs, coverLetterDb }) => {
      const cases: Array<Record<string, unknown>> = [
        { tone: "sarcastic" },
        { tone: "Formal" },
        { length: "long" },
        { length: "" },
        { language: "fr" },
        { language: "EN" },
      ];
      for (const override of cases) {
        const res = await apiAs(owner).coverLetters.generate({ matchResultId: succeeded.matchId, ...VALID, ...override });
        expect(res.status, JSON.stringify(override)).toBe(400);
      }
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(0);
    }
  );

  test(
    "a missing or non-UUID matchResultId and a non-UUID credentialId are rejected with 400",
    { tag: ["@TC-COVERLETTERGENERATOR-009"] },
    async ({ apiAs, coverLetterDb }) => {
      const bodies: Array<Record<string, unknown>> = [
        { ...VALID },
        { ...VALID, matchResultId: "not-a-uuid" },
        { ...VALID, matchResultId: "" },
        { ...VALID, matchResultId: succeeded.matchId, credentialId: "not-a-uuid" },
      ];
      for (const body of bodies) {
        const res = await apiAs(owner).coverLetters.generate(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(0);
    }
  );

  test(
    "a failed match is rejected with 400 matchNotSucceeded and writes nothing",
    { tag: ["@TC-COVERLETTERGENERATOR-010"] },
    async ({ apiAs, coverLetterDb }) => {
      const res = await apiAs(owner).coverLetters.generate({ matchResultId: failed.matchId, ...VALID });
      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("coverLetters.errors.matchNotSucceeded"));
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(0);
    }
  );

  test(
    "a failed match with someone else's credential is 400, the match check comes first",
    { tag: ["@TC-COVERLETTERGENERATOR-011"] },
    async ({ apiAs, coverLetterDb }) => {
      const otherUserId = await coverLetterDb.otherUser();
      const foreignCredential = await coverLetterDb.credentialRow(otherUserId);

      const res = await apiAs(owner).coverLetters.generate({
        matchResultId: failed.matchId,
        ...VALID,
        credentialId: foreignCredential,
      });

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("coverLetters.errors.matchNotSucceeded"));
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(0);
    }
  );

  test(
    "an unknown credential on an owned succeeded match is 404 and writes nothing",
    { tag: ["@TC-COVERLETTERGENERATOR-012"] },
    async ({ apiAs, coverLetterDb }) => {
      const res = await apiAs(owner).coverLetters.generate({
        matchResultId: succeeded.matchId,
        ...VALID,
        credentialId: randomUUID(),
      });
      expect(res.status).toBe(404);
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(0);
    }
  );
});
