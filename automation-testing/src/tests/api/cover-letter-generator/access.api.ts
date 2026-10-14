import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import type { SeededMatch } from "@/fixtures/modules/cover-letter-generator.fixture";
import type { SeededUser } from "@/utils/sessions";

// Who may touch /cover-letters, and whose rows they see (REQ-COVERLETTERGENERATOR-02, -03). Every request here is
// decided before any provider call (D1): 401 at the guard, 404 / [] at the ownership check.

const BODY = { tone: "formal", length: "standard", language: "en" } as const;

test.describe("cover letters — access and isolation", () => {
  let owner: SeededUser;
  let mine: SeededMatch;
  let otherUserId: string;
  let theirs: SeededMatch;
  let theirLetter: string;
  let theirCredential: string;

  test.beforeAll(async ({ coverLetterDb }) => {
    owner = await coverLetterDb.signedInUser();
    mine = await coverLetterDb.match(owner.userId);
    otherUserId = await coverLetterDb.otherUser();
    theirs = await coverLetterDb.match(otherUserId);
    theirLetter = await coverLetterDb.letter(otherUserId, theirs.matchId, { content: "their private letter" });
    theirCredential = await coverLetterDb.credentialRow(otherUserId);
  });

  test.afterAll(async ({ coverLetterDb }) => {
    await coverLetterDb.cleanMatches([mine, theirs]);
  });

  test(
    "anonymous caller gets 401 SIGN_IN_REQUIRED on every cover-letter endpoint",
    { tag: ["@TC-COVERLETTERGENERATOR-001", "@smoke"] },
    async ({ anonApi }) => {
      const calls = [
        anonApi.coverLetters.generate({ matchResultId: mine.matchId, ...BODY }),
        anonApi.coverLetters.list(mine.matchId),
        anonApi.coverLetters.update(theirLetter, "x"),
        anonApi.coverLetters.remove(theirLetter),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(401);
        expect(res.error().code).toBe("SIGN_IN_REQUIRED");
        expect(res.error().message).toBe(serverMessage("auth.errors.signInRequired"));
      }
    }
  );

  test(
    "guest session gets 401 SIGN_IN_REQUIRED on every cover-letter endpoint",
    { tag: ["@TC-COVERLETTERGENERATOR-002", "@smoke"] },
    async ({ coverLetterDb, apiAs }) => {
      const guest = await coverLetterDb.guestUser();
      const guestMatch = await coverLetterDb.match(guest.userId);
      const guestLetter = await coverLetterDb.letter(guest.userId, guestMatch.matchId);
      const api = apiAs(guest);
      try {
        const calls = [
          api.coverLetters.generate({ matchResultId: guestMatch.matchId, ...BODY }),
          api.coverLetters.list(guestMatch.matchId),
          api.coverLetters.update(guestLetter, "x"),
          api.coverLetters.remove(guestLetter),
        ];
        for (const res of await Promise.all(calls)) {
          expect(res.status).toBe(401);
          expect(res.error().code).toBe("SIGN_IN_REQUIRED");
        }
        expect(await coverLetterDb.countLetters(guest.userId)).toBe(1);
      } finally {
        await coverLetterDb.cleanMatches([guestMatch]);
      }
    }
  );

  test(
    "generating from another user's or an unknown match is 404 and writes nothing",
    { tag: ["@TC-COVERLETTERGENERATOR-003", "@smoke"] },
    async ({ apiAs, coverLetterDb }) => {
      const before = await coverLetterDb.countLetters(owner.userId);
      for (const matchResultId of [theirs.matchId, randomUUID()]) {
        const res = await apiAs(owner).coverLetters.generate({ matchResultId, ...BODY });
        expect(res.status).toBe(404);
        expect(res.error().message).toBe(serverMessage("coverLetters.errors.matchNotFound"));
      }
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(before);
      expect(await coverLetterDb.countLetters(otherUserId)).toBe(1);
    }
  );

  test(
    "generating with another user's credential is 404 and writes nothing",
    { tag: ["@TC-COVERLETTERGENERATOR-004", "@smoke"] },
    async ({ apiAs, coverLetterDb }) => {
      const before = await coverLetterDb.countLetters(owner.userId);
      const res = await apiAs(owner).coverLetters.generate({
        matchResultId: mine.matchId,
        ...BODY,
        credentialId: theirCredential,
      });
      expect(res.status).toBe(404);
      expect(await coverLetterDb.countLetters(owner.userId)).toBe(before);
    }
  );

  test(
    "listing another user's match returns an empty list, not 403",
    { tag: ["@TC-COVERLETTERGENERATOR-005", "@smoke"] },
    async ({ apiAs }) => {
      const res = await apiAs(owner).coverLetters.list(theirs.matchId);
      expect(res.status).toBe(200);
      expect(res.json()).toEqual([]);
    }
  );

  test(
    "editing or deleting another user's letter is 404 and leaves it untouched",
    { tag: ["@TC-COVERLETTERGENERATOR-006", "@smoke"] },
    async ({ apiAs, coverLetterDb }) => {
      const patch = await apiAs(owner).coverLetters.update(theirLetter, "hijacked");
      expect(patch.status).toBe(404);
      expect(patch.error().message).toBe(serverMessage("coverLetters.errors.notFound"));

      const del = await apiAs(owner).coverLetters.remove(theirLetter);
      expect(del.status).toBe(404);
      expect(del.error().message).toBe(serverMessage("coverLetters.errors.notFound"));

      const row = await coverLetterDb.findLetter(theirLetter);
      expect(row?.content).toBe("their private letter");
      expect(row?.edited).toBe(false);
    }
  );
});
