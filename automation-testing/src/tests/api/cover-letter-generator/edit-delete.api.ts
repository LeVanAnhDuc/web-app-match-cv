import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { LETTER_BODY, LETTER_MAX, textOfLength } from "@/data/test-data/cover-letter-generator";
import type { SeededMatch } from "@/fixtures/modules/cover-letter-generator.fixture";
import type { SeededUser } from "@/utils/sessions";

// PATCH /cover-letters/:id (REQ-COVERLETTERGENERATOR-22) and DELETE (REQ-COVERLETTERGENERATOR-25), on rows seeded
// straight into the DB so no generation (AI) is spent to get something to edit.

test.describe("cover letters — edit and delete", () => {
  let owner: SeededUser;
  let match: SeededMatch;

  test.beforeAll(async ({ coverLetterDb }) => {
    owner = await coverLetterDb.signedInUser();
    match = await coverLetterDb.match(owner.userId);
  });

  test.afterAll(async ({ coverLetterDb }) => {
    await coverLetterDb.cleanMatches([match]);
  });

  test(
    "an edit replaces the content and marks the letter edited",
    { tag: ["@TC-COVERLETTERGENERATOR-015"] },
    async ({ apiAs, coverLetterDb }) => {
      const id = await coverLetterDb.letter(owner.userId, match.matchId);

      const res = await apiAs(owner).coverLetters.update(id, "My own words.");

      expect(res.status).toBe(200);
      expect(res.json().content).toBe("My own words.");
      expect(res.json().edited).toBe(true);
      const listed = (await apiAs(owner).coverLetters.list(match.matchId)).json().find((row) => row.id === id);
      expect(listed?.content).toBe("My own words.");
      expect(listed?.edited).toBe(true);
    }
  );

  test(
    "content length boundaries: 0 and 20001 rejected, 1 and 20000 accepted",
    { tag: ["@TC-COVERLETTERGENERATOR-016"] },
    async ({ apiAs, coverLetterDb }) => {
      const id = await coverLetterDb.letter(owner.userId, match.matchId);
      const api = apiAs(owner);

      expect((await api.coverLetters.update(id, "")).status).toBe(400);
      expect((await api.coverLetters.update(id, "x")).status).toBe(200);
      expect((await api.coverLetters.update(id, textOfLength(LETTER_MAX))).status).toBe(200);
      expect((await api.coverLetters.update(id, textOfLength(LETTER_MAX + 1))).status).toBe(400);

      // The rejected 20001 left the accepted 20000 in place.
      expect((await coverLetterDb.findLetter(id))?.content.length).toBe(LETTER_MAX);
    }
  );

  test(
    "whitespace-only content is rejected with 400",
    { tag: ["@TC-COVERLETTERGENERATOR-017"] },
    async ({ apiAs, coverLetterDb }) => {
      const id = await coverLetterDb.letter(owner.userId, match.matchId);

      for (const blank of ["   ", "\n\n", "\t "]) {
        const res = await apiAs(owner).coverLetters.update(id, blank);
        expect(res.status, JSON.stringify(blank)).toBe(400);
      }
      expect((await coverLetterDb.findLetter(id))?.content).toBe(LETTER_BODY);
    }
  );

  test(
    "a failed letter cannot be edited",
    { tag: ["@TC-COVERLETTERGENERATOR-018"] },
    async ({ apiAs, coverLetterDb }) => {
      const id = await coverLetterDb.letter(owner.userId, match.matchId, { status: "failed", errorCode: "timeout" });

      const res = await apiAs(owner).coverLetters.update(id, "anything");

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("coverLetters.errors.notEditable"));
      const row = await coverLetterDb.findLetter(id);
      expect(row?.content).toBe("");
      expect(row?.edited).toBe(false);
    }
  );

  test(
    "only content is editable: tone, length, language and status in the body are ignored",
    { tag: ["@TC-COVERLETTERGENERATOR-019"] },
    async ({ apiAs, coverLetterDb }) => {
      const id = await coverLetterDb.letter(owner.userId, match.matchId);

      const res = await apiAs(owner).coverLetters.update(id, {
        content: "Edited text.",
        tone: "friendly",
        length: "short",
        language: "vi",
        status: "failed",
        edited: false,
      });

      expect(res.status).toBe(200);
      const row = await coverLetterDb.findLetter(id);
      expect(row).toMatchObject({
        content: "Edited text.",
        tone: "formal",
        length: "standard",
        language: "en",
        status: "succeeded",
        edited: true,
      });
    }
  );

  test(
    "a non-UUID id is 400 and an unknown id is 404 on PATCH and DELETE",
    { tag: ["@TC-COVERLETTERGENERATOR-020"] },
    async ({ apiAs }) => {
      const api = apiAs(owner);
      expect((await api.coverLetters.update("not-a-uuid", "x")).status).toBe(400);
      expect((await api.coverLetters.remove("not-a-uuid")).status).toBe(400);

      const patch = await api.coverLetters.update(randomUUID(), "x");
      expect(patch.status).toBe(404);
      expect(patch.error().message).toBe(serverMessage("coverLetters.errors.notFound"));
      const del = await api.coverLetters.remove(randomUUID());
      expect(del.status).toBe(404);
      expect(del.error().message).toBe(serverMessage("coverLetters.errors.notFound"));
    }
  );

  test(
    "deleting a letter answers 204 and removes only that letter",
    { tag: ["@TC-COVERLETTERGENERATOR-021"] },
    async ({ apiAs, coverLetterDb }) => {
      const keep = await coverLetterDb.letter(owner.userId, match.matchId);
      const drop = await coverLetterDb.letter(owner.userId, match.matchId);

      const res = await apiAs(owner).coverLetters.remove(drop);
      expect(res.status).toBe(204);

      const ids = (await apiAs(owner).coverLetters.list(match.matchId)).json().map((row) => row.id);
      expect(ids).not.toContain(drop);
      expect(ids).toContain(keep);
      expect(await coverLetterDb.findLetter(drop)).toBeNull();

      // Deleting again: the row is gone.
      expect((await apiAs(owner).coverLetters.remove(drop)).status).toBe(404);
    }
  );
});
