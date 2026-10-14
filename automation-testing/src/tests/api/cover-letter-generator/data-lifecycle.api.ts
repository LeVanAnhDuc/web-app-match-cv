import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { fakeApiKey } from "@/data/test-data/cover-letter-generator";
import type { SeededMatch } from "@/fixtures/modules/cover-letter-generator.fixture";
import type { SeededUser } from "@/utils/sessions";

// What happens to letters around them (REQ-COVERLETTERGENERATOR-26), what never leaves the server
// (REQ-COVERLETTERGENERATOR-27) and which language errors come back in (REQ-COVERLETTERGENERATOR-28).

const KEY_FIELDS = ["apiKey", "encryptedKey", "keyIv", "keyTag"];

test.describe("cover letters — data lifecycle, secrets, language", () => {
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
    "letters are deleted with the match result they were written from",
    { tag: ["@TC-COVERLETTERGENERATOR-022"] },
    async ({ apiAs, coverLetterDb }) => {
      const doomed = await coverLetterDb.match(owner.userId);
      const first = await coverLetterDb.letter(owner.userId, doomed.matchId);
      const second = await coverLetterDb.letter(owner.userId, doomed.matchId, { status: "failed" });
      expect((await apiAs(owner).coverLetters.list(doomed.matchId)).json()).toHaveLength(2);

      // No endpoint deletes a match result; the cascade is a schema guarantee, checked at the row level.
      await coverLetterDb.deleteMatchResult(doomed.matchId);

      expect(await coverLetterDb.findLetter(first)).toBeNull();
      expect(await coverLetterDb.findLetter(second)).toBeNull();
      expect((await apiAs(owner).coverLetters.list(doomed.matchId)).json()).toEqual([]);
    }
  );

  test(
    "deleting the credential keeps the letter and clears its credentialId",
    { tag: ["@TC-COVERLETTERGENERATOR-023"] },
    async ({ apiAs, coverLetterDb }) => {
      const api = apiAs(owner);
      const created = await api.aiCredentials.create({
        provider: "openrouter",
        label: `cl-${randomUUID().slice(0, 8)}`,
        apiKey: fakeApiKey(),
      });
      expect(created.status).toBe(201);
      const credentialId = created.json().id;
      const letter = await coverLetterDb.letter(owner.userId, match.matchId, { credentialId });
      expect((await api.coverLetters.list(match.matchId)).json().find((row) => row.id === letter)?.credentialId).toBe(
        credentialId
      );

      expect((await api.aiCredentials.remove(credentialId)).status).toBe(204);

      const listed = (await api.coverLetters.list(match.matchId)).json().find((row) => row.id === letter);
      expect(listed).toBeDefined();
      expect(listed?.credentialId).toBeNull();
      expect(listed?.content).toBeTruthy();
    }
  );

  test(
    "no response of the cover-letter endpoints carries the API key or its ciphertext",
    { tag: ["@TC-COVERLETTERGENERATOR-024", "@smoke"] },
    async ({ apiAs, coverLetterDb }) => {
      const api = apiAs(owner);
      const apiKey = fakeApiKey();
      const created = await api.aiCredentials.create({ provider: "openrouter", label: `cl-${randomUUID().slice(0, 8)}`, apiKey });
      expect(created.status).toBe(201);
      const credentialId = created.json().id;
      try {
        const letter = await coverLetterDb.letter(owner.userId, match.matchId, { credentialId });
        const failedLetter = await coverLetterDb.letter(owner.userId, match.matchId, {
          credentialId,
          status: "failed",
          errorCode: "invalid_key",
        });

        const list = await api.coverLetters.list(match.matchId);
        const responses = [
          list,
          await api.coverLetters.update(letter, "Edited."),
          await api.coverLetters.update(failedLetter, "Edited."),
          await api.coverLetters.remove(randomUUID()),
        ];
        for (const res of responses) {
          expect(res.text).not.toContain(apiKey);
          for (const field of KEY_FIELDS) expect(res.text).not.toContain(`"${field}"`);
        }
        const failedRow = list.json().find((row) => row.id === failedLetter);
        expect(failedRow?.errorCode).toBe("invalid_key");
      } finally {
        await api.aiCredentials.remove(credentialId);
      }
    }
  );

  test(
    "error messages follow the request language",
    { tag: ["@TC-COVERLETTERGENERATOR-025"] },
    async ({ apiAs, anonApi, coverLetterDb }) => {
      const vi = apiAs(owner).lang("vi");
      const failedMatch = await coverLetterDb.match(owner.userId, { status: "failed" });
      const failedLetter = await coverLetterDb.letter(owner.userId, match.matchId, { status: "failed" });
      try {
        const body = { tone: "formal", length: "standard", language: "en" };

        const notFound = await vi.coverLetters.generate({ matchResultId: randomUUID(), ...body });
        expect(notFound.error().message).toBe(serverMessage("coverLetters.errors.matchNotFound", "vi"));

        const notSucceeded = await vi.coverLetters.generate({ matchResultId: failedMatch.matchId, ...body });
        expect(notSucceeded.error().message).toBe(serverMessage("coverLetters.errors.matchNotSucceeded", "vi"));

        const missing = await vi.coverLetters.remove(randomUUID());
        expect(missing.error().message).toBe(serverMessage("coverLetters.errors.notFound", "vi"));

        const notEditable = await vi.coverLetters.update(failedLetter, "x");
        expect(notEditable.error().message).toBe(serverMessage("coverLetters.errors.notEditable", "vi"));

        const anonymous = await anonApi.lang("vi").coverLetters.list(match.matchId);
        expect(anonymous.error().message).toBe(serverMessage("auth.errors.signInRequired", "vi"));
      } finally {
        await coverLetterDb.cleanMatches([failedMatch]);
      }
    }
  );
});
