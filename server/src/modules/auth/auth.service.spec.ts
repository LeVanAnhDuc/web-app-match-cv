import { ServiceUnavailableException } from "@nestjs/common";
import { AuthFlowError, AuthService, type OAuthState } from "./auth.service";
import { seal, unseal } from "./oidc/sealed-cookie";

const SECRET = "unit-secret-".padEnd(32, "x");
const ISSUER = "http://idp.test";
const ORIGIN = "http://localhost:5300";
const DAY_MS = 86_400_000;

const env: Record<string, unknown> = {
  SESSION_SECRET: SECRET,
  OIDC_ISSUER: `${ISSUER}/`,
  CLIENT_ORIGIN: ORIGIN,
  SESSION_TTL_DAYS: 7
};
const config = { get: (k: string) => env[k] };
const oidc = {
  authorizeUrl: jest.fn(),
  exchangeCode: jest.fn(),
  verifyIdToken: jest.fn()
};
const prisma = { user: { upsert: jest.fn(), findUnique: jest.fn() } };
const sessions = { create: jest.fn(), revoke: jest.fn() };
const guests = { purgeExpired: jest.fn(), claim: jest.fn() };
const usage = { peek: jest.fn() };
const currentUser = { peek: jest.fn() };

const service = new AuthService(
  oidc as never,
  prisma as never,
  sessions as never,
  guests as never,
  usage as never,
  currentUser as never,
  config as never
);

const anonymous = { userId: null, isGuest: false, sessionToken: null };
const oauthState = (over: Partial<OAuthState> = {}): OAuthState => ({
  state: "st-1",
  nonce: "n-1",
  verifier: "v-1",
  returnTo: "/wizard",
  exp: Date.now() + 60_000,
  ...over
});
const input = (
  over: Partial<Parameters<AuthService["completeLogin"]>[0]> = {},
  saved: OAuthState = oauthState()
) => ({
  code: "code-1",
  state: saved.state,
  sealed: seal(saved, SECRET),
  current: anonymous,
  ...over
});

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    oidc.authorizeUrl.mockResolvedValue("http://idp.test/oauth/authorize?x=1");
    oidc.exchangeCode.mockResolvedValue("id.token.jwt");
    oidc.verifyIdToken.mockResolvedValue({
      sub: "sub-1",
      email: "a@b.test",
      name: "Ann",
      picture: "http://img.test/a.png"
    });
    prisma.user.upsert.mockResolvedValue({ id: "u-1" });
    sessions.create.mockResolvedValue("new-token");
    guests.claim.mockResolvedValue(true);
    guests.purgeExpired.mockResolvedValue(0);
  });

  describe("beginLogin", () => {
    it("returns the client's authorize URL and a sealed state cookie that expires in 10 minutes", async () => {
      const before = Date.now();
      const { authorizeUrl, cookie } = await service.beginLogin("/wizard");
      expect(authorizeUrl).toBe("http://idp.test/oauth/authorize?x=1");
      const saved = unseal<OAuthState>(cookie, SECRET);
      const args = (
        oidc.authorizeUrl.mock.calls[0] as [
          { state: string; nonce: string; codeChallenge: string }
        ]
      )[0];
      expect(saved).toMatchObject({
        state: args.state,
        nonce: args.nonce,
        returnTo: "/wizard"
      });
      expect(saved?.verifier).toBeTruthy();
      expect(args.codeChallenge).not.toBe(saved?.verifier);
      expect(saved!.exp).toBeGreaterThanOrEqual(before + 600_000);
      expect(saved!.exp).toBeLessThanOrEqual(Date.now() + 600_000);
    });

    it("refuses to start without SESSION_SECRET", async () => {
      const original = env.SESSION_SECRET;
      delete env.SESSION_SECRET;
      try {
        await expect(service.beginLogin("/")).rejects.toBeInstanceOf(
          ServiceUnavailableException
        );
      } finally {
        env.SESSION_SECRET = original;
      }
    });
  });

  describe("completeLogin — rejections", () => {
    const code = async (p: Promise<unknown>) => {
      try {
        await p;
      } catch (e) {
        return e instanceof AuthFlowError ? e.code : "other";
      }
      return "resolved";
    };

    it("maps an IdP error to denied", async () => {
      expect(
        await code(service.completeLogin(input({ error: "access_denied" })))
      ).toBe("denied");
    });

    it("rejects a state that differs from the sealed one", async () => {
      expect(await code(service.completeLogin(input({ state: "other" })))).toBe(
        "state"
      );
    });

    it("rejects a missing, forged or expired sealed cookie", async () => {
      expect(await code(service.completeLogin(input({ sealed: null })))).toBe(
        "state"
      );
      expect(
        await code(service.completeLogin(input({ sealed: "garbage" })))
      ).toBe("state");
      expect(
        await code(
          service.completeLogin(input({}, oauthState({ exp: Date.now() - 1 })))
        )
      ).toBe("state");
      expect(
        await code(
          service.completeLogin(
            input({ sealed: seal(oauthState(), "another-secret") })
          )
        )
      ).toBe("state");
    });

    it("rejects a callback without a code or without a state", async () => {
      expect(
        await code(service.completeLogin(input({ code: undefined })))
      ).toBe("state");
      expect(
        await code(service.completeLogin(input({ state: undefined })))
      ).toBe("state");
    });

    it("rejects an iss that is not OIDC_ISSUER, accepts it with or without the trailing slash", async () => {
      expect(
        await code(service.completeLogin(input({ iss: "http://evil.test" })))
      ).toBe("iss");
      expect(
        await code(service.completeLogin(input({ iss: `${ISSUER}/` })))
      ).toBe("resolved");
    });

    it("maps a failed code exchange to exchange and a bad id_token to token", async () => {
      oidc.exchangeCode.mockRejectedValueOnce(new Error("500"));
      expect(await code(service.completeLogin(input()))).toBe("exchange");
      oidc.verifyIdToken.mockRejectedValueOnce(new Error("signature"));
      expect(await code(service.completeLogin(input()))).toBe("token");
    });

    it("touches no user or session when the flow is rejected", async () => {
      await code(service.completeLogin(input({ state: "other" })));
      expect(prisma.user.upsert).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
    });
  });

  describe("completeLogin — success", () => {
    it("exchanges with the sealed verifier and checks the sealed nonce", async () => {
      await service.completeLogin(input());
      expect(oidc.exchangeCode).toHaveBeenCalledWith("code-1", "v-1");
      expect(oidc.verifyIdToken).toHaveBeenCalledWith("id.token.jwt", "n-1");
    });

    it("upserts the user by sub, mirrors the profile and opens a fresh session", async () => {
      const before = Date.now();
      const result = await service.completeLogin(input());
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { externalSub: "sub-1" },
        create: {
          role: "candidate",
          externalSub: "sub-1",
          email: "a@b.test",
          fullName: "Ann",
          avatar: "http://img.test/a.png"
        },
        update: {
          email: "a@b.test",
          fullName: "Ann",
          avatar: "http://img.test/a.png"
        }
      });
      expect(guests.purgeExpired).toHaveBeenCalled();
      expect(guests.claim).not.toHaveBeenCalled();
      expect(sessions.revoke).not.toHaveBeenCalled();
      const [userId, expiresAt] = sessions.create.mock.calls[0] as [
        string,
        Date
      ];
      expect(userId).toBe("u-1");
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
      expect(result).toEqual({
        token: "new-token",
        expiresAt,
        redirectTo: `${ORIGIN}/wizard`
      });
    });

    it("stores null for profile claims the id_token does not carry", async () => {
      oidc.verifyIdToken.mockResolvedValueOnce({ sub: "sub-2" });
      await service.completeLogin(input());
      const arg = (prisma.user.upsert.mock.calls[0] as [{ update: object }])[0];
      expect(arg.update).toEqual({ email: null, fullName: null, avatar: null });
    });

    it("claims the guest's work before purging, revokes the guest session, and flags the redirect", async () => {
      const result = await service.completeLogin(
        input(
          {
            current: { userId: "g-1", isGuest: true, sessionToken: "guest-tok" }
          },
          oauthState({ returnTo: "/wizard?runId=r1" })
        )
      );
      expect(guests.claim).toHaveBeenCalledWith("g-1", "u-1");
      expect(guests.claim.mock.invocationCallOrder[0]).toBeLessThan(
        guests.purgeExpired.mock.invocationCallOrder[0]
      );
      expect(sessions.revoke).toHaveBeenCalledWith("guest-tok");
      expect(result.redirectTo).toBe(`${ORIGIN}/wizard?runId=r1&claimed=1`);
    });

    it("does not flag the redirect when the guest had already expired", async () => {
      guests.claim.mockResolvedValueOnce(false);
      const result = await service.completeLogin(
        input({
          current: { userId: "g-1", isGuest: true, sessionToken: "guest-tok" }
        })
      );
      expect(result.redirectTo).toBe(`${ORIGIN}/wizard`);
    });

    it("never claims for a signed-in user but still replaces their session", async () => {
      await service.completeLogin(
        input({
          current: { userId: "u-9", isGuest: false, sessionToken: "old-tok" }
        })
      );
      expect(guests.claim).not.toHaveBeenCalled();
      expect(sessions.revoke).toHaveBeenCalledWith("old-tok");
    });

    it("keeps the redirect on CLIENT_ORIGIN even for a hostile sealed returnTo", async () => {
      const result = await service.completeLogin(
        input({}, oauthState({ returnTo: "//evil.test/x" }))
      );
      expect(result.redirectTo.startsWith(`${ORIGIN}/`)).toBe(true);
    });
  });

  describe("me", () => {
    const quota = { limit: 5, used: 2, resetsAt: new Date("2026-10-05") };
    beforeEach(() => usage.peek.mockResolvedValue(quota));

    it("anonymous → no user, quota by IP", async () => {
      currentUser.peek.mockReturnValue(anonymous);
      await expect(service.me("1.2.3.4")).resolves.toEqual({
        status: "anonymous",
        user: null,
        guestQuota: quota
      });
      expect(usage.peek).toHaveBeenCalledWith("1.2.3.4");
    });

    it("guest → status guest with quota", async () => {
      currentUser.peek.mockReturnValue({
        userId: "g-1",
        isGuest: true,
        sessionToken: "t"
      });
      await expect(service.me("1.2.3.4")).resolves.toEqual({
        status: "guest",
        user: null,
        guestQuota: quota
      });
    });

    it("user → profile, no quota", async () => {
      currentUser.peek.mockReturnValue({
        userId: "u-1",
        isGuest: false,
        sessionToken: "t"
      });
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        email: "a@b.test",
        fullName: "Ann",
        avatar: null,
        externalSub: "sub-1"
      });
      await expect(service.me("1.2.3.4")).resolves.toEqual({
        status: "user",
        user: { id: "u-1", email: "a@b.test", fullName: "Ann", avatar: null },
        guestQuota: null
      });
      expect(usage.peek).not.toHaveBeenCalled();
    });
  });
});
