import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { countRows, findDocument, insertDocument, insertMatchResult, sql } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/cv-rewrite.e2e-spec.ts. That suite replaced AiService with FakeAiService, which returned one
// honest change and one fabricated one. Over HTTP the dev server's AiService is real, so the one case that reaches
// generateCvRewrite (a real OpenRouter call) is fixme. Everything else is decided before the provider (ownership,
// failed match) or never involves it (accept applies the user's own approved changes), and runs live.

const REWRITE = "/cv-rewrite";
const ACCEPT = "/cv-rewrite/accept";
const DOCUMENTS = "/documents";

const CV_TEXT = [
  "EXPERIENCE",
  "- Built REST APIs with Node.js and Express for an internal billing system.",
  "- Led the migration of a monolith to three services, cutting deploy time.",
].join("\n");

const API_BULLET = "Built REST APIs with Node.js and Express for an internal billing system.";

const FABRICATION = "Certified Kubernetes Administrator since 2019";

interface DocBody {
  id: string;
  title: string;
  rawText: string;
  parentId: string | null;
  kind: string;
  sourceFormat: string;
  isSaved: boolean;
}

interface ProposalBody {
  matchResultId: string;
  cvDocumentId: string;
  cvTitle: string;
  provider: string;
  chatModel: string;
  changes: Array<{ id: string; original: string; replacement: string }>;
  unaddressedGaps: string[];
}

test.describe("CvRewrite (e2e)", () => {
  let userId: string;
  let cookie: string;
  const documentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;
  let matchId: string;

  const createMatchRow = (status: "succeeded" | "failed" = "succeeded") =>
    insertMatchResult({
      userId,
      cvDocumentId: cvDocId,
      jdDocumentId: jdDocId,
      status,
      scores: status === "failed" ? [0, 0, 0] : [61, 70, 48],
      report: {
        strengths: ["Node.js"],
        gaps: ["No CI/CD experience"],
        suggestions: ["Mention pipelines"],
      },
    });

  test.beforeAll(async ({ http }) => {
    ({ userId, cookie } = await createSignedInUser());

    const createDoc = async (kind: "CV" | "JD", text: string) => {
      const res = await http(cookie).post(DOCUMENTS, { data: { kind, sourceText: text, save: false } });
      const { id } = res.body as DocBody;
      documentIds.push(id);
      return id;
    };
    cvDocId = await createDoc("CV", CV_TEXT);
    jdDocId = await createDoc("JD", "Hiring a backend engineer with CI/CD.");
    matchId = await createMatchRow();
  });

  test.afterAll(async () => {
    // Rewritten CVs are children of the seeded CV — clear them first, then the
    // matches that reference the documents, then the documents themselves.
    await sql('DELETE FROM "Document" WHERE "parentId" = ANY($1::text[])', [documentIds]);
    await sql('DELETE FROM "MatchResult" WHERE "cvDocumentId" = ANY($1::text[])', [documentIds]);
    await sql('DELETE FROM "Document" WHERE id = ANY($1::text[])', [documentIds]);
    await deleteUsers([userId]);
  });

  test.describe("POST /cv-rewrite", () => {
    // FIXME(migrated): needs AiService (FakeAiService.generateCvRewrite: one anchored + one fabricated change) injected in-process; over HTTP this would call the real OpenRouter. Decide in /write-tests cv-rewrite-assistant.
    test.fixme("[EP] proposes only changes anchored in the CV", async ({ http }) => {
      const res = await http(cookie).post(REWRITE, { data: { matchResultId: matchId } });

      expect(res.status).toBe(201);
      const body = res.body as ProposalBody;
      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].original).toBe(API_BULLET);
      // The fabricated change never reaches the user, in any field.
      expect(JSON.stringify(body)).not.toContain(FABRICATION);
      expect(body.unaddressedGaps).toEqual(["5 years of Kubernetes in production"]);
      // No key can leak through the proposal.
      expect(JSON.stringify(body)).not.toContain("fake-key");
    });

    test("[authz] another user's match result → 404", async ({ http }) => {
      const otherUserId = await createUser();
      const foreign = await insertMatchResult({
        userId: otherUserId,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        scores: [50, 50, 50],
        report: { strengths: [], gaps: [], suggestions: [] },
      });

      try {
        const res = await http(cookie).post(REWRITE, { data: { matchResultId: foreign } });
        expect(res.status).toBe(404);
      } finally {
        // Cascades the foreign match, which points at OUR documents.
        await deleteUsers([otherUserId]);
      }
    });

    test("[EP] an unknown match id → 404", async ({ http }) => {
      const res = await http(cookie).post(REWRITE, { data: { matchResultId: randomUUID() } });
      expect(res.status).toBe(404);
    });

    test("[EP] a failed match has no report to rewrite → 400", async ({ http }) => {
      const failedId = await createMatchRow("failed");
      const res = await http(cookie).post(REWRITE, { data: { matchResultId: failedId } });
      expect(res.status).toBe(400);
    });
  });

  test.describe("POST /cv-rewrite/accept", () => {
    test("[ST] saves a NEW document linked to the original, leaving it untouched", async ({ http }) => {
      const before = await http(cookie).get(`${DOCUMENTS}/${cvDocId}`);

      const res = await http(cookie).post(ACCEPT, {
        data: {
          matchResultId: matchId,
          title: "My CV (improved)",
          changes: [
            {
              original: API_BULLET,
              replacement: "Built, documented and deployed REST APIs.",
            },
          ],
        },
      });

      expect(res.status).toBe(201);
      const created = res.body as DocBody;
      expect(created.parentId).toBe(cvDocId);
      expect(created.kind).toBe("CV");
      expect(created.sourceFormat).toBe("text");
      expect(created.isSaved).toBe(true);
      expect(created.rawText).toContain("Built, documented and deployed REST APIs.");
      // Unapproved content survives verbatim.
      expect(created.rawText).toContain("- Led the migration of a monolith to three services, cutting deploy time.");

      // ADR #13: the original is never overwritten.
      const after = await http(cookie).get(`${DOCUMENTS}/${cvDocId}`);
      expect((after.body as DocBody).rawText).toBe((before.body as DocBody).rawText);
      expect((after.body as DocBody).parentId).toBeNull();
    });

    test("[DT] a change that is not anchored in the CV → 400 and nothing is created", async ({ http }) => {
      const before = await countRows("Document");

      const res = await http(cookie).post(ACCEPT, {
        data: {
          matchResultId: matchId,
          title: "Forged CV",
          changes: [{ original: FABRICATION, replacement: `${FABRICATION} (CKA).` }],
        },
      });

      expect(res.status).toBe(400);
      expect(await countRows("Document")).toBe(before);
    });

    test("[DT] two changes editing the same excerpt → 400", async ({ http }) => {
      const res = await http(cookie).post(ACCEPT, {
        data: {
          matchResultId: matchId,
          title: "Overlapping",
          changes: [
            { original: API_BULLET, replacement: "Built REST APIs." },
            {
              original: "REST APIs with Node.js and Express",
              replacement: "REST APIs with Node.js",
            },
          ],
        },
      });
      expect(res.status).toBe(400);
    });

    test("[BVA] an empty change list → 400 from validation", async ({ http }) => {
      const res = await http(cookie).post(ACCEPT, {
        data: { matchResultId: matchId, title: "Empty", changes: [] },
      });
      expect(res.status).toBe(400);
    });

    test("[BVA] a title longer than 200 characters → 400", async ({ http }) => {
      const res = await http(cookie).post(ACCEPT, {
        data: {
          matchResultId: matchId,
          title: "t".repeat(201),
          changes: [{ original: API_BULLET, replacement: "Built APIs." }],
        },
      });
      expect(res.status).toBe(400);
    });

    // Pure schema check (the Document.parentId FK is ON DELETE SET NULL), no endpoint involved — same as in-process.
    test("[ST] deleting the original leaves the rewrite in place, unlinked", async () => {
      const parent = await insertDocument({
        userId,
        kind: "CV",
        title: "Disposable parent",
        sourceFormat: "text",
        rawText: "Backend engineer with Node.js and Express experience.",
        isSaved: true,
      });
      const child = await insertDocument({
        userId,
        kind: "CV",
        title: "Disposable child",
        sourceFormat: "text",
        rawText: "Backend engineer with Node.js, Express and CI/CD.",
        isSaved: true,
        parentId: parent,
      });

      try {
        await sql('DELETE FROM "Document" WHERE id = $1', [parent]);
        const survivor = await findDocument(child);
        // ADR #15: SET NULL, not CASCADE.
        expect(survivor).not.toBeNull();
        expect(survivor?.parentId).toBeNull();
      } finally {
        await sql('DELETE FROM "Document" WHERE id = $1', [child]);
      }
    });
  });
});
