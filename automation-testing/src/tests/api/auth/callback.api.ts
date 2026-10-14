import { randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { SAMPLE_CV } from "@/data/test-data/auth";
import { findDocument, sql, utc } from "@/utils/db";
import { EXCHANGE_FAULTS, TOKEN_FAULTS, sealOAuthState } from "@/utils/fake-idp";
import {
  createGuestUser,
  createSignedInUser,
  createUser,
  deleteUsers,
  liveCookie,
  resolveSession,
  setCookiesNamed,
} from "@/utils/sessions";

// GET /auth/callback on the dedicated instance (decision D5): the fake IdP issues the code and signs the id_token, the
// spec steers its faults. Migrated from server/test/auth-flow.e2e-spec.ts (FakeOidc in-process → fake IdP over HTTP).

const cleared = (setCookies: string[], name: string) => setCookiesNamed(setCookies, name).includes(`${name}=`);
const tokenOf = (cookie: string) => cookie.slice(cookie.indexOf("=") + 1);

test.describe("Completing a sign-in", () => {
  const extraUsers: string[] = [];

  test.afterAll(async () => {
    await deleteUsers(extraUsers);
  });

  test(
    "callback hợp lệ tạo user candidate, cấp session mới, xoá mcv_oauth và về returnTo",
    { tag: ["@TC-AUTH-009", "@smoke", "@creates-data"] },
    async ({ authFlow, urls, anonApi }) => {
      const identity = authFlow.identity({ name: "Ada Lovelace", picture: "https://img.test/ada.png" });
      const { callback, sessionCookie } = await authFlow.signIn({ identity, returnTo: "/wizard?runId=r1" });

      expect(callback.status).toBe(302);
      expect(callback.headers.location).toBe(`${urls.webUrl}/wizard?runId=r1`);
      expect(sessionCookie).toBeDefined();
      expect(cleared(callback.setCookies, "mcv_oauth")).toBe(true);

      const user = await authFlow.userBySub(identity.sub);
      expect(user).toMatchObject({
        role: "candidate",
        isGuest: false,
        email: identity.email,
        fullName: "Ada Lovelace",
        avatar: "https://img.test/ada.png",
      });
      expect(await resolveSession(tokenOf(sessionCookie!))).toEqual({ userId: user!.id, isGuest: false });
      // The new session works on the dev server too (same DB): the user is signed in everywhere.
      const me = await anonApi.as(sessionCookie).auth.me();
      expect(me.json()).toMatchObject({ status: "user", user: { id: user!.id, email: identity.email }, guestQuota: null });
    }
  );

  test(
    "đổi code bằng client_secret_basic và PKCE verifier khớp code_challenge",
    { tag: ["@TC-AUTH-010", "@creates-data"] },
    async ({ authFlow }) => {
      const before = authFlow.idp.tokenRequests.length;
      const { begun, callback } = await authFlow.signIn();
      expect(callback.status).toBe(302);

      const [sent] = authFlow.idp.tokenRequests.slice(before);
      expect(sent.basic).toEqual({ clientId: authFlow.idp.clientId, clientSecret: authFlow.idp.clientSecret });
      expect(sent.form.grant_type).toBe("authorization_code");
      expect(sent.form.redirect_uri).toBe(authFlow.server.redirectUri);
      expect(sent.form.code_verifier).toBe(begun.sealed!.verifier);
      expect(sent.pkceOk).toBe(true);
      // The client secret travels only in the Authorization header, never in the form body.
      expect(sent.form.client_secret).toBeUndefined();
    }
  );

  test(
    "đăng nhập lại cùng sub cập nhật hồ sơ, claim vắng không xoá giá trị cũ, không tạo user thứ hai",
    { tag: ["@TC-AUTH-011", "@creates-data"] },
    async ({ authFlow }) => {
      const first = authFlow.identity({ name: "Old Name", picture: "https://img.test/old.png" });
      await authFlow.signIn({ identity: first });
      const firstRow = await authFlow.userBySub(first.sub);

      // Second login: new email, no name / picture claim at all.
      await authFlow.signIn({ identity: { sub: first.sub, email: `new-${first.email}` } });

      const rows = await sql('SELECT id FROM "User" WHERE "externalSub" = $1', [first.sub]);
      expect(rows).toHaveLength(1);
      expect(await authFlow.userBySub(first.sub)).toMatchObject({
        id: firstRow!.id,
        email: `new-${first.email}`,
        fullName: "Old Name",
        avatar: "https://img.test/old.png",
      });
    }
  );

  test(
    "callback thiếu, hỏng hoặc hết hạn mcv_oauth về /?authError=state, không tạo session",
    { tag: ["@TC-AUTH-012"] },
    async ({ authFlow, urls }) => {
      const begun = await authFlow.begin("/");
      const code = authFlow.code(begun, authFlow.identity());
      const secret = authFlow.server.sessionSecret;
      const value = begun.oauthCookie!.slice("mcv_oauth=".length);
      const flipped = `${value.slice(0, -2)}${value.endsWith("AA") ? "BB" : "AA"}`;
      const expired = sealOAuthState({ ...begun.sealed!, exp: Date.now() - 1000 }, secret);
      const foreign = sealOAuthState(begun.sealed!, randomBytes(36).toString("base64url"));

      for (const [label, cookie] of [
        ["no cookie", undefined],
        ["tampered", `mcv_oauth=${flipped}`],
        ["expired (exp in the past)", `mcv_oauth=${expired}`],
        ["sealed with another secret", `mcv_oauth=${foreign}`],
        ["garbage", "mcv_oauth=not-a-sealed-value"],
      ] as const) {
        const cb = await authFlow.callback({ code, state: begun.state, iss: authFlow.idp.issuer }, [cookie]);
        expect(cb.status, label).toBe(302);
        expect(cb.headers.location, label).toBe(`${urls.webUrl}/?authError=state`);
        expect(liveCookie(cb.setCookies, "mcv_session"), label).toBeUndefined();
      }
    }
  );

  test(
    "state không khớp về /?authError=state và giữ mcv_oauth của lần đăng nhập đang dở",
    { tag: ["@TC-AUTH-013", "@smoke", "@creates-data"] },
    async ({ authFlow, urls }) => {
      const begun = await authFlow.begin("/wizard");
      const code = authFlow.code(begun, authFlow.identity());
      const before = authFlow.idp.tokenRequests.length;

      const forged = await authFlow.callback({ code, state: "forged" }, [begun.oauthCookie]);
      expect(forged.status).toBe(302);
      expect(forged.headers.location).toBe(`${urls.webUrl}/?authError=state`);
      expect(liveCookie(forged.setCookies, "mcv_session")).toBeUndefined();
      // A stranger's link must not wipe the login in progress, and the code was never exchanged.
      expect(setCookiesNamed(forged.setCookies, "mcv_oauth")).toEqual([]);
      expect(authFlow.idp.tokenRequests.length).toBe(before);

      // The real callback still completes.
      const real = await authFlow.callback({ code, state: begun.state, iss: authFlow.idp.issuer }, [begun.oauthCookie]);
      expect(real.headers.location).toBe(`${urls.webUrl}/wizard`);
    }
  );

  test(
    "error kèm state giả không huỷ được lần đăng nhập đang dở",
    { tag: ["@TC-AUTH-014"] },
    async ({ authFlow, urls }) => {
      const begun = await authFlow.begin("/");
      const cb = await authFlow.callback({ error: "access_denied", state: "forged" }, [begun.oauthCookie]);
      expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=state`);
      expect(setCookiesNamed(cb.setCookies, "mcv_oauth")).toEqual([]);
    }
  );

  test(
    "IdP từ chối kèm đúng state về /?authError=denied và xoá mcv_oauth",
    { tag: ["@TC-AUTH-015"] },
    async ({ authFlow, urls }) => {
      const begun = await authFlow.begin("/");
      const cb = await authFlow.callback({ error: "access_denied", state: begun.state }, [begun.oauthCookie]);
      expect(cb.status).toBe(302);
      expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=denied`);
      expect(cleared(cb.setCookies, "mcv_oauth")).toBe(true);
      expect(liveCookie(cb.setCookies, "mcv_session")).toBeUndefined();
    }
  );

  test("iss khác OIDC_ISSUER về /?authError=iss", { tag: ["@TC-AUTH-016"] }, async ({ authFlow, urls }) => {
    const begun = await authFlow.begin("/");
    const code = authFlow.code(begun, authFlow.identity());
    const before = authFlow.idp.tokenRequests.length;
    const cb = await authFlow.callback({ code, state: begun.state, iss: "http://evil.test" }, [begun.oauthCookie]);
    expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=iss`);
    expect(cleared(cb.setCookies, "mcv_oauth")).toBe(true);
    expect(authFlow.idp.tokenRequests.length).toBe(before);
  });

  test("thiếu code dù state đúng về /?authError=state", { tag: ["@TC-AUTH-017"] }, async ({ authFlow, urls }) => {
    const begun = await authFlow.begin("/");
    const cb = await authFlow.callback({ state: begun.state }, [begun.oauthCookie]);
    expect(cb.headers.location).toBe(`${urls.webUrl}/?authError=state`);
    expect(liveCookie(cb.setCookies, "mcv_session")).toBeUndefined();
  });

  test(
    "đổi code thất bại về /?authError=exchange, xoá mcv_oauth, không tạo session",
    { tag: ["@TC-AUTH-018"] },
    async ({ authFlow, urls }) => {
      for (const fault of EXCHANGE_FAULTS) {
        const identity = authFlow.identity();
        const begun = await authFlow.begin("/");
        const code = authFlow.code(begun, identity);
        authFlow.idp.failNextToken(fault);
        const cb = await authFlow.callback({ code, state: begun.state, iss: authFlow.idp.issuer }, [begun.oauthCookie]);
        expect(cb.headers.location, fault).toBe(`${urls.webUrl}/?authError=exchange`);
        expect(cleared(cb.setCookies, "mcv_oauth"), fault).toBe(true);
        expect(liveCookie(cb.setCookies, "mcv_session"), fault).toBeUndefined();
        expect(await authFlow.userBySub(identity.sub), fault).toBeNull();
      }
    }
  );

  test(
    "id_token không hợp lệ về /?authError=token và không tạo user",
    { tag: ["@TC-AUTH-019", "@smoke"] },
    async ({ authFlow, urls }) => {
      for (const fault of TOKEN_FAULTS.filter((f) => !EXCHANGE_FAULTS.includes(f))) {
        const identity = authFlow.identity();
        const begun = await authFlow.begin("/");
        const code = authFlow.code(begun, identity);
        authFlow.idp.failNextToken(fault);
        const cb = await authFlow.callback({ code, state: begun.state, iss: authFlow.idp.issuer }, [begun.oauthCookie]);
        expect(cb.status, fault).toBe(302);
        expect(cb.headers.location, fault).toBe(`${urls.webUrl}/?authError=token`);
        expect(liveCookie(cb.setCookies, "mcv_session"), fault).toBeUndefined();
        expect(await authFlow.userBySub(identity.sub), fault).toBeNull();
      }
    }
  );

  test(
    "đăng nhập thu hồi session đang có và cấp token mới",
    { tag: ["@TC-AUTH-020", "@smoke", "@creates-data"] },
    async ({ authFlow }) => {
      // A signed-in browser that is sent through the IdP again (e.g. a planted session cookie): new token, old one dead.
      const old = await createSignedInUser();
      extraUsers.push(old.userId);
      const begun = await authFlow.begin("/");
      // /auth/login short-circuits for a signed-in user, so the old cookie rides along on the callback only.
      const code = authFlow.code(begun, authFlow.identity());
      const cb = await authFlow.callback({ code, state: begun.state, iss: authFlow.idp.issuer }, [old.cookie, begun.oauthCookie]);

      const fresh = liveCookie(cb.setCookies, "mcv_session");
      expect(fresh).toBeDefined();
      expect(fresh).not.toBe(old.cookie);
      expect(await resolveSession(tokenOf(old.cookie))).toBeNull();
      expect(await resolveSession(tokenOf(fresh!))).not.toBeNull();
    }
  );

  test(
    "đăng nhập dọn khách hết hạn và bộ đếm GuestUsage của ngày trước",
    { tag: ["@TC-AUTH-021", "@creates-data"] },
    async ({ authFlow }) => {
      const expiredGuest = await createUser({ isGuest: true, guestExpiresAt: new Date(Date.now() - 60_000) });
      const liveGuest = await createGuestUser();
      extraUsers.push(expiredGuest, liveGuest.userId);
      const ipOld = `auth-e2e-${randomUUID()}`;
      const ipToday = `auth-e2e-${randomUUID()}`;
      const today = utc().slice(0, 10);
      const yesterday = utc(new Date(Date.now() - 86_400_000)).slice(0, 10);
      await sql('INSERT INTO "GuestUsage" ("ipHash", day, count) VALUES ($1, $2::date, 1), ($3, $4::date, 1)', [
        ipOld,
        yesterday,
        ipToday,
        today,
      ]);
      try {
        await authFlow.signIn();

        expect(await sql('SELECT id FROM "User" WHERE id = $1', [expiredGuest])).toEqual([]);
        expect(await sql('SELECT id FROM "User" WHERE id = $1', [liveGuest.userId])).toHaveLength(1);
        expect(await sql('SELECT 1 FROM "GuestUsage" WHERE "ipHash" = $1', [ipOld])).toEqual([]);
        expect(await sql('SELECT 1 FROM "GuestUsage" WHERE "ipHash" = $1', [ipToday])).toHaveLength(1);
      } finally {
        await sql('DELETE FROM "GuestUsage" WHERE "ipHash" = ANY($1::text[])', [[ipOld, ipToday]]);
      }
    }
  );

  test(
    "khách bắt đầu đăng nhập được nhận vào tài khoản và session khách bị thu hồi",
    { tag: ["@TC-AUTH-022", "@smoke", "@creates-data"] },
    async ({ authFlow, anonApi, urls }) => {
      const created = await anonApi.documents.create(SAMPLE_CV);
      expect(created.status).toBe(201);
      const guestCookie = liveCookie(created.setCookies, "mcv_session")!;
      const guest = await resolveSession(tokenOf(guestCookie));
      expect(guest?.isGuest).toBe(true);
      extraUsers.push(guest!.userId);

      const identity = authFlow.identity();
      const { begun, callback, sessionCookie } = await authFlow.signIn({ identity, returnTo: "/wizard", as: guestCookie });

      expect(begun.sealed?.guestUserId).toBe(guest!.userId);
      expect(callback.headers.location).toBe(`${urls.webUrl}/wizard?claimed=1`);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).not.toBe(guestCookie);
      expect(await resolveSession(tokenOf(guestCookie))).toBeNull();
      const user = await authFlow.userBySub(identity.sub);
      expect(await findDocument(created.json().id)).toMatchObject({ userId: user!.id });
    }
  );

  test(
    "đăng nhập cài từ trình duyệt khác không nhận dữ liệu khách của nạn nhân",
    { tag: ["@TC-AUTH-023", "@smoke", "@creates-data"] },
    async ({ authFlow, anonApi, urls }) => {
      const created = await anonApi.documents.create({ ...SAMPLE_CV, sourceText: "Victim CV text." });
      const victimCookie = liveCookie(created.setCookies, "mcv_session")!;
      const victim = await resolveSession(tokenOf(victimCookie));
      extraUsers.push(victim!.userId);

      // The attacker starts the login in their own browser (no guest)…
      const attacker = await authFlow.begin("/");
      expect(attacker.sealed?.guestUserId).toBeNull();
      const code = authFlow.code(attacker, authFlow.identity());
      // …then plants that mcv_oauth + their code/state on the victim, whose guest cookie rides along.
      const cb = await authFlow.callback({ code, state: attacker.state, iss: authFlow.idp.issuer }, [
        victimCookie,
        attacker.oauthCookie,
      ]);

      expect(cb.status).toBe(302);
      expect(cb.headers.location).toBe(`${urls.webUrl}/`);
      expect(await findDocument(created.json().id)).toMatchObject({ userId: victim!.userId, isSaved: false });
    }
  );
});
