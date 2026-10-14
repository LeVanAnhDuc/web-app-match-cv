import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { GUEST_ENDPOINTS, SAMPLE_JD, UNKNOWN_ID, USER_ONLY_ENDPOINTS } from "@/data/test-data/auth";
import { findDocument, insertDocument, insertMatchResult, insertMatchRun } from "@/utils/db";
import { createGuestUser, createSignedInUser, deleteUsers, documentOwner, liveCookie, type SeededUser } from "@/utils/sessions";

// The default-deny guard (REQ-AUTH-19…22), ported from server/test/access-matrix.e2e-spec.ts. Every case is decided by
// the guard or the ownership check before any AI provider or IdP is reached, so it all runs on the dev server — except
// GET /auth/login for a caller who is not signed in, which would start a real Ducker ID login there: that one runs on
// the dedicated instance (authApi).

test.describe("Access matrix (design §5.2)", () => {
  let guest: SeededUser;
  let user: SeededUser;
  const users: string[] = [];

  test.beforeAll(async () => {
    guest = await createGuestUser();
    user = await createSignedInUser();
    users.push(guest.userId, user.userId);
  });

  test.afterAll(async () => {
    await deleteUsers(users);
  });

  test(
    "endpoint chỉ dành cho user trả 401 SIGN_IN_REQUIRED cho người ẩn danh và khách",
    { tag: ["@TC-AUTH-033", "@smoke"] },
    async ({ anonApi, apiAs }) => {
      for (const [method, path] of USER_ONLY_ENDPOINTS) {
        const label = `${method} ${path}`;
        for (const [who, client] of [
          ["anonymous", anonApi],
          ["guest", apiAs(guest)],
        ] as const) {
          const res = await client.raw.call(method, path);
          expect(res.status, `${label} as ${who}`).toBe(401);
          expect((res.body as { code?: string }).code, `${label} as ${who}`).toBe("SIGN_IN_REQUIRED");
          expect((res.body as { message?: string }).message, `${label} as ${who}`).toBe(
            serverMessage("auth.errors.signInRequired")
          );
        }
        expect((await apiAs(user).raw.call(method, path)).status, `${label} as user`).not.toBe(401);
      }
    }
  );

  test("401 trả message theo ngôn ngữ của request", { tag: ["@TC-AUTH-034"] }, async ({ anonApi, apiAs }) => {
    for (const client of [anonApi, apiAs(guest)]) {
      const vi = await client.lang("vi").documents.list();
      expect(vi.status).toBe(401);
      expect(vi.error()).toMatchObject({ code: "SIGN_IN_REQUIRED", message: serverMessage("auth.errors.signInRequired", "vi") });
      const en = await client.lang("en").documents.list();
      expect(en.error().message).toBe(serverMessage("auth.errors.signInRequired", "en"));
    }
  });

  test(
    "endpoint mở cho khách: người ẩn danh 401, khách và user qua được guard",
    { tag: ["@TC-AUTH-035", "@smoke"] },
    async ({ anonApi, apiAs }) => {
      for (const [method, path] of GUEST_ENDPOINTS) {
        const label = `${method} ${path}`;
        const anon = await anonApi.raw.call(method, path);
        expect(anon.status, `${label} as anonymous`).toBe(401);
        expect((anon.body as { code?: string }).code, `${label} as anonymous`).toBe("SIGN_IN_REQUIRED");
        expect((await apiAs(guest).raw.call(method, path)).status, `${label} as guest`).not.toBe(401);
        expect((await apiAs(user).raw.call(method, path)).status, `${label} as user`).not.toBe(401);
      }
    }
  );

  test(
    "endpoint public không bao giờ trả 401 dù ở trạng thái nào",
    { tag: ["@TC-AUTH-036"] },
    async ({ anonApi, apiAs, authApi }) => {
      for (const [who, client] of [
        ["anonymous", anonApi],
        ["guest", apiAs(guest)],
        ["user", apiAs(user)],
      ] as const) {
        expect((await client.health.check()).status, `health as ${who}`).toBe(200);
        expect((await client.auth.me()).status, `me as ${who}`).toBe(200);
        // No mcv_oauth: rejected as "state" before any IdP is involved — a redirect, not a 401.
        expect((await client.auth.callback({ code: "c", state: "s" })).status, `callback as ${who}`).toBe(302);
      }
      // Logout revokes the caller's session: a throw-away guest, so the shared ones stay signed in.
      const leaving = await createGuestUser();
      users.push(leaving.userId);
      expect((await anonApi.auth.logout()).status).toBe(204);
      expect((await apiAs(leaving).auth.logout()).status).toBe(204);
      // Login for a non-user starts a sign-in: on the dedicated instance (fake IdP), never the dev server.
      expect((await authApi.auth.login({ returnTo: "/" })).status).toBe(302);
      const otherGuest = await createGuestUser();
      users.push(otherGuest.userId);
      expect((await authApi.as(otherGuest).auth.login({ returnTo: "/" })).status).toBe(302);
      expect((await apiAs(user).auth.login({ returnTo: "/" })).status).toBe(302);
    }
  );

  test(
    "POST /documents ẩn danh tạo khách mới; khách và user gọi thì không tạo khách",
    { tag: ["@TC-AUTH-037", "@creates-data"] },
    async ({ anonApi, apiAs }) => {
      const res = await anonApi.documents.create(SAMPLE_JD);
      expect(res.status).toBe(201);
      const owner = await documentOwner(res.json().id);
      if (owner) users.push(owner.userId);
      const header = res.setCookies.find((c) => c.startsWith("mcv_session=") && !c.startsWith("mcv_session=;"));
      expect(header).toMatch(/HttpOnly/i);
      expect(owner?.isGuest).toBe(true);
      const newCookie = liveCookie(res.setCookies, "mcv_session")!;
      // A guest, not a user: user-only endpoints still answer 401.
      expect((await anonApi.as(newCookie).documents.list()).status).toBe(401);

      for (const [who, caller] of [
        ["guest", guest],
        ["user", user],
      ] as const) {
        const own = await apiAs(caller).documents.create(SAMPLE_JD);
        expect(own.status, who).toBe(201);
        expect((await findDocument(own.json().id))?.userId, who).toBe(caller.userId);
        expect(liveCookie(own.setCookies, "mcv_session"), who).toBeUndefined();
      }
    }
  );

  test(
    "không đọc được tài liệu, match hay run của người khác (404, không lộ tồn tại)",
    { tag: ["@TC-AUTH-038", "@smoke", "@creates-data"] },
    async ({ apiAs }) => {
      const owner = await createSignedInUser();
      users.push(owner.userId);
      const cv = await insertDocument({ userId: owner.userId, kind: "CV", title: "Owner CV", rawText: "Owner CV text" });
      const jd = await insertDocument({ userId: owner.userId, kind: "JD", title: "Owner JD", rawText: "Owner JD text" });
      const match = await insertMatchResult({ userId: owner.userId, cvDocumentId: cv, jdDocumentId: jd });
      const run = await insertMatchRun({ userId: owner.userId, cvDocumentId: cv, jdDocumentId: jd });

      for (const [who, caller] of [
        ["guest", guest],
        ["user", user],
      ] as const) {
        for (const path of [`/documents/${cv}`, `/documents/${cv}/file`, `/match/${match}`, `/match/runs/${run}`]) {
          const theirs = await apiAs(caller).raw.get(path);
          const missing = await apiAs(caller).raw.get(path.replace(/[0-9a-f-]{36}/, UNKNOWN_ID));
          expect(theirs.status, `${path} as ${who}`).toBe(404);
          // Same answer as for an id that does not exist: existence does not leak.
          expect(theirs.status, `${path} as ${who}`).toBe(missing.status);
        }
      }
      // The owner still sees them.
      expect((await apiAs(owner).raw.get(`/documents/${cv}`)).status).toBe(200);
      expect((await apiAs(owner).raw.get(`/match/${match}`)).status).toBe(200);
    }
  );
});
