import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { HttpFactory } from "@/api/http.client";
import { countRows, insertMatchResult, insertMatchRun, sql } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/match-runs.e2e-spec.ts. That suite replaced AiService with FakeAiService (deterministic
// embeddings, `failNext` to kill the provider). Over HTTP the dev server's AiService is real, so every case that needs
// POST /match to actually RUN (results under a run, the failed-row contract) is fixme. Opening runs, reading them, and
// the run/document checks POST /match makes before any provider call run live.

const MATCH = "/match";
const RUNS = "/match/runs";

interface IdBody {
  id: string;
}

interface RunBody {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  createdAt: string;
  results?: ResultBody[];
}

interface ResultBody {
  id: string;
  runId: string | null;
  status: string;
  errorCode: string | null;
  provider: string;
  chatModel: string;
  overallScore: number;
}

const ERROR_CODES = ["invalid_key", "no_quota", "model_unavailable", "timeout", "unreachable"];

test.describe("MatchRuns (e2e)", () => {
  let userId: string;
  let cookie: string;
  const documentIds: string[] = [];
  const runIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  const createDoc = async (http: HttpFactory, kind: "CV" | "JD", text: string) => {
    const res = await http(cookie).post("/documents", { data: { kind, sourceText: text, save: false } });
    const { id } = res.body as IdBody;
    documentIds.push(id);
    return id;
  };

  const openRun = async (http: HttpFactory, cv = cvDocId, jd = jdDocId) => {
    const res = await http(cookie).post(RUNS, { data: { cvDocumentId: cv, jdDocumentId: jd } });
    if (res.status === 201) runIds.push((res.body as RunBody).id);
    return res;
  };

  test.beforeAll(async ({ http }) => {
    ({ userId, cookie } = await createSignedInUser());

    cvDocId = await createDoc(http, "CV", "Senior backend engineer with NestJS.");
    jdDocId = await createDoc(http, "JD", "Hiring a senior backend engineer.");
  });

  test.afterAll(async () => {
    // Results cascade with their run; anything runless is cleaned by document.
    if (runIds.length) await sql('DELETE FROM "MatchRun" WHERE id = ANY($1::text[])', [runIds]);
    await sql('DELETE FROM "MatchResult" WHERE "cvDocumentId" = ANY($1::text[])', [documentIds]);
    await sql('DELETE FROM "Document" WHERE id = ANY($1::text[])', [documentIds]);
    await deleteUsers([userId]);
  });

  test.describe("POST /match/runs", () => {
    test("[EP] opens a run for an owned CV/JD pair", async ({ http }) => {
      const res = await openRun(http);

      expect(res.status).toBe(201);
      const body = res.body as RunBody;
      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.jdDocumentId).toBe(jdDocId);
      expect(body.id).toEqual(expect.any(String));
    });

    test("[EP] a document that is not yours → 400", async ({ http }) => {
      const res = await openRun(http, randomUUID(), jdDocId);
      expect(res.status).toBe(400);
    });

    test("[EP] swapped kinds → 400", async ({ http }) => {
      const res = await openRun(http, jdDocId, cvDocId);
      expect(res.status).toBe(400);
    });
  });

  test.describe("POST /match with a runId", () => {
    // FIXME(migrated): needs AiService (FakeAiService) injected in-process; over HTTP both POST /match calls would call the real OpenRouter. Decide in /write-tests multi-provider-compare.
    test.fixme("[EP] groups several providers under one run", async ({ http }) => {
      const run = (await openRun(http)).body as RunBody;

      const first = await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });
      const second = await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect((first.body as ResultBody).runId).toBe(run.id);
      expect((second.body as ResultBody).status).toBe("succeeded");

      const detail = await http(cookie).get(`${RUNS}/${run.id}`);
      expect(detail.status).toBe(200);
      expect((detail.body as RunBody).results).toHaveLength(2);
    });

    test("[DT] a runId that is not yours → 404, and no result is created", async ({ http }) => {
      const otherUserId = await createUser();
      const foreign = await insertMatchRun({
        userId: otherUserId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
      });

      try {
        const before = await countRows("MatchResult");
        const res = await http(cookie).post(MATCH, {
          data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: foreign },
        });

        expect(res.status).toBe(404);
        expect(await countRows("MatchResult")).toBe(before);
      } finally {
        // Cascades the foreign run, which points at OUR documents.
        await deleteUsers([otherUserId]);
      }
    });

    test("[DT] a runId for a different pair of documents → 400", async ({ http }) => {
      const otherCv = await createDoc(http, "CV", "Another CV entirely.");
      const run = (await openRun(http, otherCv, jdDocId)).body as RunBody;

      const res = await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });

      expect(res.status).toBe(400);
    });
  });

  test.describe("provider failure", () => {
    // FIXME(migrated): needs AiService (FakeAiService.failNext = AiProviderError("no_quota")) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests multi-provider-compare.
    test.fixme("[EP] a dead provider yields 201 with status=failed, not 503", async ({ http }) => {
      const run = (await openRun(http)).body as RunBody;
      // in-process: FakeAiService.failNext = new AiProviderError("no_quota");

      const res = await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });

      expect(res.status).toBe(201);
      const body = res.body as ResultBody;
      expect(body.status).toBe("failed");
      expect(body.errorCode).toBe("no_quota");
      expect(body.overallScore).toBe(0);
      // The snapshot survives so the card can still say which provider died.
      expect(body.provider).toBe("openrouter");
      expect(body.chatModel).toBe("openai/gpt-4o-mini");
    });

    // FIXME(migrated): needs AiService (FakeAiService.failNext = AiProviderError("unreachable")) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests multi-provider-compare.
    test.fixme("[EP] errorCode stays inside the closed set — never a provider message", async ({ http }) => {
      const run = (await openRun(http)).body as RunBody;
      // in-process: FakeAiService.failNext = new AiProviderError("unreachable");

      const res = await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });

      const body = res.body as ResultBody;
      expect(ERROR_CODES).toContain(body.errorCode);
      expect(JSON.stringify(body)).not.toContain("fake-key");
    });

    // FIXME(migrated): needs AiService (FakeAiService.failNext = AiProviderError("invalid_key"), then a succeeding call) injected in-process; over HTTP both POST /match calls would call the real OpenRouter. Decide in /write-tests multi-provider-compare.
    test.fixme("[ST] one failure does not take down the rest of the run", async ({ http }) => {
      const run = (await openRun(http)).body as RunBody;

      // in-process: FakeAiService.failNext = new AiProviderError("invalid_key");
      await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });
      await http(cookie).post(MATCH, {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id },
      });

      const detail = await http(cookie).get(`${RUNS}/${run.id}`);
      const results = (detail.body as RunBody).results ?? [];
      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.status === "failed")).toHaveLength(1);
      expect(results.filter((r) => r.status === "succeeded")).toHaveLength(1);
    });
  });

  test.describe("GET /match/runs/:id", () => {
    test("[EP] is not shadowed by GET /match/:id", async ({ http }) => {
      const run = (await openRun(http)).body as RunBody;
      const res = await http(cookie).get(`${RUNS}/${run.id}`);
      // If the route order were wrong, "runs" would be parsed as a match id
      // and ParseUUIDPipe would answer 400.
      expect(res.status).toBe(200);
    });

    test("[EP] a run with no results yet returns an empty list, not a 404", async ({ http }) => {
      const run = (await openRun(http)).body as RunBody;
      const res = await http(cookie).get(`${RUNS}/${run.id}`);

      expect(res.status).toBe(200);
      expect((res.body as RunBody).results).toEqual([]);
    });

    test("[authz] another user's run → 404", async ({ http }) => {
      const otherUserId = await createUser();
      const foreign = await insertMatchRun({
        userId: otherUserId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
      });

      try {
        const res = await http(cookie).get(`${RUNS}/${foreign}`);
        expect(res.status).toBe(404);
      } finally {
        await deleteUsers([otherUserId]);
      }
    });
  });

  test.describe("rows that predate runs", () => {
    test("[EP] a runless result is still readable and reports succeeded", async ({ http }) => {
      const legacy = await insertMatchResult({
        userId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        scores: [71, 80, 60],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      const res = await http(cookie).get(`${MATCH}/${legacy}`);

      expect(res.status).toBe(200);
      const body = res.body as ResultBody;
      expect(body.runId).toBeNull();
      expect(body.status).toBe("succeeded");
      expect(body.errorCode).toBeNull();
    });
  });
});
