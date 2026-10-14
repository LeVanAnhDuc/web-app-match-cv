import { randomBytes } from "node:crypto";
import { test, expect } from "@/fixtures";
import { SESSION_TTL_DAYS } from "@/data/test-data/auth";
import { sql, utc } from "@/utils/db";
import {
  createGuestUser,
  createSignedInUser,
  createUser,
  deleteUsers,
  liveCookie,
  resolveSession,
  sessionIdFor,
  setCookiesNamed,
} from "@/utils/sessions";

// mcv_session lifecycle, POST /auth/logout and GET /auth/me (REQ-AUTH-12…15, 17). Cases decided without an IdP run on
// the dev server; the ones that need a session minted by a real sign-in run on the dedicated instance (authFlow).

const DAY_MS = 86_400_000;
const tokenOf = (cookie: string) => cookie.slice(cookie.indexOf("=") + 1);
const cleared = (setCookies: string[]) => setCookiesNamed(setCookies, "mcv_session").includes("mcv_session=");

/** Session.expiresAt as an ISO UTC string (the column is a UTC timestamp without zone). */
async function sessionExpiry(token: string): Promise<string | null> {
  const [row] = await sql<{ at: string }>(
    `SELECT to_char("expiresAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at FROM "Session" WHERE id = $1`,
    [sessionIdFor(token)]
  );
  return row?.at ?? null;
}

test.describe("Session, sign-out and /auth/me", () => {
  const users: string[] = [];

  test.afterAll(async () => {
    await deleteUsers(users);
  });

  test(
    "cookie mcv_session HttpOnly, SameSite=Lax, Path=/, hạn 7 ngày khớp Session.expiresAt và không trượt",
    { tag: ["@TC-AUTH-024", "@creates-data"] },
    async ({ authFlow, anonApi }) => {
      const startedAt = Date.now();
      const { callback, sessionCookie } = await authFlow.signIn();
      const header = callback.setCookies.find((c) => c.startsWith("mcv_session=") && !c.startsWith("mcv_session=;"));

      expect(header).toMatch(/;\s*HttpOnly/i);
      expect(header).toMatch(/;\s*SameSite=Lax/i);
      expect(header).toMatch(/;\s*Path=\/(;|$)/);
      expect(header).not.toMatch(/;\s*Secure/i);
      const expires = Date.parse(/;\s*Expires=([^;]+)/i.exec(header!)![1]);
      const stored = await sessionExpiry(tokenOf(sessionCookie!));
      expect(stored).not.toBeNull();
      // Cookie Expires has second precision; the row keeps milliseconds.
      expect(Math.abs(expires - Date.parse(stored!))).toBeLessThan(1000);
      const ttl = Date.parse(stored!) - startedAt;
      expect(ttl).toBeGreaterThan(SESSION_TTL_DAYS * DAY_MS - 60_000);
      expect(ttl).toBeLessThan(SESSION_TTL_DAYS * DAY_MS + 60_000);

      // Fixed, not sliding: using the session neither re-issues the cookie nor moves the expiry.
      const me = await anonApi.as(sessionCookie).auth.me();
      expect(me.json().status).toBe("user");
      expect(setCookiesNamed(me.setCookies, "mcv_session")).toEqual([]);
      expect(await sessionExpiry(tokenOf(sessionCookie!))).toBe(stored);
    }
  );

  test(
    "DB chỉ lưu sha256 của token phiên; token của IdP không ra DB, trình duyệt hay log",
    { tag: ["@TC-AUTH-025", "@smoke", "@creates-data"] },
    async ({ authFlow, anonApi }) => {
      const identity = authFlow.identity();
      const before = new Set(authFlow.idp.secretsHandedOut());
      const { callback, sessionCookie } = await authFlow.signIn({ identity });
      const raw = tokenOf(sessionCookie!);
      const idpSecrets = authFlow.idp.secretsHandedOut().filter((secret) => !before.has(secret));
      expect(idpSecrets.length).toBeGreaterThanOrEqual(3); // code, id_token, access token

      // Session.id = sha256(token); the raw token is no row's id.
      expect(await sql('SELECT 1 FROM "Session" WHERE id = $1', [sessionIdFor(raw)])).toHaveLength(1);
      expect(await sql('SELECT 1 FROM "Session" WHERE id = $1', [raw])).toEqual([]);
      // Nothing of the IdP's nor the raw token sits in the user's rows.
      const user = await authFlow.userBySub(identity.sub);
      const [userRow] = await sql('SELECT * FROM "User" WHERE id = $1', [user!.id]);
      const sessions = await sql('SELECT * FROM "Session" WHERE "userId" = $1', [user!.id]);
      const stored = JSON.stringify([userRow, sessions]);
      for (const secret of [raw, ...idpSecrets]) expect(stored).not.toContain(secret);

      // Nothing of the IdP's reaches the browser: callback headers / body, /auth/me.
      const me = await anonApi.as(sessionCookie).auth.me();
      const browserSaw = JSON.stringify([callback.headers, callback.setCookies, callback.text, me.text]);
      for (const secret of idpSecrets) expect(browserSaw).not.toContain(secret);
      expect(me.text).not.toContain(raw);

      // Nor the instance's log (stdout + stderr), nor the user's email.
      const logs = authFlow.server.logs();
      for (const secret of [raw, ...idpSecrets, identity.email!]) expect(logs).not.toContain(secret);
    }
  );

  test(
    "cookie phiên lạ, bị sửa hoặc hết hạn bị coi là ẩn danh và bị xoá",
    { tag: ["@TC-AUTH-026"] },
    async ({ anonApi }) => {
      const live = await createSignedInUser();
      const owner = await createUser({ externalSub: randomBytes(8).toString("hex") });
      users.push(live.userId, owner);
      const expiredToken = randomBytes(32).toString("base64url");
      await sql(
        `INSERT INTO "Session" (id, "userId", "expiresAt", "createdAt")
         VALUES ($1, $2, $3::timestamptz AT TIME ZONE 'UTC', $4::timestamptz AT TIME ZONE 'UTC')`,
        [sessionIdFor(expiredToken), owner, utc(new Date(Date.now() - 60_000)), utc(new Date(Date.now() - DAY_MS))]
      );
      const liveToken = tokenOf(live.cookie);
      const tampered = `${liveToken.slice(0, -1)}${liveToken.endsWith("A") ? "B" : "A"}`;

      for (const [label, cookie] of [
        ["unknown token", `mcv_session=${randomBytes(32).toString("base64url")}`],
        ["tampered token", `mcv_session=${tampered}`],
        ["expired session", `mcv_session=${expiredToken}`],
      ] as const) {
        const me = await anonApi.as(cookie).auth.me();
        expect(me.status, label).toBe(200);
        expect(me.json().status, label).toBe("anonymous");
        expect(cleared(me.setCookies), label).toBe(true);
        expect((await anonApi.as(cookie).documents.list()).status, label).toBe(401);
      }
      // The expired row was deleted when it was touched; the live one is untouched.
      expect(await sql('SELECT 1 FROM "Session" WHERE id = $1', [sessionIdFor(expiredToken)])).toEqual([]);
      expect(await resolveSession(liveToken)).not.toBeNull();
    }
  );

  test(
    "cookie phiên không giải mã được cũng bị coi là ẩn danh và bị xoá",
    { tag: ["@TC-AUTH-053"] },
    async ({ anonApi }) => {
      // BUG: defects/auth.md#bug-auth-02
      test.fail();
      const cookie = "mcv_session=%%%";
      const me = await anonApi.as(cookie).auth.me();
      expect(me.status).toBe(200);
      expect(me.json().status).toBe("anonymous");
      expect(cleared(me.setCookies)).toBe(true);
    }
  );

  test(
    "đăng xuất trả 204, xoá phiên và cookie cũ không còn xác thực được",
    { tag: ["@TC-AUTH-027", "@smoke"] },
    async ({ apiAs }) => {
      const u = await createSignedInUser();
      users.push(u.userId);
      expect((await apiAs(u).documents.list()).status).toBe(200);

      const out = await apiAs(u).auth.logout();
      expect(out.status).toBe(204);
      expect(cleared(out.setCookies)).toBe(true);
      expect(await resolveSession(tokenOf(u.cookie))).toBeNull();
      expect(await sql('SELECT 1 FROM "Session" WHERE id = $1', [sessionIdFor(tokenOf(u.cookie))])).toEqual([]);
      expect((await apiAs(u).documents.list()).status).toBe(401);
      expect((await apiAs(u).auth.me()).json().status).toBe("anonymous");
    }
  );

  test(
    "đăng xuất khi không có phiên vẫn 204; GET /auth/logout không đăng xuất",
    { tag: ["@TC-AUTH-028"] },
    async ({ anonApi, apiAs }) => {
      const out = await anonApi.auth.logout();
      expect(out.status).toBe(204);
      // Twice in a row is still fine.
      expect((await anonApi.auth.logout()).status).toBe(204);

      const u = await createSignedInUser();
      users.push(u.userId);
      const viaGet = await apiAs(u).raw.get("/auth/logout");
      expect(viaGet.status).toBeGreaterThanOrEqual(400);
      expect(await resolveSession(tokenOf(u.cookie))).not.toBeNull();
      expect((await apiAs(u).documents.list()).status).toBe(200);
    }
  );

  test(
    "đăng xuất chỉ đăng xuất Match CV, không gọi Ducker ID",
    { tag: ["@TC-AUTH-029", "@creates-data"] },
    async ({ authFlow }) => {
      const { sessionCookie } = await authFlow.signIn();
      const before = authFlow.idp.requests.length;
      const out = await authFlow.api.as(sessionCookie).auth.logout();
      expect(out.status).toBe(204);
      expect(authFlow.idp.requests.slice(before)).toEqual([]);
      expect(await resolveSession(tokenOf(sessionCookie!))).toBeNull();
    }
  );

  test(
    "/auth/me cho người ẩn danh trả quota khách theo IP",
    { tag: ["@TC-AUTH-030"] },
    async ({ anonApi }) => {
      const me = await anonApi.auth.me();
      expect(me.status).toBe(200);
      const body = me.json();
      expect(body.status).toBe("anonymous");
      expect(body.user).toBeNull();
      expect(typeof body.guestQuota?.limit).toBe("number");
      expect(typeof body.guestQuota?.used).toBe("number");
      expect(Number.isNaN(Date.parse(String(body.guestQuota?.resetsAt)))).toBe(false);
    }
  );

  test(
    "/auth/me cho user trả hồ sơ, không có field token nào",
    { tag: ["@TC-AUTH-031"] },
    async ({ apiAs }) => {
      const u = await createSignedInUser({ email: `me-e2e-${randomBytes(3).toString("hex")}@test.local` });
      users.push(u.userId);
      const me = await apiAs(u).auth.me();
      expect(me.status).toBe(200);
      const body = me.json();
      expect(body).toMatchObject({ status: "user", user: { id: u.userId }, guestQuota: null });
      expect(Object.keys(body).sort()).toEqual(["guestQuota", "status", "user"]);
      expect(Object.keys(body.user!).sort()).toEqual(["avatar", "email", "fullName", "id"]);
      expect(me.text).not.toContain(tokenOf(u.cookie));
      expect(me.text).not.toMatch(/token|secret|sub"/i);
    }
  );

  test("/auth/me cho khách trả guest và quota", { tag: ["@TC-AUTH-032"] }, async ({ apiAs }) => {
    const g = await createGuestUser();
    users.push(g.userId);
    const me = await apiAs(g).auth.me();
    expect(me.status).toBe(200);
    const body = me.json();
    expect(body.status).toBe("guest");
    expect(body.user).toBeNull();
    expect(body.guestQuota).toMatchObject({ limit: expect.any(Number), used: expect.any(Number) });
    expect(me.text).not.toContain(tokenOf(g.cookie));
  });
});
