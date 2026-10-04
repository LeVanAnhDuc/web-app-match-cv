import { generateKeyPairSync, createSign } from "crypto";
import { ConfigService } from "@nestjs/config";
import { IdTokenError } from "./id-token";
import { OidcClientService } from "./oidc-client.service";

const ISSUER = "http://localhost:3000";
const CLIENT_ID = "client_abc";
const SECRET = "s3cret/+=";
const REDIRECT = "http://localhost:5200/api/v1/auth/callback";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048
});
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload: object, header: object = { alg: "RS256", kid: "k1" }) {
  const input = `${b64(header)}.${b64(payload)}`;
  return `${input}.${createSign("RSA-SHA256").update(input).sign(privateKey).toString("base64url")}`;
}

const env: Record<string, string> = {
  OIDC_ISSUER: ISSUER,
  OIDC_CLIENT_ID: CLIENT_ID,
  OIDC_CLIENT_SECRET: SECRET,
  OIDC_REDIRECT_URI: REDIRECT,
  SESSION_SECRET: "x".repeat(32)
};
const config = { get: (k: string) => env[k] } as unknown as ConfigService;

const discoveryDoc = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth/authorize`,
  token_endpoint: `${ISSUER}/oauth/token`,
  jwks_uri: `${ISSUER}/.well-known/jwks.json`
};
const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body)
});

describe("OidcClientService", () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  let service: OidcClientService;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new OidcClientService(config);
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("reports whether it is configured", () => {
    expect(service.isConfigured()).toBe(true);
    expect(
      new OidcClientService({
        get: () => undefined
      } as unknown as ConfigService).isConfigured()
    ).toBe(false);
  });

  it("throws when discovery issuer does not match", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ...discoveryDoc, issuer: "http://evil" })
    );
    await expect(
      service.authorizeUrl({ state: "s", nonce: "n", codeChallenge: "c" })
    ).rejects.toThrow(/issuer mismatch/);
  });

  it("builds the authorize URL", async () => {
    fetchMock.mockResolvedValueOnce(json(discoveryDoc));
    const url = await service.authorizeUrl({
      state: "st",
      nonce: "no",
      codeChallenge: "ch"
    });
    expect(url).toContain("response_type=code");
    expect(url).toContain("scope=openid+profile+email");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain(encodeURIComponent(REDIRECT));
    expect(url).toContain("state=st");
  });

  it("exchanges the code with Basic auth and the PKCE verifier", async () => {
    fetchMock
      .mockResolvedValueOnce(json(discoveryDoc))
      .mockResolvedValueOnce(json({ id_token: "tok" }));
    await expect(
      service.exchangeCode("the-code", "the-verifier")
    ).resolves.toBe("tok");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(discoveryDoc.token_endpoint);
    const basic = Buffer.from(
      `${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(SECRET)}`
    ).toString("base64");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${basic}`
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("redirect_uri")).toBe(REDIRECT);
    expect(body.get("code_verifier")).toBe("the-verifier");
  });

  it("treats any non-2xx token response as a failure", async () => {
    fetchMock
      .mockResolvedValueOnce(json(discoveryDoc))
      .mockResolvedValueOnce(json({ message: "slow down" }, 429));
    await expect(service.exchangeCode("c", "v")).rejects.toThrow(/429/);
  });

  describe("verifyIdToken", () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      sub: "65f0c0ffee",
      iss: ISSUER,
      aud: CLIENT_ID,
      exp: now + 900,
      iat: now,
      nonce: "n1"
    };

    it("refetches JWKS once when the kid is unknown, then verifies", async () => {
      fetchMock
        .mockResolvedValueOnce(json(discoveryDoc))
        .mockResolvedValueOnce(json({ keys: [jwk] }));
      await expect(
        service.verifyIdToken(sign(claims), "n1")
      ).resolves.toMatchObject({ sub: "65f0c0ffee" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("fails with reason kid when the kid is still unknown after one refetch", async () => {
      fetchMock
        .mockResolvedValueOnce(json(discoveryDoc))
        .mockResolvedValueOnce(json({ keys: [jwk] }));
      const token = sign(claims, { alg: "RS256", kid: "unknown" });
      const err = await service
        .verifyIdToken(token, "n1")
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(IdTokenError);
      expect((err as IdTokenError).reason).toBe("kid");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("rejects a nonce mismatch", async () => {
      fetchMock
        .mockResolvedValueOnce(json(discoveryDoc))
        .mockResolvedValueOnce(json({ keys: [jwk] }));
      await expect(
        service.verifyIdToken(sign(claims), "other")
      ).rejects.toMatchObject({ reason: "nonce" });
    });
  });
});
