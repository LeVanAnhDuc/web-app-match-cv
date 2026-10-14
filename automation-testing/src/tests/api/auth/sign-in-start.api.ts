import { test, expect } from "@/fixtures";
import { OAUTH_MAX_AGE_S, SAFE_RETURN_TO, UNSAFE_RETURN_TO } from "@/data/test-data/auth";
import { createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";

// GET /auth/login (REQ-AUTH-01…05). Anything that starts a real login runs on the dedicated instance (authFlow /
// authSpawnServer) wired to the fake IdP; the dev server is only asked for the signed-in short-circuit, which never
// reaches an IdP (decision D5, T3).

const cookieHeader = (setCookies: string[], name: string) => setCookies.find((c) => c.startsWith(`${name}=`));

test.describe("Starting a sign-in", () => {
  test(
    "login chuyển tới trang authorize của IdP với đủ tham số OIDC và PKCE",
    { tag: ["@TC-AUTH-001", "@smoke"] },
    async ({ authFlow }) => {
      const begun = await authFlow.begin("/wizard");

      expect(begun.res.status).toBe(302);
      expect(begun.location?.origin + begun.location!.pathname).toBe(`${authFlow.idp.issuer}/oauth/authorize`);
      const q = begun.location!.searchParams;
      expect(q.get("response_type")).toBe("code");
      expect(q.get("scope")).toBe("openid profile email");
      expect(q.get("client_id")).toBe(authFlow.idp.clientId);
      expect(q.get("redirect_uri")).toBe(authFlow.server.redirectUri);
      expect(q.get("code_challenge_method")).toBe("S256");
      expect(q.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(q.get("state")).toBeTruthy();
      expect(q.get("nonce")).toBeTruthy();
      // The sealed cookie carries what the callback will need to check, and the challenge is S256(verifier).
      expect(begun.sealed).toMatchObject({ state: q.get("state"), nonce: q.get("nonce"), returnTo: "/wizard" });
      // Two logins never share state, nonce or verifier.
      const again = await authFlow.begin("/wizard");
      expect(again.state).not.toBe(begun.state);
      expect(again.nonce).not.toBe(begun.nonce);
      expect(again.codeChallenge).not.toBe(begun.codeChallenge);
    }
  );

  test(
    "cookie mcv_oauth chỉ sống 10 phút, HttpOnly, SameSite=Lax và chỉ gửi về /api/v1/auth",
    { tag: ["@TC-AUTH-002"] },
    async ({ authFlow }) => {
      const begun = await authFlow.begin("/");
      const header = cookieHeader(begun.res.setCookies, "mcv_oauth");

      expect(header).toBeDefined();
      expect(header).toMatch(/;\s*HttpOnly/i);
      expect(header).toMatch(/;\s*SameSite=Lax/i);
      expect(header).toMatch(/;\s*Path=\/api\/v1\/auth(;|$)/);
      expect(header).toMatch(new RegExp(`;\\s*Max-Age=${OAUTH_MAX_AGE_S}(;|$)`));
      // Dev runs with NODE_ENV=development: Secure only in production (not reachable here, see decisions).
      expect(header).not.toMatch(/;\s*Secure/i);
      // Sealed: the raw cookie value does not expose the state or the PKCE verifier.
      expect(begun.oauthCookie).not.toContain(begun.state);
      expect(begun.oauthCookie).not.toContain(begun.sealed!.verifier);
    }
  );

  test.describe("returnTo filtering on the signed-in short-circuit (dev server, no IdP)", () => {
    let user: SeededUser;

    test.beforeAll(async () => {
      user = await createSignedInUser();
    });

    test.afterAll(async () => {
      await deleteUsers([user.userId]);
    });

    test(
      "returnTo là đường dẫn tương đối hợp lệ được giữ nguyên, kể cả dài đúng 2048 ký tự",
      { tag: ["@TC-AUTH-003"] },
      async ({ apiAs, urls }) => {
        for (const returnTo of SAFE_RETURN_TO) {
          const res = await apiAs(user).auth.login({ returnTo });
          expect(res.status, returnTo.slice(0, 40)).toBe(302);
          expect(res.headers.location, returnTo.slice(0, 40)).toBe(new URL(returnTo, urls.webUrl).toString());
        }
      }
    );

    test(
      "returnTo không an toàn luôn rơi về / trên CLIENT_ORIGIN",
      { tag: ["@TC-AUTH-004", "@smoke"] },
      async ({ apiAs, urls }) => {
        for (const { label, value } of UNSAFE_RETURN_TO) {
          const res = Array.isArray(value)
            ? await apiAs(user).raw.get(`/auth/login?${value.map((v) => `returnTo=${encodeURIComponent(v)}`).join("&")}`)
            : await apiAs(user).auth.login({ returnTo: value });
          expect(res.status, label).toBe(302);
          expect(res.headers.location, label).toBe(`${urls.webUrl}/`);
        }
        // No returnTo at all is the same as "/".
        const none = await apiAs(user).raw.get("/auth/login");
        expect(none.headers.location).toBe(`${urls.webUrl}/`);
      }
    );

    test(
      "user đã đăng nhập gọi login được đưa thẳng về returnTo, không đi IdP, không có mcv_oauth",
      { tag: ["@TC-AUTH-006"] },
      async ({ apiAs, urls }) => {
        const res = await apiAs(user).auth.login({ returnTo: "/wizard?runId=r1" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${urls.webUrl}/wizard?runId=r1`);
        expect(cookieHeader(res.setCookies, "mcv_oauth")).toBeUndefined();
      }
    );
  });

  test(
    "returnTo niêm trong mcv_oauth cũng được lọc, redirect cuối luôn nằm trên CLIENT_ORIGIN",
    { tag: ["@TC-AUTH-005", "@creates-data"] },
    async ({ authFlow, urls }) => {
      const offSite = await authFlow.signIn({ returnTo: "//evil.test/x" });
      expect(offSite.begun.sealed?.returnTo).toBe("/");
      expect(offSite.callback.status).toBe(302);
      expect(offSite.callback.headers.location).toBe(`${urls.webUrl}/`);

      const kept = await authFlow.signIn({ returnTo: "/wizard?runId=r1" });
      expect(kept.callback.headers.location).toBe(`${urls.webUrl}/wizard?runId=r1`);
    }
  );

  test(
    "IdP không truy cập được thì login về /?authError=server, không set mcv_oauth",
    { tag: ["@TC-AUTH-007"] },
    async ({ authSpawnServer, urls }) => {
      const { api } = await authSpawnServer("oidc-unreachable");
      const res = await api.auth.login({ returnTo: "/wizard" });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${urls.webUrl}/?authError=server`);
      expect(cookieHeader(res.setCookies, "mcv_oauth")).toBeUndefined();
      expect(res.headers["content-type"] ?? "").not.toContain("json");
    }
  );

  test(
    "server chưa cấu hình OIDC thì login và callback về /?authError=server",
    { tag: ["@TC-AUTH-008"] },
    async ({ authSpawnServer, urls }) => {
      const { api } = await authSpawnServer("oidc-missing");
      const login = await api.auth.login({ returnTo: "/" });
      expect(login.status).toBe(302);
      expect(login.headers.location).toBe(`${urls.webUrl}/?authError=server`);
      expect(cookieHeader(login.setCookies, "mcv_oauth")).toBeUndefined();
      // Without a sealed cookie the callback is a plain state failure, still a redirect, never JSON.
      const callback = await api.auth.callback({ code: "c", state: "s" });
      expect(callback.status).toBe(302);
      expect(callback.headers.location).toMatch(new RegExp(`^${urls.webUrl}/\\?authError=`));
    }
  );
});
