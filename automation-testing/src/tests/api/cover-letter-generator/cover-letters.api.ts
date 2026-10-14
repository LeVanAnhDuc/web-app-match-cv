import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { HttpFactory } from "@/api/http.client";
import { countRows, insertAiCredential, insertCoverLetter, insertDocument, insertMatchResult, sql } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/cover-letters.e2e-spec.ts. That suite replaced AiService with FakeAiService (a fixed letter,
// `failNext` to kill the provider, `lastPrompt` to inspect what reached it) and made its match with POST /match on the
// fake. Over HTTP the dev server's AiService is real, so:
//   - the succeeded match the suite works on is seeded through `pg` instead of POST /match (setup only);
//   - every case that reaches generateCoverLetter (a real OpenRouter call) is fixme;
//   - validation, ownership and edit/delete contracts run live (decided before any provider call).
// "valid match + someone else's credential → 404" needs the dev server to have CREDENTIAL_ENCRYPTION_KEY (otherwise
// the credential service answers 503 first, as the in-process suite noted).

const LETTERS = "/cover-letters";
const FAKE_KEY = "fake-key-000000000000";
const MUST_NOT_CLAIM_HEADING = "MUST NOT CLAIM"; // in-process: imported from server/src/modules/cover-letters/prompt

const ERROR_CODES = ["invalid_key", "no_quota", "model_unavailable", "timeout", "unreachable"];

interface IdBody {
  id: string;
}

interface LetterBody {
  id: string;
  matchResultId: string;
  tone: string;
  length: string;
  language: string;
  content: string;
  omittedRequirements: string[];
  status: string;
  errorCode: string | null;
  edited: boolean;
  credentialId: string | null;
  provider: string;
  chatModel: string;
}

/** What the in-process FakeAiService recorded; nothing fills it over HTTP. */
const FakeAiService: { lastPrompt: { system: string; user: string } | null } = { lastPrompt: null };

test.describe("CoverLetters (e2e)", () => {
  let userId: string;
  let cookie: string;
  const documentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;
  let matchId: string;

  const generate = (http: HttpFactory, body: Record<string, unknown> = {}) =>
    http(cookie).post(LETTERS, {
      data: {
        matchResultId: matchId,
        tone: "formal",
        length: "standard",
        language: "en",
        ...body,
      },
    });

  /**
   * Seed a row straight through the database.
   *
   * POST /cover-letters is capped at 10/min on purpose (it spends AI budget),
   * and that cap is production behaviour worth keeping honest — so the tests
   * that are about the EDIT and DELETE contracts do not spend generation calls
   * to get a row to work on.
   */
  const seedLetter = (over: Partial<Parameters<typeof insertCoverLetter>[0]> = {}) =>
    insertCoverLetter({
      userId,
      matchResultId: matchId,
      tone: "formal",
      length: "standard",
      language: "en",
      content: "Dear hiring manager,",
      omittedRequirements: [],
      status: "succeeded",
      provider: "openrouter",
      chatModel: "openai/gpt-4o-mini",
      ...over,
    });

  test.beforeAll(async ({ http }) => {
    ({ userId, cookie } = await createSignedInUser());

    const createDoc = async (kind: "CV" | "JD", text: string) => {
      const res = await http(cookie).post("/documents", { data: { kind, sourceText: text, save: false } });
      const { id } = res.body as IdBody;
      documentIds.push(id);
      return id;
    };
    cvDocId = await createDoc("CV", "Six years of Node.js and PostgreSQL.");
    jdDocId = await createDoc("JD", "Senior engineer, Kubernetes required.");

    // In-process this was POST /match on FakeAiService (report gaps: ["Kubernetes"]); seeded directly so no real
    // provider is called.
    matchId = await insertMatchResult({
      userId,
      cvDocumentId: cvDocId,
      jdDocumentId: jdDocId,
      scores: [60, 60, 60],
      report: { strengths: ["Six years of Node.js"], gaps: ["Kubernetes"], suggestions: ["Add metrics"] },
    });
    // Stands in for the letter the (fixme) "[EP] generates a letter…" case wrote first in the in-process run, which
    // the list case below counts on ("at least 2 rows").
    await seedLetter({ createdAt: new Date(Date.now() - 60_000) });
  });

  test.afterAll(async () => {
    // Letters cascade with their match; matches must go before the documents.
    await sql('DELETE FROM "CoverLetter" WHERE "userId" = $1 AND "matchResultId" = $2', [userId, matchId]);
    await sql('DELETE FROM "MatchResult" WHERE "cvDocumentId" = ANY($1::text[])', [documentIds]);
    await sql('DELETE FROM "Document" WHERE id = ANY($1::text[])', [documentIds]);
    await deleteUsers([userId]);
  });

  test.describe("POST /cover-letters", () => {
    // FIXME(migrated): needs AiService (FakeAiService.generateCoverLetter) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests cover-letter-generator.
    test.fixme("[EP] generates a letter from an owned, succeeded match", async ({ http }) => {
      const res = await generate(http);

      expect(res.status).toBe(201);
      const body = res.body as LetterBody;
      expect(body.matchResultId).toBe(matchId);
      expect(body.status).toBe("succeeded");
      expect(body.content).toContain("Dear hiring manager");
      expect(body.omittedRequirements).toEqual(["Kubernetes"]);
      expect(body.edited).toBe(false);
      expect(body.credentialId).toBeNull();
      expect(body.provider).toBe("openrouter");
    });

    // ADR #13 end to end: the engine's own "what this CV lacks" list must
    // reach the provider as a prohibition, not as writing material.
    // FIXME(migrated): needs AiService (FakeAiService.lastPrompt) injected in-process; over HTTP the prompt goes to the real OpenRouter and is not observable. Decide in /write-tests cover-letter-generator.
    test.fixme("[grounding] sends the match's gaps as a forbidden list", async () => {
      const prompt = FakeAiService.lastPrompt;
      expect(prompt).not.toBeNull();
      const forbiddenIndex = prompt!.user.indexOf(MUST_NOT_CLAIM_HEADING);
      expect(forbiddenIndex).toBeGreaterThanOrEqual(0);
      expect(prompt!.user.indexOf("Kubernetes")).toBeGreaterThan(forbiddenIndex);
      expect(prompt!.system).toMatch(/traceable to the CV/i);
    });

    test("[EP] a match that is not yours → 404 and nothing is written", async ({ http }) => {
      const before = await countRows("CoverLetter");
      const res = await generate(http, { matchResultId: randomUUID() });

      expect(res.status).toBe(404);
      expect(await countRows("CoverLetter")).toBe(before);
    });

    test("[EP] a failed match → 400, there is no report to write from", async ({ http }) => {
      const failed = await insertMatchResult({
        userId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        status: "failed",
        errorCode: "no_quota",
        scores: [0, 0, 0],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      const res = await generate(http, { matchResultId: failed });
      expect(res.status).toBe(400);
    });

    test("[DT] failed match + someone else's credential → the match check wins, no row", async ({ http }) => {
      const otherUserId = await createUser();
      const foreignCred = await insertAiCredential({
        userId: otherUserId,
        provider: "openrouter",
        label: "foreign-cl",
        encryptedKey: Buffer.from("x"),
        keyIv: Buffer.from("x"),
        keyTag: Buffer.from("x"),
        keyLast4: "1234",
      });
      const failed = await insertMatchResult({
        userId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        status: "failed",
        errorCode: "no_quota",
        scores: [0, 0, 0],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      try {
        const before = await countRows("CoverLetter");
        const res = await generate(http, { matchResultId: failed, credentialId: foreignCred });

        // The context is validated first, so 400 beats the credential's 404.
        expect(res.status).toBe(400);
        expect(await countRows("CoverLetter")).toBe(before);
      } finally {
        await deleteUsers([otherUserId]);
      }
    });

    test("[DT] valid match + someone else's credential → 404 and no row", async ({ http }) => {
      const otherUserId = await createUser();
      const foreignCred = await insertAiCredential({
        userId: otherUserId,
        provider: "openrouter",
        label: "foreign-cl-2",
        encryptedKey: Buffer.from("x"),
        keyIv: Buffer.from("x"),
        keyTag: Buffer.from("x"),
        keyLast4: "1234",
      });

      try {
        const before = await countRows("CoverLetter");
        const res = await generate(http, { credentialId: foreignCred });

        expect(res.status).toBe(404);
        expect(await countRows("CoverLetter")).toBe(before);
      } finally {
        await deleteUsers([otherUserId]);
      }
    });

    // FIXME(migrated): needs AiService (FakeAiService.failNext = AiProviderError("no_quota")) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests cover-letter-generator.
    test.fixme(
      "[EP] a dead provider yields 201 with status=failed and a closed-set code, not 503",
      async ({ http }) => {
        // in-process: FakeAiService.failNext = new AiProviderError("no_quota");
        const res = await generate(http);

        expect(res.status).toBe(201);
        const body = res.body as LetterBody;
        expect(body.status).toBe("failed");
        expect(body.errorCode).toBe("no_quota");
        expect(ERROR_CODES).toContain(body.errorCode);
        expect(body.content).toBe("");
        expect(body.omittedRequirements).toEqual([]);
        // The snapshot survives so the UI can still say which provider died.
        expect(body.provider).toBe("openrouter");
        expect(JSON.stringify(res.body)).not.toContain(FAKE_KEY);
      }
    );

    test("[EP] a non-uuid matchResultId → 400 from validation", async ({ http }) => {
      const res = await generate(http, { matchResultId: "not-a-uuid" });
      expect(res.status).toBe(400);
    });

    test("[EP] an unknown tone → 400 from validation", async ({ http }) => {
      const res = await generate(http, { tone: "sarcastic" });
      expect(res.status).toBe(400);
    });
  });

  test.describe("GET /cover-letters", () => {
    test("[EP] lists the letters of one match, newest first", async ({ http }) => {
      await seedLetter({ language: "vi", tone: "friendly", length: "short" });

      const res = await http(cookie).get(LETTERS, { params: { matchResultId: matchId } });

      expect(res.status).toBe(200);
      const rows = res.body as LetterBody[];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].language).toBe("vi");
      expect(JSON.stringify(rows)).not.toContain(FAKE_KEY);
    });

    test("[EP] matchResultId is required", async ({ http }) => {
      const res = await http(cookie).get(LETTERS);
      expect(res.status).toBe(400);
    });

    test("[authz] another user's match yields an empty list, not a 403", async ({ http }) => {
      const otherUserId = await createUser();
      const foreignMatch = await insertMatchResult({
        userId: otherUserId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        scores: [50, 50, 50],
        report: { strengths: [], gaps: [], suggestions: [] },
      });
      const foreignLetter = await insertCoverLetter({
        userId: otherUserId,
        matchResultId: foreignMatch,
        tone: "formal",
        length: "short",
        language: "en",
        content: "secret letter",
        omittedRequirements: [],
        status: "succeeded",
        provider: "openrouter",
        chatModel: "openai/gpt-4o-mini",
      });

      try {
        const res = await http(cookie).get(LETTERS, { params: { matchResultId: foreignMatch } });

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);

        // and the row itself is unreachable by id
        const patch = await http(cookie).patch(`${LETTERS}/${foreignLetter}`, { data: { content: "hijacked" } });
        expect(patch.status).toBe(404);

        const del = await http(cookie).delete(`${LETTERS}/${foreignLetter}`);
        expect(del.status).toBe(404);
      } finally {
        // The foreign match points at OUR documents, so it must go before them: deleting its user cascades it.
        await deleteUsers([otherUserId]);
      }
    });
  });

  test.describe("PATCH /cover-letters/:id", () => {
    test("[ST] an edit marks the row as edited", async ({ http }) => {
      const created = await seedLetter();

      const res = await http(cookie).patch(`${LETTERS}/${created}`, { data: { content: "My own words." } });

      expect(res.status).toBe(200);
      const body = res.body as LetterBody;
      expect(body.content).toBe("My own words.");
      expect(body.edited).toBe(true);
    });

    test("[BVA] empty content → 400; one character → 200", async ({ http }) => {
      const created = await seedLetter();

      const empty = await http(cookie).patch(`${LETTERS}/${created}`, { data: { content: "" } });
      expect(empty.status).toBe(400);

      const one = await http(cookie).patch(`${LETTERS}/${created}`, { data: { content: "x" } });
      expect(one.status).toBe(200);
    });

    test("[BVA] 20000 chars accepted, 20001 rejected", async ({ http }) => {
      const created = await seedLetter();

      const max = await http(cookie).patch(`${LETTERS}/${created}`, { data: { content: "a".repeat(20_000) } });
      expect(max.status).toBe(200);

      const over = await http(cookie).patch(`${LETTERS}/${created}`, { data: { content: "a".repeat(20_001) } });
      expect(over.status).toBe(400);
    });

    test("[EP] a failed letter cannot be edited → 400", async ({ http }) => {
      const failed = await seedLetter({
        status: "failed",
        errorCode: "timeout",
        content: "",
      });

      const res = await http(cookie).patch(`${LETTERS}/${failed}`, { data: { content: "anything" } });

      expect(res.status).toBe(400);
    });
  });

  test.describe("DELETE /cover-letters/:id", () => {
    test("[ST] removes only that letter", async ({ http }) => {
      const keep = await seedLetter();
      const drop = await seedLetter();

      const res = await http(cookie).delete(`${LETTERS}/${drop}`);
      expect(res.status).toBe(204);

      const list = await http(cookie).get(LETTERS, { params: { matchResultId: matchId } });
      const ids = (list.body as LetterBody[]).map((row) => row.id);
      expect(ids).not.toContain(drop);
      expect(ids).toContain(keep);
    });

    test("[EP] an unknown id → 404", async ({ http }) => {
      const res = await http(cookie).delete(`${LETTERS}/${randomUUID()}`);
      expect(res.status).toBe(404);
    });
  });
});
