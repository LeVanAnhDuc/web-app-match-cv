import { randomUUID } from "node:crypto";
import { expect, test } from "@/fixtures";
import { fakeApiKey, LETTER_ERROR_CODES, LETTER_MAX } from "@/data/test-data/cover-letter-generator";
import type { SeededMatch } from "@/fixtures/modules/cover-letter-generator.fixture";
import type { SeededUser } from "@/utils/sessions";

// @live-ai (D1): these reach the REAL provider through the dev server (system key = OPENROUTER_API_KEY). Filtered out
// and blocked by `guard` unless LIVE_AI=1. Everything else in the module stubs or stops before the provider.
// What the model writes (tone, length, honouring MUST NOT CLAIM) is out of scope: only the contract is asserted.

const VIETNAMESE_MARKS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

test.describe("cover letters — live provider", () => {
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
    "a system-key generation answers 201 with the stored letter contract",
    { tag: ["@TC-COVERLETTERGENERATOR-027", "@live-ai"] },
    async ({ apiAs }) => {
      test.setTimeout(120_000);
      const res = await apiAs(owner).coverLetters.generate({
        matchResultId: match.matchId,
        tone: "formal",
        length: "short",
        language: "en",
      });

      expect(res.status).toBe(201);
      const letter = res.json();
      expect(letter).toMatchObject({
        matchResultId: match.matchId,
        tone: "formal",
        length: "short",
        language: "en",
        status: "succeeded",
        errorCode: null,
        edited: false,
        credentialId: null,
        provider: "openrouter",
      });
      expect(letter.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(letter.content.trim().length).toBeGreaterThan(0);
      expect(letter.content.length).toBeLessThanOrEqual(LETTER_MAX);
      expect(Array.isArray(letter.omittedRequirements)).toBe(true);
      expect(letter.chatModel).toBeTruthy();
      expect(res.text).not.toMatch(/"(apiKey|encryptedKey|keyIv|keyTag)"/);

      // Saved without any "save" step: it is in the list straight away, newest first.
      const listed = await apiAs(owner).coverLetters.list(match.matchId);
      expect(listed.json()[0]?.id).toBe(letter.id);
    }
  );

  test(
    "a Vietnamese letter is written in Vietnamese whatever the request language",
    { tag: ["@TC-COVERLETTERGENERATOR-028", "@live-ai"] },
    async ({ apiAs }) => {
      test.setTimeout(120_000);
      // UI/request language en, letter language vi: the two are independent.
      const res = await apiAs(owner).lang("en").coverLetters.generate({
        matchResultId: match.matchId,
        tone: "friendly",
        length: "short",
        language: "vi",
      });

      expect(res.status).toBe(201);
      expect(res.json().status).toBe("succeeded");
      expect(res.json().language).toBe("vi");
      expect(res.json().content).toMatch(VIETNAMESE_MARKS);
    }
  );

  test(
    "a key the provider rejects is stored as a failed letter with a closed-set code",
    { tag: ["@TC-COVERLETTERGENERATOR-029", "@live-ai"] },
    async ({ apiAs }) => {
      test.setTimeout(120_000);
      const api = apiAs(owner);
      const apiKey = fakeApiKey();
      const credential = await api.aiCredentials.create({
        provider: "openrouter",
        label: `cl-live-${randomUUID().slice(0, 8)}`,
        apiKey,
      });
      expect(credential.status).toBe(201);
      const credentialId = credential.json().id;
      try {
        const res = await api.coverLetters.generate({
          matchResultId: match.matchId,
          tone: "formal",
          length: "standard",
          language: "en",
          credentialId,
        });

        // A dead provider is the letter's outcome, not an HTTP error.
        expect(res.status).toBe(201);
        const letter = res.json();
        expect(letter.status).toBe("failed");
        expect(LETTER_ERROR_CODES).toContain(letter.errorCode);
        expect(letter.errorCode).toBe("invalid_key");
        expect(letter.content).toBe("");
        expect(letter.omittedRequirements).toEqual([]);
        expect(letter.credentialId).toBe(credentialId);
        expect(letter.provider).toBe("openrouter");
        expect(res.text).not.toContain(apiKey);
      } finally {
        await api.aiCredentials.remove(credentialId);
      }
    }
  );
});
