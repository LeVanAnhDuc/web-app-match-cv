import { randomUUID } from "crypto";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import { PrismaService } from "../src/prisma/prisma.service";

const COMPARISONS = "/api/v1/comparisons";
const DOCUMENTS = "/api/v1/documents";

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

describe("Comparison (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const documentIds: string[] = [];
  let v1: string;
  let v2: string;
  let jdId: string;

  const createDoc = async (
    kind: "CV" | "JD",
    title: string,
    text: string,
    parentId?: string
  ) => {
    const created = await prisma.document.create({
      data: {
        userId: STUB_USER_ID,
        kind,
        title,
        sourceFormat: "text",
        rawText: text,
        isSaved: true,
        parentId: parentId ?? null
      }
    });
    documentIds.push(created.id);
    return created.id;
  };

  const createMatch = async (input: {
    cvDocumentId: string;
    jdDocumentId?: string;
    scores: [number, number, number];
    gaps: string[];
    createdAt: string;
    status?: "succeeded" | "failed";
    chatModel?: string;
    embedModel?: string;
  }) => {
    const row = await prisma.matchResult.create({
      data: {
        userId: STUB_USER_ID,
        cvDocumentId: input.cvDocumentId,
        jdDocumentId: input.jdDocumentId ?? jdId,
        provider: "openrouter",
        chatModel: input.chatModel ?? "openai/gpt-4o-mini",
        embedModel: input.embedModel ?? "openai/text-embedding-3-small",
        status: input.status ?? "succeeded",
        overallScore: input.scores[0],
        semanticScore: input.scores[1],
        keywordScore: input.scores[2],
        report: { strengths: [], gaps: input.gaps, suggestions: [] },
        createdAt: new Date(input.createdAt)
      }
    });
    return row.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    v1 = await createDoc("CV", "Backend Resume", "Node.js and Express.");
    v2 = await createDoc(
      "CV",
      "Backend Resume (improved)",
      "Node.js, Express and CI/CD pipelines.",
      v1
    );
    jdId = await createDoc("JD", "Senior Backend Engineer", "CI/CD required.");

    await createMatch({
      cvDocumentId: v1,
      scores: [61, 70, 48],
      gaps: ["No CI/CD experience mentioned", "Kubernetes not mentioned"],
      createdAt: "2026-08-08T02:00:00.000Z"
    });
    await createMatch({
      cvDocumentId: v2,
      scores: [75, 78, 71],
      gaps: ["CI/CD exposure is still thin", "No Terraform"],
      createdAt: "2026-08-09T02:00:00.000Z"
    });
  });

  afterAll(async () => {
    await prisma.matchResult.deleteMany({
      where: { cvDocumentId: { in: documentIds } }
    });
    await prisma.document.deleteMany({
      where: { parentId: { in: documentIds } }
    });
    await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
    await app.close();
  });

  describe("GET /comparisons/:documentId", () => {
    it("[EP] reports the delta, the gap diff and the version numbers", async () => {
      const res = await request(app.getHttpServer()).get(
        `${COMPARISONS}/${v2}`
      );

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
          revision: "CI/CD exposure is still thin"
        }
      ]);
      expect(body.gapDiff?.closed).toEqual(["Kubernetes not mentioned"]);
      expect(body.gapDiff?.introduced).toEqual(["No Terraform"]);
      expect(body.sameChatModel).toBe(true);
      expect(body.jdOptions).toEqual([
        expect.objectContaining({ id: jdId, hasBase: true, hasRevision: true })
      ]);
    });

    it("[EP] ignores a failed run and keeps using the succeeded one", async () => {
      const failed = await createMatch({
        cvDocumentId: v2,
        scores: [0, 0, 0],
        gaps: [],
        createdAt: "2026-08-09T06:00:00.000Z",
        status: "failed"
      });

      try {
        const res = await request(app.getHttpServer()).get(
          `${COMPARISONS}/${v2}`
        );
        // A failed row stores 0/0/0; picking it would render -61%.
        expect((res.body as ComparisonBody).delta?.overall).toBe(14);
      } finally {
        await prisma.matchResult.delete({ where: { id: failed } });
      }
    });

    it("[EP] a version that was never matched gets no invented zeroes", async () => {
      const lonely = await createDoc("CV", "Unmatched v2", "Fresh text.", v1);

      const res = await request(app.getHttpServer()).get(
        `${COMPARISONS}/${lonely}`
      );

      expect(res.status).toBe(200);
      const body = res.body as ComparisonBody;
      expect(body.revisionResult).toBeNull();
      expect(body.delta).toBeNull();
      expect(body.gapDiff).toBeNull();
      // The JD the parent was matched against is still offered.
      expect(body.jdOptions).toEqual([
        expect.objectContaining({ id: jdId, hasBase: true, hasRevision: false })
      ]);
    });

    it("[EP] a CV with no declared previous version → 400", async () => {
      const res = await request(app.getHttpServer()).get(
        `${COMPARISONS}/${v1}`
      );
      expect(res.status).toBe(400);
    });

    it("[EP] a JD → 400", async () => {
      const res = await request(app.getHttpServer()).get(
        `${COMPARISONS}/${jdId}`
      );
      expect(res.status).toBe(400);
    });

    it("[EP] an unknown id → 404", async () => {
      const res = await request(app.getHttpServer()).get(
        `${COMPARISONS}/${randomUUID()}`
      );
      expect(res.status).toBe(404);
    });

    it("[EP] a JD neither version was matched against → 400", async () => {
      const res = await request(app.getHttpServer())
        .get(`${COMPARISONS}/${v2}`)
        .query({ jdDocumentId: randomUUID() });
      expect(res.status).toBe(400);
    });

    it("[authz] another user's CV → 404", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000093";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreignParent = await prisma.document.create({
        data: {
          userId: otherUserId,
          kind: "CV",
          title: "Their v1",
          sourceFormat: "text",
          rawText: "…",
          isSaved: true
        }
      });
      const foreign = await prisma.document.create({
        data: {
          userId: otherUserId,
          kind: "CV",
          title: "Their v2",
          sourceFormat: "text",
          rawText: "…",
          isSaved: true,
          parentId: foreignParent.id
        }
      });

      try {
        const res = await request(app.getHttpServer()).get(
          `${COMPARISONS}/${foreign.id}`
        );
        expect(res.status).toBe(404);
      } finally {
        await prisma.document.deleteMany({
          where: { id: { in: [foreign.id, foreignParent.id] } }
        });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });
  });

  describe("PATCH /documents/:id/parent", () => {
    it("[ST] declares, then clears, a manual lineage link", async () => {
      const manual = await createDoc("CV", "Hand edited", "Edited by hand.");

      const linked = await request(app.getHttpServer())
        .patch(`${DOCUMENTS}/${manual}/parent`)
        .send({ parentId: v1 });
      expect(linked.status).toBe(200);
      expect((linked.body as DocBody).parentId).toBe(v1);

      const cleared = await request(app.getHttpServer())
        .patch(`${DOCUMENTS}/${manual}/parent`)
        .send({ parentId: null });
      expect(cleared.status).toBe(200);
      expect((cleared.body as DocBody).parentId).toBeNull();
    });

    it("[ST] a link that would close a loop → 400 and nothing changes", async () => {
      const res = await request(app.getHttpServer())
        .patch(`${DOCUMENTS}/${v1}/parent`)
        .send({ parentId: v2 });

      expect(res.status).toBe(400);
      const unchanged = await prisma.document.findUnique({ where: { id: v1 } });
      expect(unchanged?.parentId).toBeNull();
    });

    it("[DT] a parent of the other kind → 400", async () => {
      const res = await request(app.getHttpServer())
        .patch(`${DOCUMENTS}/${v2}/parent`)
        .send({ parentId: jdId });
      expect(res.status).toBe(400);
    });

    it("[DT] a document pointed at itself → 400", async () => {
      const res = await request(app.getHttpServer())
        .patch(`${DOCUMENTS}/${v2}/parent`)
        .send({ parentId: v2 });
      expect(res.status).toBe(400);
    });

    it("[EP] a non-uuid parent → 400 from validation", async () => {
      const res = await request(app.getHttpServer())
        .patch(`${DOCUMENTS}/${v2}/parent`)
        .send({ parentId: "not-a-uuid" });
      expect(res.status).toBe(400);
    });
  });
});
