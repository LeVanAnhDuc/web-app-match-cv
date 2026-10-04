import { restoreAuthFlowEnv } from "./helpers/auth-flow-env";
import { randomBytes } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { OidcClientService } from "../src/modules/auth/oidc/oidc-client.service";
import { SessionService } from "../src/modules/auth/session.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createSignedInUser, deleteUsers } from "./helpers/auth";

const CLIENT = "http://localhost:5300";
const AUTHORIZE = "http://idp.test/oauth/authorize";

/** Stands in for Ducker ID: records what login asked for, hands back a fixed identity. */
class FakeOidc {
  readonly sub = `e2e-sub-${randomBytes(6).toString("hex")}`;
  readonly email = `${this.sub}@test.local`;
  lastAuthorize: {
    state: string;
    nonce: string;
    codeChallenge: string;
  } | null = null;
  isConfigured() {
    return true;
  }
  authorizeUrl(p: { state: string; nonce: string; codeChallenge: string }) {
    this.lastAuthorize = p;
    return Promise.resolve(`${AUTHORIZE}?state=${p.state}`);
  }
  exchangeCode() {
    return Promise.resolve("fake.id.token");
  }
  verifyIdToken() {
    return Promise.resolve({
      sub: this.sub,
      iss: "http://idp.test",
      aud: "match-cv",
      exp: 0,
      iat: 0,
      email: this.email,
      name: "E2E Person",
      picture: null
    });
  }
}

/** `name=value` of every Set-Cookie for `name` (cleared ones come back as `name=`). */
function setCookies(res: request.Response, name: string): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  return list
    .filter((c) => c.startsWith(`${name}=`))
    .map((c) => c.split(";")[0]);
}
const liveCookie = (res: request.Response, name: string): string | undefined =>
  setCookies(res, name).find((c) => c !== `${name}=`);

describe("Auth flow (e2e) — design §3.2–3.4", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessions: SessionService;
  const fake = new FakeOidc();
  const users: string[] = [];

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OidcClientService)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    sessions = moduleRef.get(SessionService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { externalSub: fake.sub } });
    await deleteUsers(prisma, users);
    await app.close();
    restoreAuthFlowEnv();
  });

  async function login(returnTo: string, cookie?: string) {
    const r = http().get(
      `/api/v1/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    );
    const res = await (cookie ? r.set("Cookie", cookie) : r);
    return { res, oauth: liveCookie(res, "mcv_oauth") };
  }

  it("GET /auth/login redirects to the IdP and sets a short-lived mcv_oauth cookie", async () => {
    const { res, oauth } = await login("/wizard");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${AUTHORIZE}?state=${fake.lastAuthorize?.state}`
    );
    expect(oauth).toBeDefined();
    const header = (res.headers["set-cookie"] as unknown as string[]).find(
      (c) => c.startsWith("mcv_oauth=")
    );
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\/api\/v1\/auth/);
    expect(header).toMatch(/Max-Age=600/);
  });

  it("signs a guest in, carries the guest work into the account, and kills the guest session", async () => {
    const created = await http()
      .post("/api/v1/documents")
      .send({
        kind: "CV",
        sourceText: "TypeScript NestJS engineer.",
        save: false
      })
      .expect(201);
    const guestCookie = liveCookie(created, "mcv_session");
    expect(guestCookie).toBeDefined();
    const docId = (created.body as { id: string }).id;
    const guestToken = guestCookie!.slice("mcv_session=".length);
    const guest = await sessions.resolve(guestToken);
    expect(guest?.isGuest).toBe(true);
    users.push(guest!.userId);

    const { oauth } = await login("/wizard", guestCookie);
    const state = fake.lastAuthorize!.state;
    const cb = await http()
      .get(
        `/api/v1/auth/callback?code=c&state=${state}&iss=${encodeURIComponent("http://idp.test")}`
      )
      .set("Cookie", [guestCookie!, oauth!].join("; "));

    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe(`${CLIENT}/wizard?claimed=1`);
    const userCookie = liveCookie(cb, "mcv_session");
    expect(userCookie).toBeDefined();
    expect(userCookie).not.toBe(guestCookie);
    expect(setCookies(cb, "mcv_oauth")).toEqual(["mcv_oauth="]);

    const user = await prisma.user.findUnique({
      where: { externalSub: fake.sub }
    });
    expect(user).toMatchObject({
      isGuest: false,
      email: fake.email,
      fullName: "E2E Person"
    });
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    expect(doc).toMatchObject({ userId: user!.id, isSaved: true });
    expect(
      await prisma.user.findUnique({ where: { id: guest!.userId } })
    ).toBeNull();
    expect(await sessions.resolve(guestToken)).toBeNull();

    const me = await http()
      .get("/api/v1/auth/me")
      .set("Cookie", userCookie!)
      .expect(200);
    expect(me.body).toMatchObject({
      status: "user",
      user: { id: user!.id, email: fake.email },
      guestQuota: null
    });
  });

  it("a state that does not match the sealed one ends at /?authError=state with no session", async () => {
    const { oauth } = await login("/wizard");
    const cb = await http()
      .get("/api/v1/auth/callback?code=c&state=forged")
      .set("Cookie", oauth!);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe(`${CLIENT}/?authError=state`);
    expect(liveCookie(cb, "mcv_session")).toBeUndefined();
  });

  it("a callback without the mcv_oauth cookie is rejected as state", async () => {
    await login("/wizard");
    const cb = await http().get(
      `/api/v1/auth/callback?code=c&state=${fake.lastAuthorize!.state}`
    );
    expect(cb.headers.location).toBe(`${CLIENT}/?authError=state`);
  });

  it("an IdP refusal ends at /?authError=denied", async () => {
    const { oauth } = await login("/");
    const cb = await http()
      .get("/api/v1/auth/callback?error=access_denied")
      .set("Cookie", oauth!);
    expect(cb.headers.location).toBe(`${CLIENT}/?authError=denied`);
  });

  it("an iss that is not OIDC_ISSUER ends at /?authError=iss", async () => {
    const { oauth } = await login("/");
    const cb = await http()
      .get(
        `/api/v1/auth/callback?code=c&state=${fake.lastAuthorize!.state}&iss=${encodeURIComponent("http://evil.test")}`
      )
      .set("Cookie", oauth!);
    expect(cb.headers.location).toBe(`${CLIENT}/?authError=iss`);
  });

  it("an off-site returnTo collapses to / (no open redirect)", async () => {
    const { oauth } = await login("//evil.test/x");
    const cb = await http()
      .get(`/api/v1/auth/callback?code=c&state=${fake.lastAuthorize!.state}`)
      .set("Cookie", oauth!);
    expect(cb.headers.location).toBe(`${CLIENT}/`);
  });

  it("a signed-in user calling /auth/login goes straight back to returnTo", async () => {
    const u = await createSignedInUser(prisma);
    users.push(u.userId);
    const { res, oauth } = await login("/wizard?runId=r1", u.cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${CLIENT}/wizard?runId=r1`);
    expect(oauth).toBeUndefined();
  });

  it("POST /auth/logout answers 204 and the cookie stops authenticating", async () => {
    const u = await createSignedInUser(prisma);
    users.push(u.userId);
    await http().get("/api/v1/documents").set("Cookie", u.cookie).expect(200);
    const out = await http()
      .post("/api/v1/auth/logout")
      .set("Cookie", u.cookie)
      .expect(204);
    expect(setCookies(out, "mcv_session")).toEqual(["mcv_session="]);
    await http().get("/api/v1/documents").set("Cookie", u.cookie).expect(401);
  });

  it("GET /auth/me for an anonymous caller reports the IP quota", async () => {
    const me = await http().get("/api/v1/auth/me").expect(200);
    const body = me.body as {
      status: string;
      user: unknown;
      guestQuota: { limit: number; used: number; resetsAt: string };
    };
    expect(body.status).toBe("anonymous");
    expect(body.user).toBeNull();
    expect(typeof body.guestQuota.limit).toBe("number");
    expect(typeof body.guestQuota.used).toBe("number");
    expect(Number.isNaN(Date.parse(body.guestQuota.resetsAt))).toBe(false);
  });

  it("GET /auth/me for a signed-in user returns the profile", async () => {
    const u = await createSignedInUser(prisma, { email: "me-e2e@test.local" });
    users.push(u.userId);
    const me = await http()
      .get("/api/v1/auth/me")
      .set("Cookie", u.cookie)
      .expect(200);
    expect(me.body).toMatchObject({
      status: "user",
      user: { id: u.userId, email: "me-e2e@test.local" },
      guestQuota: null
    });
  });
});
