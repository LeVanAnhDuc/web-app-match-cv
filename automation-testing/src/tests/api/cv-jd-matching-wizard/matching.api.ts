import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { HttpFactory } from "@/api/http.client";
import { deleteDocuments, deleteMatchResults, insertDocument, insertMatchResult } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/matching.e2e-spec.ts. That suite replaced AiService with FakeAiService (deterministic
// embeddings + a fixed report) or UnconfiguredAiService. Over HTTP the dev server's AiService is real, so:
//   - the cases whose assertion needs a match to be COMPUTED (happy path, unconfigured 503) are fixme;
//   - the match the GET /match/:id cases read is seeded through `pg` instead of POST /match (setup only);
//   - validation / ownership / kind checks run live: the service rejects them before any provider call.

interface DocumentResponseBody {
  id: string;
}

interface MatchResultBody {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  report: { strengths: string[]; gaps: string[]; suggestions: string[] };
  createdAt: string;
}

interface MatchSummaryBody {
  id: string;
  cvTitle: string;
  jdTitle: string;
  overallScore: number;
  createdAt: string;
}

const createDocument = async (http: HttpFactory, cookie: string, data: Record<string, unknown>) =>
  ((await http(cookie).post("/documents", { data })).body as DocumentResponseBody).id;

test.describe("Matching (e2e)", () => {
  let userId: string;
  let cookie: string;
  const createdDocumentIds: string[] = [];
  const createdMatchIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  test.beforeAll(async ({ http }) => {
    ({ userId, cookie } = await createSignedInUser());

    cvDocId = await createDocument(http, cookie, {
      kind: "CV",
      sourceText: "Experienced TypeScript NestJS backend engineer, 5 years.",
      save: false,
    });
    jdDocId = await createDocument(http, cookie, {
      kind: "JD",
      sourceText: "Looking for a TypeScript NestJS backend engineer.",
      save: false,
    });
    createdDocumentIds.push(cvDocId, jdDocId);
  });

  test.afterAll(async () => {
    await deleteMatchResults(createdMatchIds);
    await deleteDocuments(createdDocumentIds);
    await deleteUsers([userId]);
  });

  test.describe("POST /match", () => {
    // FIXME(migrated): needs AiService (FakeAiService: deterministic embed + fixed report) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests cv-jd-matching-wizard.
    test.fixme("[happy] matches CV+JD → 201 with scores + report shape", async ({ http }) => {
      const res = await http(cookie).post("/match", {
        data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId },
      });

      expect(res.status).toBe(201);
      const body = res.body as MatchResultBody;
      createdMatchIds.push(body.id);

      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.jdDocumentId).toBe(jdDocId);
      for (const key of ["overallScore", "semanticScore", "keywordScore"] as const) {
        expect(body[key]).toEqual(expect.any(Number));
        expect(Number.isInteger(body[key])).toBe(true);
        expect(body[key]).toBeGreaterThanOrEqual(0);
        expect(body[key]).toBeLessThanOrEqual(100);
      }
      expect(body.overallScore).toBe(Math.round(0.6 * body.semanticScore + 0.4 * body.keywordScore));
      expect(body.report.strengths.length).toBeGreaterThan(0);
      expect(body.report.gaps.length).toBeGreaterThan(0);
      expect(body.report.suggestions.length).toBeGreaterThan(0);
      expect(body.createdAt).toEqual(expect.any(String));
    });

    test("[EP] missing jdDocumentId → 400", async ({ http }) => {
      const res = await http(cookie).post("/match", { data: { cvDocumentId: cvDocId } });
      expect(res.status).toBe(400);
    });

    test("[EP] cvDocumentId belongs to another user → 400", async ({ http }) => {
      const otherUserId = await createUser();
      const otherDoc = await insertDocument({
        userId: otherUserId,
        kind: "CV",
        title: "Other user CV",
        sourceFormat: "text",
        rawText: "other user cv content",
        isSaved: false,
      });

      try {
        const res = await http(cookie).post("/match", {
          data: { cvDocumentId: otherDoc, jdDocumentId: jdDocId },
        });
        expect(res.status).toBe(400);
      } finally {
        await deleteUsers([otherUserId]);
      }
    });

    test("[DT] cv/jd kind swapped → 400", async ({ http }) => {
      const res = await http(cookie).post("/match", {
        data: { cvDocumentId: jdDocId, jdDocumentId: cvDocId },
      });
      expect(res.status).toBe(400);
    });
  });

  test.describe("GET /match/:id", () => {
    let matchId: string;

    test.beforeAll(async () => {
      // In-process this was POST /match on FakeAiService; seeded directly so no real provider is called.
      matchId = await insertMatchResult({
        userId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        scores: [70, 75, 63],
        report: {
          strengths: ["Mock strength: relevant backend skills"],
          gaps: ["Mock gap: missing a keyword from the JD"],
          suggestions: ["Mock suggestion: quantify impact with metrics"],
        },
      });
      createdMatchIds.push(matchId);
    });

    test("[EP] returns the match result for the current (stub) user", async ({ http }) => {
      const res = await http(cookie).get(`/match/${matchId}`);
      expect(res.status).toBe(200);
      expect((res.body as MatchResultBody).id).toBe(matchId);
    });

    test("[EP] per-user isolation: another user's match → 404", async ({ http }) => {
      const otherUserId = await createUser();
      const otherMatch = await insertMatchResult({
        userId: otherUserId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        scores: [50, 50, 50],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      try {
        const res = await http(cookie).get(`/match/${otherMatch}`);
        expect(res.status).toBe(404);
      } finally {
        await deleteUsers([otherUserId]);
      }
    });

    test("[boundary] non-existent (but valid uuid) id → 404", async ({ http }) => {
      const res = await http(cookie).get(`/match/${randomUUID()}`);
      expect(res.status).toBe(404);
    });
  });

  test.describe("GET /match (list)", () => {
    test("[happy] lists own matches newest-first with cvTitle/jdTitle, excludes other users and detail fields", async ({
      http,
    }) => {
      const cv1 = await createDocument(http, cookie, {
        kind: "CV",
        sourceText: "CV Alpha content",
        save: true,
        title: "CV Alpha",
      });
      const jd1 = await createDocument(http, cookie, {
        kind: "JD",
        sourceText: "JD Alpha content",
        save: true,
        title: "JD Alpha",
      });
      const cv2 = await createDocument(http, cookie, {
        kind: "CV",
        sourceText: "CV Beta content",
        save: true,
        title: "CV Beta",
      });
      const jd2 = await createDocument(http, cookie, {
        kind: "JD",
        sourceText: "JD Beta content",
        save: true,
        title: "JD Beta",
      });
      createdDocumentIds.push(cv1, jd1, cv2, jd2);

      const older = await insertMatchResult({
        userId,
        cvDocumentId: cv1,
        jdDocumentId: jd1,
        scores: [40, 40, 40],
        report: { strengths: [], gaps: [], suggestions: [] },
        createdAt: new Date(Date.now() - 60_000),
      });
      const newer = await insertMatchResult({
        userId,
        cvDocumentId: cv2,
        jdDocumentId: jd2,
        scores: [80, 80, 80],
        report: { strengths: [], gaps: [], suggestions: [] },
      });
      createdMatchIds.push(older, newer);

      const otherUserId = await createUser();
      const otherMatch = await insertMatchResult({
        userId: otherUserId,
        cvDocumentId: cv1,
        jdDocumentId: jd1,
        scores: [10, 10, 10],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      // try/finally: this other-user fixture references cv1/jd1 via FK — if an
      // assertion below throws, it MUST still be deleted here, otherwise the
      // outer afterAll's document cleanup fails with a FK RESTRICT violation.
      try {
        const res = await http(cookie).get("/match");
        expect(res.status).toBe(200);
        const body = res.body as MatchSummaryBody[];

        // NOTE: a shared dev DB may carry other pre-existing rows for this
        // user's file (and the "GET /match/:id" seed is still alive here), so we
        // assert on OUR two fixtures' presence/shape/relative order and overall
        // response invariants, rather than an exact total length.
        const ids = body.map((item) => item.id);
        expect(ids).not.toContain(otherMatch);
        expect(ids).toContain(newer);
        expect(ids).toContain(older);

        // newest-first: our newer fixture must sort before our older one,
        // and the whole response must be sorted by createdAt desc.
        expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
        const createdAtTimestamps = body.map((item) => new Date(item.createdAt).getTime());
        const sortedDesc = [...createdAtTimestamps].sort((a, b) => b - a);
        expect(createdAtTimestamps).toEqual(sortedDesc);

        const newerItem = body.find((item) => item.id === newer);
        const olderItem = body.find((item) => item.id === older);
        expect(newerItem?.cvTitle).toBe("CV Beta");
        expect(newerItem?.jdTitle).toBe("JD Beta");
        expect(newerItem?.overallScore).toBe(80);
        expect(newerItem?.createdAt).toEqual(expect.any(String));
        expect(olderItem?.cvTitle).toBe("CV Alpha");
        expect(olderItem?.jdTitle).toBe("JD Alpha");

        for (const item of body) {
          expect((item as unknown as Record<string, unknown>).report).toBeUndefined();
          expect((item as unknown as Record<string, unknown>).semanticScore).toBeUndefined();
          expect((item as unknown as Record<string, unknown>).keywordScore).toBeUndefined();
        }
      } finally {
        await deleteUsers([otherUserId]);
      }
    });
  });
});

test.describe("Matching (e2e) — AI provider not configured", () => {
  let userId: string;
  let cookie: string;
  const createdDocumentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  test.beforeAll(async ({ http }) => {
    ({ userId, cookie } = await createSignedInUser());

    cvDocId = await createDocument(http, cookie, {
      kind: "CV",
      sourceText: "CV text for unconfigured test",
      save: false,
    });
    jdDocId = await createDocument(http, cookie, {
      kind: "JD",
      sourceText: "JD text for unconfigured test",
      save: false,
    });
    createdDocumentIds.push(cvDocId, jdDocId);
  });

  test.afterAll(async () => {
    await deleteDocuments(createdDocumentIds);
    await deleteUsers([userId]);
  });

  // FIXME(migrated): needs AiService (UnconfiguredAiService, isSystemConfigured() = false) injected in-process; over HTTP this would call the real OpenRouter when the dev server has a key. Decide in /write-tests cv-jd-matching-wizard.
  test.fixme("[EP] POST /match → 503 when AiService.isConfigured() is false", async ({ http }) => {
    const res = await http(cookie).post("/match", {
      data: { cvDocumentId: cvDocId, jdDocumentId: jdDocId },
    });
    expect(res.status).toBe(503);
  });
});
