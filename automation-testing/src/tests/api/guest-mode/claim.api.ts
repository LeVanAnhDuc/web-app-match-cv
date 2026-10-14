import { test, expect } from "@/fixtures";
import { findDocument, findMatchResult } from "@/utils/db";

// REQ-GUESTMODE-13 / 14: the guest claim at sign-in. D5 + Q3: the sign-in runs against the auth module's dedicated
// Match CV instance wired to the fake IdP (fixture `authFlow`, fixtures/modules/auth.fixture.ts) — same dev database,
// so a guest seeded here is the guest that instance sees. Nothing reaches the real Ducker ID and no AI is called.

test.describe("guest claim at sign-in", () => {
  test(
    "Đăng nhập từ phiên khách chuyển tài liệu, run, kết quả sang tài khoản và về returnTo kèm claimed=1",
    { tag: ["@TC-GUESTMODE-026", "@smoke", "@creates-data"] },
    async ({ authFlow, apiAs, guestModeData, urls }) => {
      const guest = await guestModeData.guest();
      const run = await guestModeData.run(guest.userId);
      const returnTo = `/wizard?runId=${run.runId}`;

      const signed = await authFlow.signIn({ as: guest.cookie, returnTo });
      expect(signed.callback.status).toBe(302);
      const location = new URL(signed.callback.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(`${urls.webUrl}/wizard`);
      expect(location.searchParams.get("runId")).toBe(run.runId);
      expect(location.searchParams.get("claimed")).toBe("1");
      expect(signed.sessionCookie).toBeDefined();

      const user = await authFlow.userBySub(signed.identity.sub);
      expect(user?.isGuest).toBe(false);
      for (const id of [run.cvId, run.jdId]) {
        expect(await findDocument(id)).toMatchObject({ userId: user!.id, isSaved: true });
      }
      expect(await guestModeData.runOwner(run.runId)).toBe(user!.id);
      expect((await findMatchResult(run.resultId))?.userId).toBe(user!.id);
      expect(await guestModeData.findUser(guest.userId)).toBeNull();
      expect(await guestModeData.sessionExpiry(guest.token)).toBeNull();

      const reopened = await apiAs(signed.sessionCookie!).match.getRun(run.runId);
      expect(reopened.status).toBe(200);
      expect(reopened.json().results.map((r) => r.id)).toEqual([run.resultId]);
    }
  );

  test(
    "Đăng nhập không khởi động từ khách này thì không claim dữ liệu của khách",
    { tag: ["@TC-GUESTMODE-027", "@smoke"] },
    async ({ authFlow, guestModeData }) => {
      const victim = await guestModeData.guest();
      const victimRun = await guestModeData.run(victim.userId);

      // Login begun anonymously (e.g. planted from another browser), callback completed in the victim's browser.
      const begun = await authFlow.begin("/wizard");
      const identity = authFlow.identity();
      const callback = await authFlow.callback(
        { code: authFlow.code(begun, identity), state: begun.state, iss: authFlow.idp.issuer },
        [victim.cookie, begun.oauthCookie]
      );
      expect(callback.status).toBe(302);
      expect(new URL(callback.headers.location).searchParams.has("claimed")).toBe(false);

      expect(await guestModeData.findUser(victim.userId)).not.toBeNull();
      expect(await guestModeData.holdings(victim.userId)).toEqual({ documents: 2, runs: 1, results: 1 });
      expect(await guestModeData.runOwner(victimRun.runId)).toBe(victim.userId);
    }
  );

  test(
    "Khách đã hết hạn lúc callback thì bỏ qua claim, đăng nhập vẫn thành công",
    { tag: ["@TC-GUESTMODE-028"] },
    async ({ authFlow, guestModeData }) => {
      const guest = await guestModeData.guest();
      await guestModeData.run(guest.userId);
      const begun = await authFlow.begin("/wizard", guest.cookie);
      expect(begun.sealed?.guestUserId).toBe(guest.userId);

      await guestModeData.expireGuest(guest.userId);
      const identity = authFlow.identity();
      const callback = await authFlow.callback(
        { code: authFlow.code(begun, identity), state: begun.state, iss: authFlow.idp.issuer },
        [guest.cookie, begun.oauthCookie]
      );
      expect(callback.status).toBe(302);
      const location = new URL(callback.headers.location);
      expect(location.pathname).toBe("/wizard");
      expect(location.searchParams.has("claimed")).toBe(false);

      const user = await authFlow.userBySub(identity.sub);
      expect(user).not.toBeNull();
      expect(await guestModeData.holdings(user!.id)).toEqual({ documents: 0, runs: 0, results: 0 });
    }
  );

  test(
    "Gọi lại callback sau khi đã claim không nhân đôi dữ liệu",
    { tag: ["@TC-GUESTMODE-029"] },
    async ({ authFlow, guestModeData }) => {
      const guest = await guestModeData.guest();
      await guestModeData.run(guest.userId);
      const signed = await authFlow.signIn({ as: guest.cookie, returnTo: "/wizard" });
      const user = await authFlow.userBySub(signed.identity.sub);
      const claimed = await guestModeData.holdings(user!.id);
      expect(claimed).toEqual({ documents: 2, runs: 1, results: 1 });

      // The same browser completes the same login again (same sealed state naming the guest, the guest cookie it still
      // holds, a fresh code for the same identity): the guest is already gone, so nothing may move twice.
      const replay = await authFlow.callback(
        { code: authFlow.code(signed.begun, signed.identity), state: signed.begun.state, iss: authFlow.idp.issuer },
        [guest.cookie, signed.begun.oauthCookie]
      );
      expect(replay.status).toBe(302);
      expect(new URL(replay.headers.location).searchParams.has("claimed")).toBe(false);
      expect(await guestModeData.holdings(user!.id)).toEqual(claimed);
    }
  );
});
