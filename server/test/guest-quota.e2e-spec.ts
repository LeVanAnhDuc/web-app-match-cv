import "./helpers/guest-quota-env";
import { randomUUID } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/modules/ai/ai.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createGuestUser, deleteUsers } from "./helpers/auth";

// Test double via DI: the quota must be decided before any provider is called,
// so the AI stand-in only has to fail fast (no network, no real key).
class FailingAiService {
  systemRuntimeConfig() {
    return {
      provider: "openrouter",
      apiKey: "fake-key-000000000000",
      baseUrl: "https://openrouter.ai/api/v1",
      chatModel: "m",
      embedModel: "e"
    };
  }
  embed(): Promise<number[]> {
    return Promise.reject(new Error("provider down"));
  }
  generateReport(): Promise<never> {
    return Promise.reject(new Error("provider down"));
  }
}

describe("Guest quota (e2e)", () => {
  let ctx: { app: INestApplication<App>; prisma: PrismaService };
  let cookie: string;
  let userId: string;
  let cvId: string;
  let jdId: string;
  let runId: string;

  const post = (path: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(`/api/v1${path}`)
      .set("Cookie", cookie)
      .send(body);

  const clearToday = () =>
    ctx.prisma
      .$executeRaw`DELETE FROM "GuestUsage" WHERE "day" = (now() AT TIME ZONE 'UTC')::date`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useClass(FailingAiService)
      .compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    ctx = { app, prisma: moduleRef.get(PrismaService) };
    await clearToday();
    ({ userId, cookie } = await createGuestUser(ctx.prisma));
    const cv = await post("/documents", {
      kind: "CV",
      sourceText: "TypeScript NestJS engineer.",
      save: false
    });
    const jd = await post("/documents", {
      kind: "JD",
      sourceText: "Looking for a TypeScript NestJS engineer.",
      save: false
    });
    cvId = (cv.body as { id: string }).id;
    jdId = (jd.body as { id: string }).id;
    const run = await post("/match/runs", {
      cvDocumentId: cvId,
      jdDocumentId: jdId
    });
    runId = (run.body as { id: string }).id;
  });

  afterAll(async () => {
    await clearToday();
    await deleteUsers(ctx.prisma, [userId]);
    await ctx.app.close();
  });

  it("lets the first system-key match through, then answers 429 with resetsAt", async () => {
    const body = { cvDocumentId: cvId, jdDocumentId: jdId, runId };
    const first = await post("/match", body);
    // The AI stand-in fails, so any status is fine except the auth/quota blocks.
    expect([401, 403, 429]).not.toContain(first.status);

    const second = await post("/match", body);
    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({
      code: "GUEST_QUOTA_EXCEEDED",
      limit: 1
    });
    expect(typeof (second.body as { resetsAt: string }).resetsAt).toBe(
      "string"
    );
  });

  it("forbids a guest credential with 403 GUEST_FORBIDDEN_CREDENTIAL", async () => {
    const res = await post("/match", {
      cvDocumentId: cvId,
      jdDocumentId: jdId,
      credentialId: randomUUID()
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "GUEST_FORBIDDEN_CREDENTIAL" });
  });
});
