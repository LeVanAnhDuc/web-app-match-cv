import { randomUUID } from "crypto";
import { Test } from "@nestjs/testing";
import {
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe
} from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AiService } from "../src/modules/matching/ai.service";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";

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

/** Deterministic, dependency-free stand-in for a real embedding vector. */
function deterministicVector(text: string): number[] {
  const dims = 8;
  const vec = new Array<number>(dims).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    vec[i % dims] += text.charCodeAt(i);
  }
  return vec;
}

/**
 * TEST DOUBLE injected via Nest `overrideProvider` (DI) — NOT a runtime
 * fallback/mock. The real `AiService` still throws 503 in production
 * when unconfigured or when the OpenRouter API call fails; this class only
 * replaces it inside this test module so no real OpenRouter key/network call
 * is needed to exercise `/match`.
 */
class FakeAiService {
  isConfigured(): boolean {
    return true;
  }

  embed(text: string): Promise<number[]> {
    return Promise.resolve(deterministicVector(text));
  }

  generateReport(): Promise<{
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  }> {
    return Promise.resolve({
      strengths: ["Mock strength: relevant backend skills"],
      gaps: ["Mock gap: missing a keyword from the JD"],
      suggestions: ["Mock suggestion: quantify impact with metrics"]
    });
  }
}

/** Test double mirroring the real AiService's unconfigured behavior. */
class UnconfiguredAiService {
  isConfigured(): boolean {
    return false;
  }

  embed(): Promise<number[]> {
    return Promise.reject(
      new ServiceUnavailableException(
        "Matching service is not configured. Please contact the administrator."
      )
    );
  }

  generateReport(): Promise<{
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  }> {
    return Promise.reject(
      new ServiceUnavailableException(
        "Matching service is not configured. Please contact the administrator."
      )
    );
  }
}

describe("Matching (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdDocumentIds: string[] = [];
  const createdMatchIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
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

    const cvRes = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .send({
        kind: "CV",
        sourceText: "Experienced TypeScript NestJS backend engineer, 5 years.",
        save: false
      });
    const jdRes = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .send({
        kind: "JD",
        sourceText: "Looking for a TypeScript NestJS backend engineer.",
        save: false
      });
    cvDocId = (cvRes.body as DocumentResponseBody).id;
    jdDocId = (jdRes.body as DocumentResponseBody).id;
    createdDocumentIds.push(cvDocId, jdDocId);
  });

  afterAll(async () => {
    if (createdMatchIds.length) {
      await prisma.matchResult.deleteMany({
        where: { id: { in: createdMatchIds } }
      });
    }
    if (createdDocumentIds.length) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } }
      });
    }
    await app.close();
  });

  describe("POST /match", () => {
    it("[happy] matches CV+JD → 201 with scores + report shape", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/match")
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });

      expect(res.status).toBe(201);
      const body = res.body as MatchResultBody;
      createdMatchIds.push(body.id);

      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.jdDocumentId).toBe(jdDocId);
      for (const key of [
        "overallScore",
        "semanticScore",
        "keywordScore"
      ] as const) {
        expect(body[key]).toEqual(expect.any(Number));
        expect(Number.isInteger(body[key])).toBe(true);
        expect(body[key]).toBeGreaterThanOrEqual(0);
        expect(body[key]).toBeLessThanOrEqual(100);
      }
      expect(body.overallScore).toBe(
        Math.round(0.6 * body.semanticScore + 0.4 * body.keywordScore)
      );
      expect(body.report.strengths.length).toBeGreaterThan(0);
      expect(body.report.gaps.length).toBeGreaterThan(0);
      expect(body.report.suggestions.length).toBeGreaterThan(0);
      expect(body.createdAt).toEqual(expect.any(String));
    });

    it("[EP] missing jdDocumentId → 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/match")
        .send({ cvDocumentId: cvDocId });
      expect(res.status).toBe(400);
    });

    it("[EP] cvDocumentId belongs to another user → 400", async () => {
      const OTHER_USER_ID = "00000000-0000-0000-0000-000000000098";
      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: "candidate" }
      });
      const otherDoc = await prisma.document.create({
        data: {
          userId: OTHER_USER_ID,
          kind: "CV",
          title: "Other user CV",
          sourceFormat: "text",
          rawText: "other user cv content",
          isSaved: false
        }
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/match")
        .send({ cvDocumentId: otherDoc.id, jdDocumentId: jdDocId });
      expect(res.status).toBe(400);

      await prisma.document.delete({ where: { id: otherDoc.id } });
      await prisma.user.delete({ where: { id: OTHER_USER_ID } });
    });

    it("[DT] cv/jd kind swapped → 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/match")
        .send({ cvDocumentId: jdDocId, jdDocumentId: cvDocId });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /match/:id", () => {
    let matchId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/match")
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });
      matchId = (res.body as MatchResultBody).id;
      createdMatchIds.push(matchId);
    });

    it("[EP] returns the match result for the current (stub) user", async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/match/${matchId}`
      );
      expect(res.status).toBe(200);
      expect((res.body as MatchResultBody).id).toBe(matchId);
    });

    it("[EP] per-user isolation: another user's match → 404", async () => {
      const OTHER_USER_ID = "00000000-0000-0000-0000-000000000097";
      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: "candidate" }
      });
      const otherMatch = await prisma.matchResult.create({
        data: {
          userId: OTHER_USER_ID,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          overallScore: 50,
          semanticScore: 50,
          keywordScore: 50,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      const res = await request(app.getHttpServer()).get(
        `/api/v1/match/${otherMatch.id}`
      );
      expect(res.status).toBe(404);

      await prisma.matchResult.delete({ where: { id: otherMatch.id } });
      await prisma.user.delete({ where: { id: OTHER_USER_ID } });
    });

    it("[boundary] non-existent (but valid uuid) id → 404", async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/match/${randomUUID()}`
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /match (list)", () => {
    it("[happy] lists own matches newest-first with cvTitle/jdTitle, excludes other users and detail fields", async () => {
      const cv1Res = await request(app.getHttpServer())
        .post("/api/v1/documents")
        .send({
          kind: "CV",
          sourceText: "CV Alpha content",
          save: true,
          title: "CV Alpha"
        });
      const jd1Res = await request(app.getHttpServer())
        .post("/api/v1/documents")
        .send({
          kind: "JD",
          sourceText: "JD Alpha content",
          save: true,
          title: "JD Alpha"
        });
      const cv2Res = await request(app.getHttpServer())
        .post("/api/v1/documents")
        .send({
          kind: "CV",
          sourceText: "CV Beta content",
          save: true,
          title: "CV Beta"
        });
      const jd2Res = await request(app.getHttpServer())
        .post("/api/v1/documents")
        .send({
          kind: "JD",
          sourceText: "JD Beta content",
          save: true,
          title: "JD Beta"
        });
      const cv1 = (cv1Res.body as DocumentResponseBody).id;
      const jd1 = (jd1Res.body as DocumentResponseBody).id;
      const cv2 = (cv2Res.body as DocumentResponseBody).id;
      const jd2 = (jd2Res.body as DocumentResponseBody).id;
      createdDocumentIds.push(cv1, jd1, cv2, jd2);

      const older = await prisma.matchResult.create({
        data: {
          userId: STUB_USER_ID,
          cvDocumentId: cv1,
          jdDocumentId: jd1,
          overallScore: 40,
          semanticScore: 40,
          keywordScore: 40,
          report: { strengths: [], gaps: [], suggestions: [] },
          createdAt: new Date(Date.now() - 60_000)
        }
      });
      const newer = await prisma.matchResult.create({
        data: {
          userId: STUB_USER_ID,
          cvDocumentId: cv2,
          jdDocumentId: jd2,
          overallScore: 80,
          semanticScore: 80,
          keywordScore: 80,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });
      createdMatchIds.push(older.id, newer.id);

      const OTHER_USER_ID = "00000000-0000-0000-0000-000000000096";
      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: "candidate" }
      });
      const otherMatch = await prisma.matchResult.create({
        data: {
          userId: OTHER_USER_ID,
          cvDocumentId: cv1,
          jdDocumentId: jd1,
          overallScore: 10,
          semanticScore: 10,
          keywordScore: 10,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      // try/finally: this other-user fixture references cv1/jd1 via FK — if an
      // assertion below throws, it MUST still be deleted here, otherwise the
      // outer afterAll's document cleanup fails with a FK RESTRICT violation.
      try {
        const res = await request(app.getHttpServer()).get("/api/v1/match");
        expect(res.status).toBe(200);
        const body = res.body as MatchSummaryBody[];

        // NOTE: earlier tests in this same file ("POST /match" happy-path,
        // "GET /match/:id" beforeAll) already create real MatchResult rows
        // for the same stub user that are still alive here (only cleaned up
        // in the outer afterAll) — plus this is a shared dev DB that may
        // carry other pre-existing rows. So we assert on OUR two fixtures'
        // presence/shape/relative order and overall response invariants,
        // rather than an exact total length.
        const ids = body.map((item) => item.id);
        expect(ids).not.toContain(otherMatch.id);
        expect(ids).toContain(newer.id);
        expect(ids).toContain(older.id);

        // newest-first: our newer fixture must sort before our older one,
        // and the whole response must be sorted by createdAt desc.
        expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
        const createdAtTimestamps = body.map((item) =>
          new Date(item.createdAt).getTime()
        );
        const sortedDesc = [...createdAtTimestamps].sort((a, b) => b - a);
        expect(createdAtTimestamps).toEqual(sortedDesc);

        const newerItem = body.find((item) => item.id === newer.id);
        const olderItem = body.find((item) => item.id === older.id);
        expect(newerItem?.cvTitle).toBe("CV Beta");
        expect(newerItem?.jdTitle).toBe("JD Beta");
        expect(newerItem?.overallScore).toBe(80);
        expect(newerItem?.createdAt).toEqual(expect.any(String));
        expect(olderItem?.cvTitle).toBe("CV Alpha");
        expect(olderItem?.jdTitle).toBe("JD Alpha");

        for (const item of body) {
          expect(
            (item as unknown as Record<string, unknown>).report
          ).toBeUndefined();
          expect(
            (item as unknown as Record<string, unknown>).semanticScore
          ).toBeUndefined();
          expect(
            (item as unknown as Record<string, unknown>).keywordScore
          ).toBeUndefined();
        }
      } finally {
        await prisma.matchResult.delete({ where: { id: otherMatch.id } });
        await prisma.user.delete({ where: { id: OTHER_USER_ID } });
      }
    });
  });
});

describe("Matching (e2e) — AI provider not configured", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdDocumentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(AiService)
      .useClass(UnconfiguredAiService)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const cvRes = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .send({
        kind: "CV",
        sourceText: "CV text for unconfigured test",
        save: false
      });
    const jdRes = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .send({
        kind: "JD",
        sourceText: "JD text for unconfigured test",
        save: false
      });
    cvDocId = (cvRes.body as DocumentResponseBody).id;
    jdDocId = (jdRes.body as DocumentResponseBody).id;
    createdDocumentIds.push(cvDocId, jdDocId);
  });

  afterAll(async () => {
    await prisma.document.deleteMany({
      where: { id: { in: createdDocumentIds } }
    });
    await app.close();
  });

  it("[EP] POST /match → 503 when AiService.isConfigured() is false", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/match")
      .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });
    expect(res.status).toBe(503);
  });
});
