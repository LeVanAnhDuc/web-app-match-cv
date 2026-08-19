import { randomUUID } from "crypto";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { AiService, type RawCvRewrite } from "../src/modules/ai/ai.service";
import type { AiRuntimeConfig } from "../src/modules/ai/providers";

const REWRITE = "/api/v1/cv-rewrite";
const ACCEPT = "/api/v1/cv-rewrite/accept";
const DOCUMENTS = "/api/v1/documents";

const CV_TEXT = [
  "EXPERIENCE",
  "- Built REST APIs with Node.js and Express for an internal billing system.",
  "- Led the migration of a monolith to three services, cutting deploy time."
].join("\n");

const API_BULLET =
  "Built REST APIs with Node.js and Express for an internal billing system.";

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

/**
 * TEST DOUBLE injected via DI — no network. It deliberately returns ONE honest
 * change and ONE fabricated one, so every test exercises the grounding filter
 * rather than a sanitised happy path.
 */
class FakeAiService {
  isSystemConfigured(): boolean {
    return true;
  }

  systemRuntimeConfig(): AiRuntimeConfig {
    return {
      provider: "openrouter",
      apiKey: "fake-key-000000000000",
      baseUrl: "https://openrouter.ai/api/v1",
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small"
    };
  }

  generateCvRewrite(): Promise<RawCvRewrite> {
    return Promise.resolve({
      changes: [
        {
          sectionHint: "Experience",
          original: API_BULLET,
          replacement:
            "Built, documented and deployed REST APIs with Node.js and Express.",
          rationale: "Names the delivery work the JD asks for.",
          addressesGap: "No CI/CD experience"
        },
        {
          sectionHint: "Certifications",
          original: FABRICATION,
          replacement: `${FABRICATION} (CKA).`,
          rationale: "Invented — must never survive.",
          addressesGap: "Kubernetes"
        }
      ],
      unaddressedGaps: ["5 years of Kubernetes in production"]
    });
  }
}

describe("CvRewrite (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const documentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;
  let matchId: string;

  const createDoc = async (kind: "CV" | "JD", text: string) => {
    const res = await request(app.getHttpServer())
      .post(DOCUMENTS)
      .send({ kind, sourceText: text, save: false });
    const { id } = res.body as DocBody;
    documentIds.push(id);
    return id;
  };

  const createMatchRow = async (
    status: "succeeded" | "failed" = "succeeded"
  ) => {
    const row = await prisma.matchResult.create({
      data: {
        userId: STUB_USER_ID,
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId,
        provider: "openrouter",
        chatModel: "openai/gpt-4o-mini",
        embedModel: "openai/text-embedding-3-small",
        status,
        overallScore: status === "failed" ? 0 : 61,
        semanticScore: status === "failed" ? 0 : 70,
        keywordScore: status === "failed" ? 0 : 48,
        report: {
          strengths: ["Node.js"],
          gaps: ["No CI/CD experience"],
          suggestions: ["Mention pipelines"]
        }
      }
    });
    return row.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useClass(FakeAiService)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    cvDocId = await createDoc("CV", CV_TEXT);
    jdDocId = await createDoc("JD", "Hiring a backend engineer with CI/CD.");
    matchId = await createMatchRow();
  });

  afterAll(async () => {
    // Rewritten CVs are children of the seeded CV — clear them first, then the
    // matches that reference the documents, then the documents themselves.
    await prisma.document.deleteMany({
      where: { parentId: { in: documentIds } }
    });
    await prisma.matchResult.deleteMany({
      where: { cvDocumentId: { in: documentIds } }
    });
    await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
    await app.close();
  });

  describe("POST /cv-rewrite", () => {
    it("[EP] proposes only changes anchored in the CV", async () => {
      const res = await request(app.getHttpServer())
        .post(REWRITE)
        .send({ matchResultId: matchId });

      expect(res.status).toBe(201);
      const body = res.body as ProposalBody;
      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].original).toBe(API_BULLET);
      // The fabricated change never reaches the user, in any field.
      expect(JSON.stringify(body)).not.toContain(FABRICATION);
      expect(body.unaddressedGaps).toEqual([
        "5 years of Kubernetes in production"
      ]);
      // No key can leak through the proposal.
      expect(JSON.stringify(body)).not.toContain("fake-key");
    });

    it("[authz] another user's match result → 404", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000092";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreign = await prisma.matchResult.create({
        data: {
          userId: otherUserId,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini",
          embedModel: "openai/text-embedding-3-small",
          overallScore: 50,
          semanticScore: 50,
          keywordScore: 50,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      try {
        const res = await request(app.getHttpServer())
          .post(REWRITE)
          .send({ matchResultId: foreign.id });
        expect(res.status).toBe(404);
      } finally {
        await prisma.matchResult.delete({ where: { id: foreign.id } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });

    it("[EP] an unknown match id → 404", async () => {
      const res = await request(app.getHttpServer())
        .post(REWRITE)
        .send({ matchResultId: randomUUID() });
      expect(res.status).toBe(404);
    });

    it("[EP] a failed match has no report to rewrite → 400", async () => {
      const failedId = await createMatchRow("failed");
      const res = await request(app.getHttpServer())
        .post(REWRITE)
        .send({ matchResultId: failedId });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /cv-rewrite/accept", () => {
    it("[ST] saves a NEW document linked to the original, leaving it untouched", async () => {
      const before = await request(app.getHttpServer()).get(
        `${DOCUMENTS}/${cvDocId}`
      );

      const res = await request(app.getHttpServer())
        .post(ACCEPT)
        .send({
          matchResultId: matchId,
          title: "My CV (improved)",
          changes: [
            {
              original: API_BULLET,
              replacement: "Built, documented and deployed REST APIs."
            }
          ]
        });

      expect(res.status).toBe(201);
      const created = res.body as DocBody;
      expect(created.parentId).toBe(cvDocId);
      expect(created.kind).toBe("CV");
      expect(created.sourceFormat).toBe("text");
      expect(created.isSaved).toBe(true);
      expect(created.rawText).toContain(
        "Built, documented and deployed REST APIs."
      );
      // Unapproved content survives verbatim.
      expect(created.rawText).toContain(
        "- Led the migration of a monolith to three services, cutting deploy time."
      );

      // ADR #13: the original is never overwritten.
      const after = await request(app.getHttpServer()).get(
        `${DOCUMENTS}/${cvDocId}`
      );
      expect((after.body as DocBody).rawText).toBe(
        (before.body as DocBody).rawText
      );
      expect((after.body as DocBody).parentId).toBeNull();
    });

    it("[DT] a change that is not anchored in the CV → 400 and nothing is created", async () => {
      const before = await prisma.document.count();

      const res = await request(app.getHttpServer())
        .post(ACCEPT)
        .send({
          matchResultId: matchId,
          title: "Forged CV",
          changes: [
            { original: FABRICATION, replacement: `${FABRICATION} (CKA).` }
          ]
        });

      expect(res.status).toBe(400);
      expect(await prisma.document.count()).toBe(before);
    });

    it("[DT] two changes editing the same excerpt → 400", async () => {
      const res = await request(app.getHttpServer())
        .post(ACCEPT)
        .send({
          matchResultId: matchId,
          title: "Overlapping",
          changes: [
            { original: API_BULLET, replacement: "Built REST APIs." },
            {
              original: "REST APIs with Node.js and Express",
              replacement: "REST APIs with Node.js"
            }
          ]
        });
      expect(res.status).toBe(400);
    });

    it("[BVA] an empty change list → 400 from validation", async () => {
      const res = await request(app.getHttpServer())
        .post(ACCEPT)
        .send({ matchResultId: matchId, title: "Empty", changes: [] });
      expect(res.status).toBe(400);
    });

    it("[BVA] a title longer than 200 characters → 400", async () => {
      const res = await request(app.getHttpServer())
        .post(ACCEPT)
        .send({
          matchResultId: matchId,
          title: "t".repeat(201),
          changes: [{ original: API_BULLET, replacement: "Built APIs." }]
        });
      expect(res.status).toBe(400);
    });

    it("[ST] deleting the original leaves the rewrite in place, unlinked", async () => {
      const parent = await prisma.document.create({
        data: {
          userId: STUB_USER_ID,
          kind: "CV",
          title: "Disposable parent",
          sourceFormat: "text",
          rawText: "Backend engineer with Node.js and Express experience.",
          isSaved: true
        }
      });
      const child = await prisma.document.create({
        data: {
          userId: STUB_USER_ID,
          kind: "CV",
          title: "Disposable child",
          sourceFormat: "text",
          rawText: "Backend engineer with Node.js, Express and CI/CD.",
          isSaved: true,
          parentId: parent.id
        }
      });

      try {
        await prisma.document.delete({ where: { id: parent.id } });
        const survivor = await prisma.document.findUnique({
          where: { id: child.id }
        });
        // ADR #15: SET NULL, not CASCADE.
        expect(survivor).not.toBeNull();
        expect(survivor?.parentId).toBeNull();
      } finally {
        await prisma.document.deleteMany({ where: { id: child.id } });
      }
    });
  });
});
