import { randomBytes, randomUUID } from "crypto";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  AiProviderError,
  AiService,
  type ChatPrompt,
  type CoverLetterDraft
} from "../src/modules/ai/ai.service";
import type { AiRuntimeConfig } from "../src/modules/ai/providers";
import { MUST_NOT_CLAIM_HEADING } from "../src/modules/cover-letters/prompt";

const LETTERS = "/api/v1/cover-letters";
const FAKE_KEY = "fake-key-000000000000";

const ERROR_CODES = [
  "invalid_key",
  "no_quota",
  "model_unavailable",
  "timeout",
  "unreachable"
];

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

/**
 * TEST DOUBLE injected via Nest DI. `lastPrompt` is what lets this suite
 * assert the ADR #13 grounding constraint end to end: the gaps of the match
 * must actually reach the provider as a forbidden list.
 */
class FakeAiService {
  static failNext: AiProviderError | null = null;
  static lastPrompt: ChatPrompt | null = null;

  isSystemConfigured(): boolean {
    return true;
  }

  systemRuntimeConfig(): AiRuntimeConfig {
    return {
      provider: "openrouter",
      apiKey: FAKE_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small"
    };
  }

  embed(text: string): Promise<number[]> {
    return Promise.resolve([text.length, 1, 0]);
  }

  generateReport(): Promise<{
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  }> {
    return Promise.resolve({
      strengths: ["Six years of Node.js"],
      gaps: ["Kubernetes"],
      suggestions: ["Add metrics"]
    });
  }

  generateCoverLetter(prompt: ChatPrompt): Promise<CoverLetterDraft> {
    FakeAiService.lastPrompt = prompt;
    if (FakeAiService.failNext) {
      const error = FakeAiService.failNext;
      FakeAiService.failNext = null;
      return Promise.reject(error);
    }
    return Promise.resolve({
      body: "Dear hiring manager,\n\nI am writing to apply.",
      omittedRequirements: ["Kubernetes"]
    });
  }
}

describe("CoverLetters (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const documentIds: string[] = [];
  let cvDocId: string;
  let jdDocId: string;
  let matchId: string;

  const createDoc = async (kind: "CV" | "JD", text: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .send({ kind, sourceText: text, save: false });
    const { id } = res.body as IdBody;
    documentIds.push(id);
    return id;
  };

  const generate = (body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post(LETTERS)
      .send({
        matchResultId: matchId,
        tone: "formal",
        length: "standard",
        language: "en",
        ...body
      });

  /**
   * Seed a row straight through Prisma.
   *
   * POST /cover-letters is capped at 10/min on purpose (it spends AI budget),
   * and that cap is production behaviour worth keeping honest — so the tests
   * that are about the EDIT and DELETE contracts do not spend generation calls
   * to get a row to work on.
   */
  const seedLetter = (over: Record<string, unknown> = {}) =>
    prisma.coverLetter.create({
      data: {
        userId: STUB_USER_ID,
        matchResultId: matchId,
        tone: "formal",
        length: "standard",
        language: "en",
        content: "Dear hiring manager,",
        omittedRequirements: [],
        status: "succeeded",
        provider: "openrouter",
        chatModel: "openai/gpt-4o-mini",
        ...over
      }
    });

  beforeAll(async () => {
    // Without a key the credential service answers 503 before it ever checks
    // ownership, which would hide the 404 this suite is here to prove. A
    // throwaway key is enough: no ciphertext written here is ever decrypted.
    process.env.CREDENTIAL_ENCRYPTION_KEY ??=
      randomBytes(32).toString("base64");

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

    cvDocId = await createDoc("CV", "Six years of Node.js and PostgreSQL.");
    jdDocId = await createDoc("JD", "Senior engineer, Kubernetes required.");

    const match = await request(app.getHttpServer())
      .post("/api/v1/match")
      .send({ cvDocumentId: cvDocId, jdDocumentId: jdDocId });
    matchId = (match.body as IdBody).id;
  });

  afterEach(() => {
    FakeAiService.failNext = null;
  });

  afterAll(async () => {
    // Letters cascade with their match; matches must go before the documents.
    await prisma.coverLetter.deleteMany({
      where: { userId: STUB_USER_ID, matchResultId: matchId }
    });
    await prisma.matchResult.deleteMany({
      where: { cvDocumentId: { in: documentIds } }
    });
    await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
    await app.close();
  });

  describe("POST /cover-letters", () => {
    it("[EP] generates a letter from an owned, succeeded match", async () => {
      const res = await generate();

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
    it("[grounding] sends the match's gaps as a forbidden list", () => {
      const prompt = FakeAiService.lastPrompt;
      expect(prompt).not.toBeNull();
      const forbiddenIndex = prompt!.user.indexOf(MUST_NOT_CLAIM_HEADING);
      expect(forbiddenIndex).toBeGreaterThanOrEqual(0);
      expect(prompt!.user.indexOf("Kubernetes")).toBeGreaterThan(
        forbiddenIndex
      );
      expect(prompt!.system).toMatch(/traceable to the CV/i);
    });

    it("[EP] a match that is not yours → 404 and nothing is written", async () => {
      const before = await prisma.coverLetter.count();
      const res = await generate({ matchResultId: randomUUID() });

      expect(res.status).toBe(404);
      expect(await prisma.coverLetter.count()).toBe(before);
    });

    it("[EP] a failed match → 400, there is no report to write from", async () => {
      const failed = await prisma.matchResult.create({
        data: {
          userId: STUB_USER_ID,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini",
          embedModel: "openai/text-embedding-3-small",
          status: "failed",
          errorCode: "no_quota",
          overallScore: 0,
          semanticScore: 0,
          keywordScore: 0,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      const res = await generate({ matchResultId: failed.id });
      expect(res.status).toBe(400);
    });

    it("[DT] failed match + someone else's credential → the match check wins, no row", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000091";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreignCred = await prisma.aiCredential.create({
        data: {
          userId: otherUserId,
          provider: "openrouter",
          label: "foreign-cl",
          encryptedKey: Buffer.from("x"),
          keyIv: Buffer.from("x"),
          keyTag: Buffer.from("x"),
          keyLast4: "1234"
        }
      });
      const failed = await prisma.matchResult.create({
        data: {
          userId: STUB_USER_ID,
          cvDocumentId: cvDocId,
          jdDocumentId: jdDocId,
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini",
          embedModel: "openai/text-embedding-3-small",
          status: "failed",
          errorCode: "no_quota",
          overallScore: 0,
          semanticScore: 0,
          keywordScore: 0,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      try {
        const before = await prisma.coverLetter.count();
        const res = await generate({
          matchResultId: failed.id,
          credentialId: foreignCred.id
        });

        // The context is validated first, so 400 beats the credential's 404.
        expect(res.status).toBe(400);
        expect(await prisma.coverLetter.count()).toBe(before);
      } finally {
        await prisma.aiCredential.delete({ where: { id: foreignCred.id } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });

    it("[DT] valid match + someone else's credential → 404 and no row", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000092";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreignCred = await prisma.aiCredential.create({
        data: {
          userId: otherUserId,
          provider: "openrouter",
          label: "foreign-cl-2",
          encryptedKey: Buffer.from("x"),
          keyIv: Buffer.from("x"),
          keyTag: Buffer.from("x"),
          keyLast4: "1234"
        }
      });

      try {
        const before = await prisma.coverLetter.count();
        const res = await generate({ credentialId: foreignCred.id });

        expect(res.status).toBe(404);
        expect(await prisma.coverLetter.count()).toBe(before);
      } finally {
        await prisma.aiCredential.delete({ where: { id: foreignCred.id } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });

    it("[EP] a dead provider yields 201 with status=failed and a closed-set code, not 503", async () => {
      FakeAiService.failNext = new AiProviderError("no_quota");
      const res = await generate();

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
    });

    it("[EP] a non-uuid matchResultId → 400 from validation", async () => {
      const res = await generate({ matchResultId: "not-a-uuid" });
      expect(res.status).toBe(400);
    });

    it("[EP] an unknown tone → 400 from validation", async () => {
      const res = await generate({ tone: "sarcastic" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /cover-letters", () => {
    it("[EP] lists the letters of one match, newest first", async () => {
      await seedLetter({ language: "vi", tone: "friendly", length: "short" });

      const res = await request(app.getHttpServer())
        .get(LETTERS)
        .query({ matchResultId: matchId });

      expect(res.status).toBe(200);
      const rows = res.body as LetterBody[];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].language).toBe("vi");
      expect(JSON.stringify(rows)).not.toContain(FAKE_KEY);
    });

    it("[EP] matchResultId is required", async () => {
      const res = await request(app.getHttpServer()).get(LETTERS);
      expect(res.status).toBe(400);
    });

    it("[authz] another user's match yields an empty list, not a 403", async () => {
      const otherUserId = "00000000-0000-0000-0000-000000000090";
      await prisma.user.create({
        data: { id: otherUserId, role: "candidate" }
      });
      const foreignMatch = await prisma.matchResult.create({
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
      const foreignLetter = await prisma.coverLetter.create({
        data: {
          userId: otherUserId,
          matchResultId: foreignMatch.id,
          tone: "formal",
          length: "short",
          language: "en",
          content: "secret letter",
          omittedRequirements: [],
          status: "succeeded",
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini"
        }
      });

      try {
        const res = await request(app.getHttpServer())
          .get(LETTERS)
          .query({ matchResultId: foreignMatch.id });

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);

        // and the row itself is unreachable by id
        const patch = await request(app.getHttpServer())
          .patch(`${LETTERS}/${foreignLetter.id}`)
          .send({ content: "hijacked" });
        expect(patch.status).toBe(404);

        const del = await request(app.getHttpServer()).delete(
          `${LETTERS}/${foreignLetter.id}`
        );
        expect(del.status).toBe(404);
      } finally {
        await prisma.coverLetter.delete({ where: { id: foreignLetter.id } });
        await prisma.matchResult.delete({ where: { id: foreignMatch.id } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });
  });

  describe("PATCH /cover-letters/:id", () => {
    it("[ST] an edit marks the row as edited", async () => {
      const created = await seedLetter();

      const res = await request(app.getHttpServer())
        .patch(`${LETTERS}/${created.id}`)
        .send({ content: "My own words." });

      expect(res.status).toBe(200);
      const body = res.body as LetterBody;
      expect(body.content).toBe("My own words.");
      expect(body.edited).toBe(true);
    });

    it("[BVA] empty content → 400; one character → 200", async () => {
      const created = await seedLetter();

      const empty = await request(app.getHttpServer())
        .patch(`${LETTERS}/${created.id}`)
        .send({ content: "" });
      expect(empty.status).toBe(400);

      const one = await request(app.getHttpServer())
        .patch(`${LETTERS}/${created.id}`)
        .send({ content: "x" });
      expect(one.status).toBe(200);
    });

    it("[BVA] 20000 chars accepted, 20001 rejected", async () => {
      const created = await seedLetter();

      const max = await request(app.getHttpServer())
        .patch(`${LETTERS}/${created.id}`)
        .send({ content: "a".repeat(20_000) });
      expect(max.status).toBe(200);

      const over = await request(app.getHttpServer())
        .patch(`${LETTERS}/${created.id}`)
        .send({ content: "a".repeat(20_001) });
      expect(over.status).toBe(400);
    });

    it("[EP] a failed letter cannot be edited → 400", async () => {
      const failed = await seedLetter({
        status: "failed",
        errorCode: "timeout",
        content: ""
      });

      const res = await request(app.getHttpServer())
        .patch(`${LETTERS}/${failed.id}`)
        .send({ content: "anything" });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /cover-letters/:id", () => {
    it("[ST] removes only that letter", async () => {
      const keep = await seedLetter();
      const drop = await seedLetter();

      const res = await request(app.getHttpServer()).delete(
        `${LETTERS}/${drop.id}`
      );
      expect(res.status).toBe(204);

      const list = await request(app.getHttpServer())
        .get(LETTERS)
        .query({ matchResultId: matchId });
      const ids = (list.body as LetterBody[]).map((row) => row.id);
      expect(ids).not.toContain(drop.id);
      expect(ids).toContain(keep.id);
    });

    it("[EP] an unknown id → 404", async () => {
      const res = await request(app.getHttpServer()).delete(
        `${LETTERS}/${randomUUID()}`
      );
      expect(res.status).toBe(404);
    });
  });
});
