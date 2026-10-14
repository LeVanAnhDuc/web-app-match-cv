import { randomBytes } from "node:crypto";
import { test, expect } from "@/fixtures";
import type { HttpFactory } from "@/api/http.client";
import { findDocument, sql } from "@/utils/db";
import {
  createSignedInUser,
  deleteUsers,
  liveCookie,
  resolveSession,
  setCookiesNamed,
} from "@/utils/sessions";

// Ported from server/test/auth-flow.e2e-spec.ts. That suite replaced OidcClientService with FakeOidc below and pinned
// CLIENT_ORIGIN / OIDC_ISSUER / SESSION_SECRET through helpers/auth-flow-env.ts. Over HTTP the dev server uses its
// real OIDC client (Ducker ID discovery) and its own env, so every case that needs the IdP round trip is fixme; the
// cases decided before the IdP is reached (signed-in short-circuit, logout, /auth/me, a callback with no mcv_oauth
// cookie) run live. CLIENT is the dev server's CLIENT_ORIGIN, i.e. the web URL of this ENV (`urls.webUrl`).

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
}

const setCookies = (res: { setCookies: string[] }, name: string) => setCookiesNamed(res.setCookies, name);
const liveOf = (res: { setCookies: string[] }, name: string) => liveCookie(res.setCookies, name);

test.describe("Auth flow (e2e) — design §3.2–3.4", () => {
  const fake = new FakeOidc();
  const users: string[] = [];

  test.afterAll(async () => {
    await sql('DELETE FROM "User" WHERE "externalSub" = $1', [fake.sub]);
    await deleteUsers(users);
  });

  async function login(http: HttpFactory, returnTo: string, cookie?: string) {
    const res = await http(cookie).get(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    return { res, oauth: liveOf(res, "mcv_oauth") };
  }

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process; over HTTP this would call the real Ducker ID (OIDC discovery). Decide in /write-tests auth.
  test.fixme("GET /auth/login redirects to the IdP and sets a short-lived mcv_oauth cookie", async ({ http }) => {
    const { res, oauth } = await login(http, "/wizard");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${AUTHORIZE}?state=${fake.lastAuthorize?.state}`);
    expect(oauth).toBeDefined();
    const header = res.setCookies.find((c) => c.startsWith("mcv_oauth="));
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\/api\/v1\/auth/);
    expect(header).toMatch(/Max-Age=600/);
  });

  // FIXME(migrated): needs OidcClientService (FakeOidc whose authorizeUrl rejects) injected in-process; over HTTP this would call the real Ducker ID (OIDC discovery). Decide in /write-tests auth.
  test.fixme(
    "GET /auth/login redirects to /?authError=server when the IdP cannot be reached",
    async ({ http, urls }) => {
      // in-process: jest.spyOn(fake, "authorizeUrl").mockRejectedValue(new Error("discovery down"))
      const { res, oauth } = await login(http, "/wizard");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${urls.webUrl}/?authError=server`);
      expect(oauth).toBeUndefined();
    }
  );

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process; over HTTP this would call the real Ducker ID (code exchange + id_token). Decide in /write-tests auth.
  test.fixme(
    "signs a guest in, carries the guest work into the account, and kills the guest session",
    async ({ http, urls }) => {
      const created = await http().post("/documents", {
        data: { kind: "CV", sourceText: "TypeScript NestJS engineer.", save: false },
      });
      expect(created.status).toBe(201);
      const guestCookie = liveOf(created, "mcv_session");
      expect(guestCookie).toBeDefined();
      const docId = (created.body as { id: string }).id;
      const guestToken = guestCookie!.slice("mcv_session=".length);
      const guest = await resolveSession(guestToken);
      expect(guest?.isGuest).toBe(true);
      users.push(guest!.userId);

      const { oauth } = await login(http, "/wizard", guestCookie);
      const state = fake.lastAuthorize!.state;
      const cb = await http([guestCookie!, oauth!].join("; ")).get(
        `/auth/callback?code=c&state=${state}&iss=${encodeURIComponent("http://idp.test")}`
      );

      expect(cb.status).toBe(302);
      expect(cb.headers.location).toBe(`${urls.webUrl}/wizard?claimed=1`);
      const userCookie = liveOf(cb, "mcv_session");
      expect(userCookie).toBeDefined();
      expect(userCookie).not.toBe(guestCookie);
      expect(setCookies(cb, "mcv_oauth")).toEqual(["mcv_oauth="]);

      const [user] = await sql<{ id: string; isGuest: boolean; email: string; fullName: string }>(
        'SELECT id, "isGuest", email, "fullName" FROM "User" WHERE "externalSub" = $1',
        [fake.sub]
      );
      expect(user).toMatchObject({
        isGuest: false,
        email: fake.email,
        fullName: "E2E Person",
      });
      const doc = await findDocument(docId);
      expect(doc).toMatchObject({ userId: user!.id, isSaved: true });
      expect(await sql('SELECT id FROM "User" WHERE id = $1', [guest!.userId])).toEqual([]);
      expect(await resolveSession(guestToken)).toBeNull();

      const me = await http(userCookie!).get("/auth/me");
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({
        status: "user",
        user: { id: user!.id, email: fake.email },
        guestQuota: null,
      });
    }
  );

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process to mint a sealed mcv_oauth; over HTTP this would call the real Ducker ID (OIDC discovery). Decide in /write-tests auth.
  test.fixme(
    "a state that does not match the sealed one ends at /?authError=state with no session",
    async ({ http, urls }) => {
      const { oauth } = await login(http, "/wizard");
      const cb = await http(oauth!).get("/auth/callback?code=c&state=forged");
      expect(cb.status).toBe(302);
      expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=state`);
      expect(liveOf(cb, "mcv_session")).toBeUndefined();
      // A stranger's link must not wipe the login in progress.
      expect(setCookies(cb, "mcv_oauth")).toEqual([]);
    }
  );

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process to mint a sealed mcv_oauth; over HTTP this would call the real Ducker ID (OIDC discovery). Decide in /write-tests auth.
  test.fixme("an error with a forged state cannot cancel a pending login", async ({ http, urls }) => {
    const { oauth } = await login(http, "/wizard");
    const cb = await http(oauth!).get("/auth/callback?error=access_denied&state=forged");
    expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=state`);
    expect(setCookies(cb, "mcv_oauth")).toEqual([]);
  });

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process; over HTTP this would call the real Ducker ID (discovery + code exchange). Decide in /write-tests auth.
  test.fixme(
    "a login planted from another browser signs in but never claims this browser's guest",
    async ({ http, urls }) => {
      const created = await http().post("/documents", {
        data: { kind: "CV", sourceText: "Victim CV text.", save: false },
      });
      expect(created.status).toBe(201);
      const victimCookie = liveOf(created, "mcv_session")!;
      const victim = await resolveSession(victimCookie.slice("mcv_session=".length));
      users.push(victim!.userId);
      const docId = (created.body as { id: string }).id;

      // The attacker starts the login in their own browser (no guest)...
      const { oauth: attackerOauth } = await login(http, "/");
      const state = fake.lastAuthorize!.state;
      // ...then plants that mcv_oauth + their code/state on the victim.
      const cb = await http([victimCookie, attackerOauth!].join("; ")).get(`/auth/callback?code=c&state=${state}`);

      expect(cb.status).toBe(302);
      expect(cb.headers.location).toBe(`${urls.webUrl}/`);
      const doc = await findDocument(docId);
      expect(doc).toMatchObject({ userId: victim!.userId, isSaved: false });
    }
  );

  test("a callback without the mcv_oauth cookie is rejected as state", async ({ http, urls }) => {
    // The in-process suite first ran a (faked) login to obtain a real state. Without the sealed cookie the server
    // rejects before it looks at the state or the IdP, so any state proves the same thing and no real login starts.
    const state = randomBytes(16).toString("base64url");
    const cb = await http().get(`/auth/callback?code=c&state=${state}`);
    expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=state`);
  });

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process to mint a sealed mcv_oauth; over HTTP this would call the real Ducker ID (OIDC discovery). Decide in /write-tests auth.
  test.fixme("an IdP refusal carrying our state ends at /?authError=denied", async ({ http, urls }) => {
    const { oauth } = await login(http, "/");
    const cb = await http(oauth!).get(`/auth/callback?error=access_denied&state=${fake.lastAuthorize!.state}`);
    expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=denied`);
    expect(setCookies(cb, "mcv_oauth")).toEqual(["mcv_oauth="]);
  });

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process and OIDC_ISSUER pinned to http://idp.test (helpers/auth-flow-env.ts); over HTTP this would call the real Ducker ID. Decide in /write-tests auth.
  test.fixme("an iss that is not OIDC_ISSUER ends at /?authError=iss", async ({ http, urls }) => {
    const { oauth } = await login(http, "/");
    const cb = await http(oauth!).get(
      `/auth/callback?code=c&state=${fake.lastAuthorize!.state}&iss=${encodeURIComponent("http://evil.test")}`
    );
    expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=iss`);
  });

  // FIXME(migrated): needs OidcClientService (FakeOidc) injected in-process; over HTTP this would call the real Ducker ID (discovery + code exchange). Decide in /write-tests auth.
  test.fixme("an off-site returnTo collapses to / (no open redirect)", async ({ http, urls }) => {
    const { oauth } = await login(http, "//evil.test/x");
    const cb = await http(oauth!).get(`/auth/callback?code=c&state=${fake.lastAuthorize!.state}`);
    expect(cb.headers.location).toBe(`${urls.webUrl}/`);
  });

  test("a signed-in user calling /auth/login goes straight back to returnTo", async ({ http, urls }) => {
    const u = await createSignedInUser();
    users.push(u.userId);
    const { res, oauth } = await login(http, "/wizard?runId=r1", u.cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${urls.webUrl}/wizard?runId=r1`);
    expect(oauth).toBeUndefined();
  });

  test("POST /auth/logout answers 204 and the cookie stops authenticating", async ({ http }) => {
    const u = await createSignedInUser();
    users.push(u.userId);
    expect((await http(u.cookie).get("/documents")).status).toBe(200);
    const out = await http(u.cookie).post("/auth/logout");
    expect(out.status).toBe(204);
    expect(setCookies(out, "mcv_session")).toEqual(["mcv_session="]);
    expect((await http(u.cookie).get("/documents")).status).toBe(401);
  });

  test("GET /auth/me for an anonymous caller reports the IP quota", async ({ http }) => {
    const me = await http().get("/auth/me");
    expect(me.status).toBe(200);
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

  test("GET /auth/me for a signed-in user returns the profile", async ({ http }) => {
    const u = await createSignedInUser({ email: "me-e2e@test.local" });
    users.push(u.userId);
    const me = await http(u.cookie).get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      status: "user",
      user: { id: u.userId, email: "me-e2e@test.local" },
      guestQuota: null,
    });
  });
});
