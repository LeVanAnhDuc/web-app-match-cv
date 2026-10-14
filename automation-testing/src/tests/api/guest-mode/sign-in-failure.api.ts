import { randomBytes } from "node:crypto";
import { test, expect } from "@/fixtures";
import { liveCookie, SESSION_COOKIE } from "@/utils/sessions";

// REQ-GUESTMODE-15: a sign-in that fails leaves the guest exactly as it was. The callback's failure branches that are
// decided before the IdP is contacted (an `error` from the IdP with the right state, a state that does not match) run
// against the dev server with an mcv_oauth cookie sealed like /auth/login seals it (guestModeOAuth) — no OIDC traffic.

test.describe("sign-in failure keeps the guest", () => {
  test(
    "Đăng nhập bị từ chối đưa về app với authError=denied, khách giữ nguyên phiên và dữ liệu",
    { tag: ["@TC-GUESTMODE-030", "@smoke"] },
    async ({ anonApi, apiAs, guestModeData, guestModeOAuth, urls }) => {
      const guest = await guestModeData.guest();
      const { cvId } = await guestModeData.pair(guest.userId);
      const state = randomBytes(16).toString("base64url");
      const oauth = guestModeOAuth.cookie({ state, guestUserId: guest.userId });

      const res = await anonApi.as([guest.cookie, oauth]).auth.callback({ error: "access_denied", state });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${urls.webUrl}/?authError=denied`);
      expect(liveCookie(res.setCookies, SESSION_COOKIE)).toBeUndefined();

      expect((await apiAs(guest).auth.me()).json().status).toBe("guest");
      expect((await apiAs(guest).documents.get(cvId)).status).toBe(200);
      expect((await guestModeData.ownerOf(cvId))?.userId).toBe(guest.userId);
    }
  );

  test(
    "Callback với state không khớp đưa về authError=state, khách giữ nguyên",
    { tag: ["@TC-GUESTMODE-031"] },
    async ({ anonApi, apiAs, guestModeData, guestModeOAuth, urls }) => {
      const guest = await guestModeData.guest();
      const { cvId } = await guestModeData.pair(guest.userId);
      const oauth = guestModeOAuth.cookie({ state: randomBytes(16).toString("base64url"), guestUserId: guest.userId });

      const res = await anonApi
        .as([guest.cookie, oauth])
        .auth.callback({ code: "any-code", state: randomBytes(16).toString("base64url") });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${urls.webUrl}/?authError=state`);
      expect(liveCookie(res.setCookies, SESSION_COOKIE)).toBeUndefined();

      expect((await apiAs(guest).auth.me()).json().status).toBe("guest");
      expect((await apiAs(guest).documents.get(cvId)).status).toBe(200);
    }
  );
});
