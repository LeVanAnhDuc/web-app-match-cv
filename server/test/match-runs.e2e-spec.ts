import { randomUUID } from "crypto";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { AiProviderError, AiService } from "../src/modules/ai/ai.service";
import type { AiRuntimeConfig } from "../src/modules/ai/providers";

const MATCH = "/api/v1/match";
const RUNS = "/api/v1/match/runs";

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

const ERROR_CODES = [
  "invalid_key",
  "no_quota",
  "model_unavailable",
  "timeout",
  "unreachable"
];

/** Deterministic stand-in for a real embedding vector. */
function vector(text: string): number[] {
  const dims = 8;
  const out = new Array<number>(dims).fill(0);
  for (let i = 0; i < text.length; i += 1) out[i % dims] += text.charCodeAt(i);
  return out;
}

/**
 * TEST DOUBLE injected via Nest `overrideProvider` (DI) — not a runtime
 * fallback. `failNext` lets one test make the provider die without touching
 * the network, which is the whole point of the failed-row contract.
 */
class FakeAiService {
  static failNext: AiProviderError | null = null;

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

  embed(text: string): Promise<number[]> {
    if (FakeAiService.failNext) {
      const error = FakeAiService.failNext;
      FakeAiService.failNext = null;
      return Promise.reject(error);
    }
    return Promise.resolve(vector(text));
  }

  generateReport(): Promise<{
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  }> {
    return Promise.resolve({
      strengths: ["Mock strength"],
      gaps: ["Mock gap"],
      suggestions: ["Mock suggestion"]
    });
  }
}

describe("MatchRuns (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const documentIds: string[] = [];
  const runIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  const createDoc = async (kind: "CV" | "JD", text: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .send({ kind, sourceText: text, save: false });
    const { id } = res.body as IdBody;
    documentIds.push(id);
    return id;
  };

  const openRun = async (cv = cvDocId, jd = jdDocId) => {
    const res = await request(app.getHttpServer())
      .post(RUNS)
      .send({ cvDocumentId: cv, jdDocumentId: jd });
    if (res.status === 201) runIds.push((res.body as RunBody).id);
    return res;
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

    cvDocId = await createDoc("CV", "Senior backend engineer with NestJS.");
    jdDocId = await createDoc("JD", "Hiring a senior backend engineer.");
  });

  afterEach(() => {
    FakeAiService.failNext = null;
  });

  afterAll(async () => {
    // Results cascade with their run; anything runless is cleaned by document.
    if (runIds.length) {
      await prisma.matchRun.deleteMany({ where: { id: { in: runIds } } });
    }
    await prisma.matchResult.deleteMany({
      where: { cvDocumentId: { in: documentIds } }
    });
    await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
    await app.close();
  });

  describe("POST /match/runs", () => {
    it("[EP] opens a run for an owned CV/JD pair", async () => {
      const res = await openRun();

      expect(res.status).toBe(201);
      const body = res.body as RunBody;
      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.jdDocumentId).toBe(jdDocId);
      expect(body.id).toEqual(expect.any(String));
    });

    it("[EP] a document that is not yours → 400", async () => {
      const res = await openRun(randomUUID(), jdDocId);
      expect(res.status).toBe(400);
    });

    it("[EP] swapped kinds → 400", async () => {
      const res = await openRun(jdDocId, cvDocId);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /match with a runId", () => {
    it("[EP] groups several providers under one run", async () => {
      const run = (await openRun()).body as RunBody;

      const first = await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });
      const second = await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect((first.body as ResultBody).runId).toBe(run.id);
      expect((second.body as ResultBody).status).toBe("succeeded");

      const detail = await request(app.getHttpServer()).get(
        `${RUNS}/${run.id}`
      );
      expect(detail.status).toBe(200);
      expect((detail.body as RunBody).results).toHaveLength(2);
    });

    it("[DT] a runId that is not yours → 404, and no result is created", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000094";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreign = await prisma.matchRun.create({
        data: {
          userId: otherUserId,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId
        }
      });

      try {
        const before = await prisma.matchResult.count();
        const res = await request(app.getHttpServer()).post(MATCH).send({
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          runId: foreign.id
        });

        expect(res.status).toBe(404);
        expect(await prisma.matchResult.count()).toBe(before);
      } finally {
        await prisma.matchRun.delete({ where: { id: foreign.id } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });

    it("[DT] a runId for a different pair of documents → 400", async () => {
      const otherCv = await createDoc("CV", "Another CV entirely.");
      const run = (await openRun(otherCv, jdDocId)).body as RunBody;

      const res = await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });

      expect(res.status).toBe(400);
    });
  });

  describe("provider failure", () => {
    it("[EP] a dead provider yields 201 with status=failed, not 503", async () => {
      const run = (await openRun()).body as RunBody;
      FakeAiService.failNext = new AiProviderError("no_quota");

      const res = await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });

      expect(res.status).toBe(201);
      const body = res.body as ResultBody;
      expect(body.status).toBe("failed");
      expect(body.errorCode).toBe("no_quota");
      expect(body.overallScore).toBe(0);
      // The snapshot survives so the card can still say which provider died.
      expect(body.provider).toBe("openrouter");
      expect(body.chatModel).toBe("openai/gpt-4o-mini");
    });

    it("[EP] errorCode stays inside the closed set — never a provider message", async () => {
      const run = (await openRun()).body as RunBody;
      FakeAiService.failNext = new AiProviderError("unreachable");

      const res = await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });

      const body = res.body as ResultBody;
      expect(ERROR_CODES).toContain(body.errorCode);
      expect(JSON.stringify(body)).not.toContain("fake-key");
    });

    it("[ST] one failure does not take down the rest of the run", async () => {
      const run = (await openRun()).body as RunBody;

      FakeAiService.failNext = new AiProviderError("invalid_key");
      await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });
      await request(app.getHttpServer())
        .post(MATCH)
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId, runId: run.id });

      const detail = await request(app.getHttpServer()).get(
        `${RUNS}/${run.id}`
      );
      const results = (detail.body as RunBody).results ?? [];
      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.status === "failed")).toHaveLength(1);
      expect(results.filter((r) => r.status === "succeeded")).toHaveLength(1);
    });
  });

  describe("GET /match/runs/:id", () => {
    it("[EP] is not shadowed by GET /match/:id", async () => {
      const run = (await openRun()).body as RunBody;
      const res = await request(app.getHttpServer()).get(`${RUNS}/${run.id}`);
      // If the route order were wrong, "runs" would be parsed as a match id
      // and ParseUUIDPipe would answer 400.
      expect(res.status).toBe(200);
    });

    it("[EP] a run with no results yet returns an empty list, not a 404", async () => {
      const run = (await openRun()).body as RunBody;
      const res = await request(app.getHttpServer()).get(`${RUNS}/${run.id}`);

      expect(res.status).toBe(200);
      expect((res.body as RunBody).results).toEqual([]);
    });

    it("[authz] another user's run → 404", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000093";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreign = await prisma.matchRun.create({
        data: {
          userId: otherUserId,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId
        }
      });

      try {
        const res = await request(app.getHttpServer()).get(
          `${RUNS}/${foreign.id}`
        );
        expect(res.status).toBe(404);
      } finally {
        await prisma.matchRun.delete({ where: { id: foreign.id } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });
  });

  describe("rows that predate runs", () => {
    it("[EP] a runless result is still readable and reports succeeded", async () => {
      const legacy = await prisma.matchResult.create({
        data: {
          userId: STUB_USER_ID,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini",
          embedModel: "openai/text-embedding-3-small",
          overallScore: 71,
          semanticScore: 80,
          keywordScore: 60,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      const res = await request(app.getHttpServer()).get(
        `${MATCH}/${legacy.id}`
      );

      expect(res.status).toBe(200);
      const body = res.body as ResultBody;
      expect(body.runId).toBeNull();
      expect(body.status).toBe("succeeded");
      expect(body.errorCode).toBeNull();
    });
  });
});
