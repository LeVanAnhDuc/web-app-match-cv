import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { deleteMatchResults, findDocument, insertDocument, insertMatchResult, sql } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/comparison.e2e-spec.ts. No AI call anywhere (comparisons read stored match rows), so every
// case runs live; the rows the old suite seeded through PrismaService go through `pg` (@/utils/db).

const COMPARISONS = "/comparisons";
const DOCUMENTS = "/documents";

interface ComparisonBody {
  base: { id: string; title: string; version: number };
  revision: { id: string; title: string; version: number };
  jdDocumentId: string | null;
  jdOptions: Array<{ id: string; hasBase: boolean; hasRevision: boolean }>;
  baseResult: { matchResultId: string } | null;
  revisionResult: { matchResultId: string } | null;
  delta: { overall: number; semantic: number; keyword: number } | null;
  gapDiff: {
    closed: string[];
    persisted: Array<{ base: string; revision: string }>;
    introduced: string[];
  } | null;
  sameChatModel: boolean;
  sameEmbedModel: boolean;
}

interface DocBody {
  id: string;
  parentId: string | null;
}

test.describe("Comparison (e2e)", () => {
  let userId: string;
  let cookie: string;
  const documentIds: string[] = [];
  let v1: string;
  let v2: string;
  let jdId: string;

  const createDoc = async (kind: "CV" | "JD", title: string, text: string, parentId?: string) => {
    const id = await insertDocument({
      userId,
      kind,
      title,
      sourceFormat: "text",
      rawText: text,
      isSaved: true,
      parentId: parentId ?? null,
    });
    documentIds.push(id);
    return id;
  };

  const createMatch = (input: {
    cvDocumentId: string;
    jdDocumentId?: string;
    scores: [number, number, number];
    gaps: string[];
    createdAt: string;
    status?: "succeeded" | "failed";
    chatModel?: string;
    embedModel?: string;
  }) =>
    insertMatchResult({
      userId,
      cvDocumentId: input.cvDocumentId,
      jdDocumentId: input.jdDocumentId ?? jdId,
      provider: "openrouter",
      chatModel: input.chatModel ?? "openai/gpt-4o-mini",
      embedModel: input.embedModel ?? "openai/text-embedding-3-small",
      status: input.status ?? "succeeded",
      scores: input.scores,
      report: { strengths: [], gaps: input.gaps, suggestions: [] },
      createdAt: input.createdAt,
    });

  test.beforeAll(async () => {
    ({ userId, cookie } = await createSignedInUser());

    v1 = await createDoc("CV", "Backend Resume", "Node.js and Express.");
    v2 = await createDoc("CV", "Backend Resume (improved)", "Node.js, Express and CI/CD pipelines.", v1);
    jdId = await createDoc("JD", "Senior Backend Engineer", "CI/CD required.");

    await createMatch({
      cvDocumentId: v1,
      scores: [61, 70, 48],
      gaps: ["No CI/CD experience mentioned", "Kubernetes not mentioned"],
      createdAt: "2026-08-08T02:00:00.000Z",
    });
    await createMatch({
      cvDocumentId: v2,
      scores: [75, 78, 71],
      gaps: ["CI/CD exposure is still thin", "No Terraform"],
      createdAt: "2026-08-09T02:00:00.000Z",
    });
  });

  test.afterAll(async () => {
    await sql('DELETE FROM "MatchResult" WHERE "cvDocumentId" = ANY($1::text[])', [documentIds]);
    await sql('DELETE FROM "Document" WHERE "parentId" = ANY($1::text[])', [documentIds]);
    await sql('DELETE FROM "Document" WHERE id = ANY($1::text[])', [documentIds]);
    await deleteUsers([userId]);
  });

  test.describe("GET /comparisons/:documentId", () => {
    test("[EP] reports the delta, the gap diff and the version numbers", async ({ http }) => {
      const res = await http(cookie).get(`${COMPARISONS}/${v2}`);

      expect(res.status).toBe(200);
      const body = res.body as ComparisonBody;
      expect(body.base.version).toBe(1);
      expect(body.revision.version).toBe(2);
      expect(body.jdDocumentId).toBe(jdId);
      expect(body.delta).toEqual({ overall: 14, semantic: 8, keyword: 23 });
      // The reworded CI/CD gap must NOT show up as closed AND new.
      expect(body.gapDiff?.persisted).toEqual([
        {
          base: "No CI/CD experience mentioned",
          revision: "CI/CD exposure is still thin",
        },
      ]);
      expect(body.gapDiff?.closed).toEqual(["Kubernetes not mentioned"]);
      expect(body.gapDiff?.introduced).toEqual(["No Terraform"]);
      expect(body.sameChatModel).toBe(true);
      expect(body.jdOptions).toEqual([expect.objectContaining({ id: jdId, hasBase: true, hasRevision: true })]);
    });

    test("[EP] ignores a failed run and keeps using the succeeded one", async ({ http }) => {
      const failed = await createMatch({
        cvDocumentId: v2,
        scores: [0, 0, 0],
        gaps: [],
        createdAt: "2026-08-09T06:00:00.000Z",
        status: "failed",
      });

      try {
        const res = await http(cookie).get(`${COMPARISONS}/${v2}`);
        // A failed row stores 0/0/0; picking it would render -61%.
        expect((res.body as ComparisonBody).delta?.overall).toBe(14);
      } finally {
        await deleteMatchResults([failed]);
      }
    });

    test("[EP] a version that was never matched gets no invented zeroes", async ({ http }) => {
      const lonely = await createDoc("CV", "Unmatched v2", "Fresh text.", v1);

      const res = await http(cookie).get(`${COMPARISONS}/${lonely}`);

      expect(res.status).toBe(200);
      const body = res.body as ComparisonBody;
      expect(body.revisionResult).toBeNull();
      expect(body.delta).toBeNull();
      expect(body.gapDiff).toBeNull();
      // The JD the parent was matched against is still offered.
      expect(body.jdOptions).toEqual([expect.objectContaining({ id: jdId, hasBase: true, hasRevision: false })]);
    });

    test("[EP] a CV with no declared previous version → 400", async ({ http }) => {
      const res = await http(cookie).get(`${COMPARISONS}/${v1}`);
      expect(res.status).toBe(400);
    });

    test("[EP] a JD → 400", async ({ http }) => {
      const res = await http(cookie).get(`${COMPARISONS}/${jdId}`);
      expect(res.status).toBe(400);
    });

    test("[EP] an unknown id → 404", async ({ http }) => {
      const res = await http(cookie).get(`${COMPARISONS}/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    test("[EP] a JD neither version was matched against → 400", async ({ http }) => {
      const res = await http(cookie).get(`${COMPARISONS}/${v2}`, { params: { jdDocumentId: randomUUID() } });
      expect(res.status).toBe(400);
    });

    test("[authz] another user's CV → 404", async ({ http }) => {
      const otherUserId = await createUser();
      const foreignParent = await insertDocument({
        userId: otherUserId,
        kind: "CV",
        title: "Their v1",
        sourceFormat: "text",
        rawText: "…",
        isSaved: true,
      });
      const foreign = await insertDocument({
        userId: otherUserId,
        kind: "CV",
        title: "Their v2",
        sourceFormat: "text",
        rawText: "…",
        isSaved: true,
        parentId: foreignParent,
      });

      try {
        const res = await http(cookie).get(`${COMPARISONS}/${foreign}`);
        expect(res.status).toBe(404);
      } finally {
        await deleteUsers([otherUserId]);
      }
    });
  });

  test.describe("PATCH /documents/:id/parent", () => {
    test("[ST] declares, then clears, a manual lineage link", async ({ http }) => {
      const manual = await createDoc("CV", "Hand edited", "Edited by hand.");

      const linked = await http(cookie).patch(`${DOCUMENTS}/${manual}/parent`, { data: { parentId: v1 } });
      expect(linked.status).toBe(200);
      expect((linked.body as DocBody).parentId).toBe(v1);

      const cleared = await http(cookie).patch(`${DOCUMENTS}/${manual}/parent`, { data: { parentId: null } });
      expect(cleared.status).toBe(200);
      expect((cleared.body as DocBody).parentId).toBeNull();
    });

    test("[ST] a link that would close a loop → 400 and nothing changes", async ({ http }) => {
      const res = await http(cookie).patch(`${DOCUMENTS}/${v1}/parent`, { data: { parentId: v2 } });

      expect(res.status).toBe(400);
      const unchanged = await findDocument(v1);
      expect(unchanged?.parentId).toBeNull();
    });

    test("[DT] a parent of the other kind → 400", async ({ http }) => {
      const res = await http(cookie).patch(`${DOCUMENTS}/${v2}/parent`, { data: { parentId: jdId } });
      expect(res.status).toBe(400);
    });

    test("[DT] a document pointed at itself → 400", async ({ http }) => {
      const res = await http(cookie).patch(`${DOCUMENTS}/${v2}/parent`, { data: { parentId: v2 } });
      expect(res.status).toBe(400);
    });

    test("[EP] a non-uuid parent → 400 from validation", async ({ http }) => {
      const res = await http(cookie).patch(`${DOCUMENTS}/${v2}/parent`, { data: { parentId: "not-a-uuid" } });
      expect(res.status).toBe(400);
    });
  });
});
