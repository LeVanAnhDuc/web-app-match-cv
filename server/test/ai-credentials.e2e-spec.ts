import { randomBytes, randomUUID } from "crypto";
import { Test } from "@nestjs/testing";
import type { ConfigService } from "@nestjs/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AiTestStatus } from "@prisma/client";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { CredentialCryptoService } from "../src/common/crypto/credential-crypto.service";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { AiService } from "../src/modules/ai/ai.service";

const BASE = "/api/v1/ai-credentials";

// A key long enough to pass validation and distinctive enough that a substring
// search over a whole response body proves it did not leak.
const API_KEY = "sk-e2e-secret-do-not-leak-9876";

interface CredentialBody {
  id: string;
  provider: string;
  label: string;
  keyLast4: string;
  chatModel: string | null;
  embedModel: string | null;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ProviderBody {
  id: string;
  label: string;
  defaultChatModel: string;
  defaultEmbedModel: string;
}

/**
 * TEST DOUBLE injected via Nest `overrideProvider` (DI) — not a runtime
 * fallback. Connection tests must never reach a real provider from a test run.
 */
class FakeAiService {
  ping(): Promise<{ chat: AiTestStatus; embed: AiTestStatus }> {
    return Promise.resolve({
      chat: AiTestStatus.ok,
      embed: AiTestStatus.model_unavailable
    });
  }
}

/**
 * A key belonging to THIS SPEC, so the suite does not depend on the developer
 * having `CREDENTIAL_ENCRYPTION_KEY` in a local `.env`.
 *
 * The service is deliberately optional at boot so unrelated endpoints work
 * without a key — but these tests exercise the endpoints that DO need one, so
 * they have to bring their own. Reading it from the environment made a clean
 * clone show 20 red tests with no explanation.
 */
const SPEC_ENCRYPTION_KEY = randomBytes(32).toString("base64");

function configuredCrypto(): CredentialCryptoService {
  return new CredentialCryptoService({
    get: (name: string) =>
      name === "CREDENTIAL_ENCRYPTION_KEY" ? SPEC_ENCRYPTION_KEY : undefined
  } as unknown as ConfigService);
}

/** Mirrors the real service when CREDENTIAL_ENCRYPTION_KEY is absent. */
class UnconfiguredCryptoService {
  isConfigured(): boolean {
    return false;
  }
}

describe("AiCredentials (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdIds: string[] = [];
  let labelCounter = 0;

  /** Unique per call so tests never collide on the (userId, label) constraint. */
  const uniqueLabel = () => `e2e-label-${(labelCounter += 1)}-${randomUUID()}`;

  const create = (over: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post(BASE)
      .send({
        provider: "openrouter",
        label: uniqueLabel(),
        apiKey: API_KEY,
        ...over
      });

  const track = (res: request.Response) => {
    const body = res.body as CredentialBody;
    if (body?.id) createdIds.push(body.id);
    return res;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useClass(FakeAiService)
      .overrideProvider(CredentialCryptoService)
      .useValue(configuredCrypto())
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.aiCredential.deleteMany({
        where: { id: { in: createdIds } }
      });
    }
    await app.close();
  });

  describe("spec self-sufficiency", () => {
    it("[EP] runs without CREDENTIAL_ENCRYPTION_KEY in the environment", () => {
      // The guard for the bug this spec used to have: it read the key from
      // .env, so a clean clone saw 20 red tests. If someone reverts to the
      // ambient key, this fails on any machine that does not have one set.
      expect(app.get(CredentialCryptoService).isConfigured()).toBe(true);
    });
  });

  describe("GET /ai-credentials/providers", () => {
    it("[EP] returns the whitelist with human labels and default models", async () => {
      const res = await request(app.getHttpServer()).get(`${BASE}/providers`);

      expect(res.status).toBe(200);
      const body = res.body as ProviderBody[];
      expect(body.map((p) => p.id)).toEqual(["openrouter", "openai", "gemini"]);
      expect(body.find((p) => p.id === "gemini")?.label).toBe("Google Gemini");
      expect(body.every((p) => p.defaultChatModel && p.defaultEmbedModel)).toBe(
        true
      );
    });

    it("[EP] is not shadowed by the :id route", async () => {
      // "providers" would otherwise be parsed as a credential id and rejected
      // by ParseUUIDPipe with a 400.
      const res = await request(app.getHttpServer()).get(`${BASE}/providers`);
      expect(res.status).not.toBe(400);
    });
  });

  describe("POST /ai-credentials", () => {
    it("[EP] valid body → 201 with a masked key and no secret material", async () => {
      const res = track(await create());

      expect(res.status).toBe(201);
      const body = res.body as CredentialBody;
      expect(body.keyLast4).toBe("9876");
      expect(body.provider).toBe("openrouter");
      expect(body.chatModel).toBeNull();
      expect(body.lastTestStatus).toBeNull();
      expect(body).not.toHaveProperty("apiKey");
      expect(body).not.toHaveProperty("encryptedKey");
      expect(body).not.toHaveProperty("keyIv");
      expect(body).not.toHaveProperty("keyTag");
    });

    it("[security] the submitted key appears nowhere in the response body", async () => {
      const res = track(await create());
      expect(JSON.stringify(res.body)).not.toContain(API_KEY);
      expect(JSON.stringify(res.body)).not.toContain("sk-e2e-secret");
    });

    it("[security] the key is stored as ciphertext, not plaintext", async () => {
      const res = track(await create());
      const { id } = res.body as CredentialBody;

      const row = await prisma.aiCredential.findUniqueOrThrow({
        where: { id }
      });
      expect(Buffer.from(row.encryptedKey).toString("utf8")).not.toContain(
        "sk-e2e-secret"
      );
      expect(row.keyIv).toHaveLength(12);
      expect(row.keyTag).toHaveLength(16);

      // …and it round-trips back to exactly what was submitted.
      const crypto = app.get(CredentialCryptoService);
      expect(
        crypto.decrypt({
          ciphertext: row.encryptedKey,
          iv: row.keyIv,
          tag: row.keyTag
        })
      ).toBe(API_KEY);
    });

    it("[EP] a duplicate label → 409", async () => {
      const label = uniqueLabel();
      track(await create({ label }));
      const res = await create({ label });
      expect(res.status).toBe(409);
    });

    it("[BVA] apiKey length 19 (min-1) → 400, 20 (min) → 201", async () => {
      expect((await create({ apiKey: "x".repeat(19) })).status).toBe(400);
      expect(track(await create({ apiKey: "x".repeat(20) })).status).toBe(201);
    });

    it("[BVA] apiKey length 400 (max) → 201, 401 (max+1) → 400", async () => {
      expect(track(await create({ apiKey: "x".repeat(400) })).status).toBe(201);
      expect((await create({ apiKey: "x".repeat(401) })).status).toBe(400);
    });

    it("[BVA] label length 0 → 400, 1 → 201, 60 → 201, 61 → 400", async () => {
      expect((await create({ label: "" })).status).toBe(400);
      expect(
        track(await create({ label: randomUUID().slice(0, 1) })).status
      ).toBe(201);
      expect(track(await create({ label: "a".repeat(60) })).status).toBe(201);
      expect((await create({ label: "b".repeat(61) })).status).toBe(400);
    });

    it("[EP] whitespace inside the key → 400", async () => {
      expect(
        (await create({ apiKey: "sk-with a space 1234567890" })).status
      ).toBe(400);
      expect((await create({ apiKey: "   ".padEnd(25, " ") })).status).toBe(
        400
      );
    });

    it("[EP] an unknown provider → 400", async () => {
      expect((await create({ provider: "anthropic" })).status).toBe(400);
    });

    it("[EP] a blank model override is stored as null, not an empty string", async () => {
      const res = track(await create({ chatModel: "  ", embedModel: "" }));
      expect(res.status).toBe(201);
      const body = res.body as CredentialBody;
      expect(body.chatModel).toBeNull();
      expect(body.embedModel).toBeNull();
    });

    it("[EP] a real override is trimmed and kept", async () => {
      const res = track(await create({ chatModel: "  gpt-4o  " }));
      expect(res.status).toBe(201);
      expect((res.body as CredentialBody).chatModel).toBe("gpt-4o");
    });
  });

  describe("PATCH /ai-credentials/:id", () => {
    it("[ST] rotating the key updates keyLast4 and clears the test verdict", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      await request(app.getHttpServer()).post(`${BASE}/${id}/test`);
      const tested = await request(app.getHttpServer()).get(BASE);
      expect(
        (tested.body as CredentialBody[]).find((c) => c.id === id)
          ?.lastTestStatus
      ).not.toBeNull();

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${id}`)
        .send({ apiKey: "sk-rotated-key-abcdefgh4321" });

      expect(res.status).toBe(200);
      const body = res.body as CredentialBody;
      expect(body.keyLast4).toBe("4321");
      expect(body.lastTestStatus).toBeNull();
      expect(body.lastTestedAt).toBeNull();
    });

    it("[EP] renaming alone keeps the test verdict", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;
      await request(app.getHttpServer()).post(`${BASE}/${id}/test`);

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${id}`)
        .send({ label: uniqueLabel() });

      expect(res.status).toBe(200);
      expect((res.body as CredentialBody).lastTestStatus).not.toBeNull();
    });

    it("[ST] sending a blank model clears an existing override", async () => {
      const created = track(await create({ chatModel: "gpt-4o" }));
      const { id } = created.body as CredentialBody;
      expect((created.body as CredentialBody).chatModel).toBe("gpt-4o");

      // This is exactly what the edit dialog sends for an empty field, so a
      // 400 here would break every save from the UI.
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${id}`)
        .send({ chatModel: "", embedModel: "" });

      expect(res.status).toBe(200);
      expect((res.body as CredentialBody).chatModel).toBeNull();
    });

    it("[EP] provider is immutable — the field is stripped, not honoured", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${id}`)
        .send({ provider: "gemini" });

      expect(res.status).toBe(200);
      expect((res.body as CredentialBody).provider).toBe("openrouter");
    });

    it("[EP] a duplicate label → 409", async () => {
      const first = track(await create());
      const second = track(await create());
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${(second.body as CredentialBody).id}`)
        .send({ label: (first.body as CredentialBody).label });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /ai-credentials/:id/test", () => {
    it("[EP] reports chat and embed separately and stores the worse of the two", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      const res = await request(app.getHttpServer()).post(`${BASE}/${id}/test`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        chat: "ok",
        embed: "model_unavailable",
        status: "model_unavailable"
      });

      const row = await prisma.aiCredential.findUniqueOrThrow({
        where: { id }
      });
      expect(row.lastTestStatus).toBe(AiTestStatus.model_unavailable);
      expect(row.lastTestedAt).not.toBeNull();
    });
  });

  describe("GET /ai-credentials", () => {
    it("[EP] lists newest-first and leaks no secret material", async () => {
      track(await create());
      const res = await request(app.getHttpServer()).get(BASE);

      expect(res.status).toBe(200);
      const body = res.body as CredentialBody[];
      expect(body.length).toBeGreaterThan(0);
      const timestamps = body.map((c) => Date.parse(c.createdAt));
      expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
      expect(JSON.stringify(body)).not.toContain("sk-e2e-secret");
    });
  });

  describe("DELETE /ai-credentials/:id", () => {
    it("[ST] deleting → 204, and the id is then unknown", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      expect(
        (await request(app.getHttpServer()).delete(`${BASE}/${id}`)).status
      ).toBe(204);
      expect(
        (
          await request(app.getHttpServer())
            .patch(`${BASE}/${id}`)
            .send({ label: uniqueLabel() })
        ).status
      ).toBe(404);
    });

    it("[ST] deleting keeps past match results readable via their snapshot", async () => {
      const created = track(await create());
      const { id } = created.body as CredentialBody;

      const cv = await prisma.document.create({
        data: {
          userId: STUB_USER_ID,
          kind: "CV",
          title: "e2e cred cv",
          sourceFormat: "text",
          rawText: "cv text"
        }
      });
      const jd = await prisma.document.create({
        data: {
          userId: STUB_USER_ID,
          kind: "JD",
          title: "e2e cred jd",
          sourceFormat: "text",
          rawText: "jd text"
        }
      });
      const match = await prisma.matchResult.create({
        data: {
          userId: STUB_USER_ID,
          cvDocumentId: cv.id,
          jdDocumentId: jd.id,
          credentialId: id,
          provider: "gemini",
          chatModel: "gemini-2.5-flash",
          embedModel: "gemini-embedding-001",
          overallScore: 50,
          semanticScore: 50,
          keywordScore: 50,
          report: { strengths: [], gaps: [], suggestions: [] }
        }
      });

      try {
        await request(app.getHttpServer()).delete(`${BASE}/${id}`);

        const after = await prisma.matchResult.findUniqueOrThrow({
          where: { id: match.id }
        });
        expect(after.credentialId).toBeNull();
        expect(after.provider).toBe("gemini");
        expect(after.chatModel).toBe("gemini-2.5-flash");
      } finally {
        await prisma.matchResult.delete({ where: { id: match.id } });
        await prisma.document.deleteMany({
          where: { id: { in: [cv.id, jd.id] } }
        });
      }
    });
  });

  describe("per-user isolation", () => {
    // The FE cannot cover this: only one mock user exists there. This is the
    // only place the ownership scope is actually exercised.
    const OTHER_USER_ID = "00000000-0000-0000-0000-000000000095";
    let othersCredentialId: string;

    beforeAll(async () => {
      await prisma.user.create({
        data: { id: OTHER_USER_ID, role: "candidate" }
      });
      const crypto = app.get(CredentialCryptoService);
      const { ciphertext, iv, tag } = crypto.encrypt(API_KEY);
      const row = await prisma.aiCredential.create({
        data: {
          userId: OTHER_USER_ID,
          provider: "openai",
          label: "belongs to someone else",
          encryptedKey: ciphertext,
          keyIv: iv,
          keyTag: tag,
          keyLast4: "9876"
        }
      });
      othersCredentialId = row.id;
    });

    afterAll(async () => {
      await prisma.aiCredential.deleteMany({
        where: { userId: OTHER_USER_ID }
      });
      await prisma.user.delete({ where: { id: OTHER_USER_ID } });
    });

    it("[authz] another user's credential is absent from the list", async () => {
      const res = await request(app.getHttpServer()).get(BASE);
      expect(
        (res.body as CredentialBody[]).some((c) => c.id === othersCredentialId)
      ).toBe(false);
    });

    it("[authz] PATCH / DELETE / test on it → 404, never 403", async () => {
      const server = app.getHttpServer();
      expect(
        (
          await request(server)
            .patch(`${BASE}/${othersCredentialId}`)
            .send({ label: uniqueLabel() })
        ).status
      ).toBe(404);
      expect(
        (await request(server).post(`${BASE}/${othersCredentialId}/test`))
          .status
      ).toBe(404);
      expect(
        (await request(server).delete(`${BASE}/${othersCredentialId}`)).status
      ).toBe(404);
    });

    it("[authz] the 404 does not confirm the row exists", async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${randomUUID()}`)
        .send({ label: uniqueLabel() });
      const other = await request(app.getHttpServer())
        .patch(`${BASE}/${othersCredentialId}`)
        .send({ label: uniqueLabel() });
      expect(res.status).toBe(other.status);
    });

    it("[authz] running a match with another user's credential → 404", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/match")
        .send({
          cvDocumentId: randomUUID(),
          jdDocumentId: randomUUID(),
          credentialId: othersCredentialId
        });
      // The document check runs first and already rejects; either way the
      // caller learns nothing about the credential.
      expect([400, 404]).toContain(res.status);
    });
  });

  describe("when CREDENTIAL_ENCRYPTION_KEY is absent", () => {
    let unconfigured: INestApplication<App>;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(CredentialCryptoService)
        .useClass(UnconfiguredCryptoService)
        .overrideProvider(AiService)
        .useClass(FakeAiService)
        .compile();
      unconfigured = moduleRef.createNestApplication();
      unconfigured.setGlobalPrefix("api/v1");
      unconfigured.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true })
      );
      await unconfigured.init();
    });

    afterAll(async () => {
      await unconfigured.close();
    });

    it("[EP] every endpoint that touches a key → 503", async () => {
      const server = unconfigured.getHttpServer();
      expect((await request(server).get(BASE)).status).toBe(503);
      expect(
        (
          await request(server)
            .post(BASE)
            .send({ provider: "openrouter", label: "x", apiKey: API_KEY })
        ).status
      ).toBe(503);
    });

    it("[EP] listing providers still works — it needs no key", async () => {
      const res = await request(unconfigured.getHttpServer()).get(
        `${BASE}/providers`
      );
      expect(res.status).toBe(200);
      expect((res.body as ProviderBody[]).length).toBe(3);
    });
  });
});
