import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/modules/matching/gemini.service';

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
 * fallback/mock. The real `GeminiService` still throws 503 in production
 * when unconfigured or when the Gemini API call fails; this class only
 * replaces it inside this test module so no real Gemini key/network call is
 * needed to exercise `/match`.
 */
class FakeGeminiService {
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
      strengths: ['Mock strength: relevant backend skills'],
      gaps: ['Mock gap: missing a keyword from the JD'],
      suggestions: ['Mock suggestion: quantify impact with metrics'],
    });
  }
}

/** Test double mirroring the real GeminiService's unconfigured behavior. */
class UnconfiguredGeminiService {
  isConfigured(): boolean {
    return false;
  }

  embed(): Promise<number[]> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Matching service is not configured. Please contact the administrator.',
      ),
    );
  }

  generateReport(): Promise<{
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  }> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Matching service is not configured. Please contact the administrator.',
      ),
    );
  }
}

describe('Matching (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdDocumentIds: string[] = [];
  const createdMatchIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeminiService)
      .useClass(FakeGeminiService)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const cvRes = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .send({
        kind: 'CV',
        sourceText: 'Experienced TypeScript NestJS backend engineer, 5 years.',
        save: false,
      });
    const jdRes = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .send({
        kind: 'JD',
        sourceText: 'Looking for a TypeScript NestJS backend engineer.',
        save: false,
      });
    cvDocId = (cvRes.body as DocumentResponseBody).id;
    jdDocId = (jdRes.body as DocumentResponseBody).id;
    createdDocumentIds.push(cvDocId, jdDocId);
  });

  afterAll(async () => {
    if (createdMatchIds.length) {
      await prisma.matchResult.deleteMany({
        where: { id: { in: createdMatchIds } },
      });
    }
    if (createdDocumentIds.length) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }
    await app.close();
  });

  describe('POST /match', () => {
    it('[happy] matches CV+JD → 201 with scores + report shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/match')
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });

      expect(res.status).toBe(201);
      const body = res.body as MatchResultBody;
      createdMatchIds.push(body.id);

      expect(body.cvDocumentId).toBe(cvDocId);
      expect(body.jdDocumentId).toBe(jdDocId);
      for (const key of [
        'overallScore',
        'semanticScore',
        'keywordScore',
      ] as const) {
        expect(body[key]).toEqual(expect.any(Number));
        expect(Number.isInteger(body[key])).toBe(true);
        expect(body[key]).toBeGreaterThanOrEqual(0);
        expect(body[key]).toBeLessThanOrEqual(100);
      }
      expect(body.overallScore).toBe(
        Math.round(0.6 * body.semanticScore + 0.4 * body.keywordScore),
      );
      expect(body.report.strengths.length).toBeGreaterThan(0);
      expect(body.report.gaps.length).toBeGreaterThan(0);
      expect(body.report.suggestions.length).toBeGreaterThan(0);
      expect(body.createdAt).toEqual(expect.any(String));
    });

    it('[EP] missing jdDocumentId → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/match')
        .send({ cvDocumentId: cvDocId });
      expect(res.status).toBe(400);
    });

    it('[EP] cvDocumentId belongs to another user → 400', async () => {
      const OTHER_USER_ID = '00000000-0000-0000-0000-000000000098';
      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: 'candidate' },
      });
      const otherDoc = await prisma.document.create({
        data: {
          userId: OTHER_USER_ID,
          kind: 'CV',
          title: 'Other user CV',
          sourceFormat: 'text',
          rawText: 'other user cv content',
          isSaved: false,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/match')
        .send({ cvDocumentId: otherDoc.id, jdDocumentId: jdDocId });
      expect(res.status).toBe(400);

      await prisma.document.delete({ where: { id: otherDoc.id } });
      await prisma.user.delete({ where: { id: OTHER_USER_ID } });
    });

    it('[DT] cv/jd kind swapped → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/match')
        .send({ cvDocumentId: jdDocId, jdDocumentId: cvDocId });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /match/:id', () => {
    let matchId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/match')
        .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });
      matchId = (res.body as MatchResultBody).id;
      createdMatchIds.push(matchId);
    });

    it('[EP] returns the match result for the current (stub) user', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/match/${matchId}`,
      );
      expect(res.status).toBe(200);
      expect((res.body as MatchResultBody).id).toBe(matchId);
    });

    it("[EP] per-user isolation: another user's match → 404", async () => {
      const OTHER_USER_ID = '00000000-0000-0000-0000-000000000097';
      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: 'candidate' },
      });
      const otherMatch = await prisma.matchResult.create({
        data: {
          userId: OTHER_USER_ID,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          overallScore: 50,
          semanticScore: 50,
          keywordScore: 50,
          report: { strengths: [], gaps: [], suggestions: [] },
        },
      });

      const res = await request(app.getHttpServer()).get(
        `/api/v1/match/${otherMatch.id}`,
      );
      expect(res.status).toBe(404);

      await prisma.matchResult.delete({ where: { id: otherMatch.id } });
      await prisma.user.delete({ where: { id: OTHER_USER_ID } });
    });

    it('[boundary] non-existent (but valid uuid) id → 404', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/match/${randomUUID()}`,
      );
      expect(res.status).toBe(404);
    });
  });
});

describe('Matching (e2e) — Gemini not configured', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdDocumentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeminiService)
      .useClass(UnconfiguredGeminiService)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const cvRes = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .send({
        kind: 'CV',
        sourceText: 'CV text for unconfigured test',
        save: false,
      });
    const jdRes = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .send({
        kind: 'JD',
        sourceText: 'JD text for unconfigured test',
        save: false,
      });
    cvDocId = (cvRes.body as DocumentResponseBody).id;
    jdDocId = (jdRes.body as DocumentResponseBody).id;
    createdDocumentIds.push(cvDocId, jdDocId);
  });

  afterAll(async () => {
    await prisma.document.deleteMany({
      where: { id: { in: createdDocumentIds } },
    });
    await app.close();
  });

  it('[EP] POST /match → 503 when GeminiService.isConfigured() is false', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/match')
      .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });
    expect(res.status).toBe(503);
  });
});
