import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { FakeIdp, TOKEN_FAULTS, decodeJwt, s256, sealOAuthState, unsealOAuthState } from "./fake-idp";

// Unit tests of the fake IdP alone (no Match CV process, no database).

const secret = randomBytes(36).toString("base64url");

test("s256 is base64url(sha256(verifier))", () => {
  expect(s256("abc")).toBe(createHash("sha256").update("abc").digest("base64url"));
});

test("mcv_oauth sealing round-trips and rejects another secret or a flipped byte", () => {
  const state = { state: "s", nonce: "n", verifier: "v", returnTo: "/x", guestUserId: null, exp: 1 };
  const sealed = sealOAuthState(state, secret);
  expect(unsealOAuthState(sealed, secret)).toEqual(state);
  expect(unsealOAuthState(sealed, `${secret}x`)).toBeNull();
  expect(unsealOAuthState(`${sealed.slice(0, -2)}${sealed.endsWith("AA") ? "BB" : "AA"}`, secret)).toBeNull();
  expect(unsealOAuthState("short", secret)).toBeNull();
});

test.describe("FakeIdp over HTTP", () => {
  let idp: FakeIdp;

  test.beforeAll(async () => {
    idp = await new FakeIdp().start();
  });

  test.afterAll(async () => {
    await idp.stop();
  });

  const token = (form: Record<string, string>, basic = `${idp.clientId}:${idp.clientSecret}`) =>
    fetch(`${idp.issuer}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(basic).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
    });

  test("discovery names itself as issuer and points at its own endpoints", async () => {
    const doc = (await (await fetch(`${idp.issuer}/.well-known/openid-configuration`)).json()) as Record<string, string>;
    expect(doc.issuer).toBe(idp.issuer);
    expect(doc.token_endpoint).toBe(`${idp.issuer}/oauth/token`);
    const jwks = (await (await fetch(doc.jwks_uri)).json()) as { keys: Array<{ kid: string; kty: string }> };
    expect(jwks.keys[0]).toMatchObject({ kty: "RSA" });
  });

  test("a code is exchanged once, only with the right PKCE verifier and client", async () => {
    const verifier = randomBytes(32).toString("base64url");
    const redirectUri = "http://localhost:1/cb";
    const issue = () =>
      idp.issueCode({ nonce: "n1", codeChallenge: s256(verifier), redirectUri, identity: { sub: "u1", email: "u1@x" } });

    const wrongVerifier = await token({ grant_type: "authorization_code", code: issue(), redirect_uri: redirectUri, code_verifier: "nope" });
    expect(wrongVerifier.status).toBe(400);
    const wrongClient = await token(
      { grant_type: "authorization_code", code: issue(), redirect_uri: redirectUri, code_verifier: verifier },
      `${idp.clientId}:bad`
    );
    expect(wrongClient.status).toBe(401);

    const code = issue();
    const ok = await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
    expect(ok.status).toBe(200);
    const { id_token } = (await ok.json()) as { id_token: string };
    const { header, payload } = decodeJwt(id_token);
    expect(header).toMatchObject({ alg: "RS256" });
    expect(payload).toMatchObject({ iss: idp.issuer, aud: idp.clientId, sub: "u1", nonce: "n1", email: "u1@x" });
    const replay = await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
    expect(replay.status).toBe(400);
  });

  test("every fault is applied to the next token request only", async () => {
    expect(TOKEN_FAULTS.length).toBeGreaterThan(5);
    idp.failNextToken("http-500");
    expect((await token({ grant_type: "authorization_code", code: "x" })).status).toBe(500);
    expect((await token({ grant_type: "authorization_code", code: "x" })).status).toBe(400);
  });

  test("authorize auto-consents back to redirect_uri with code, state and iss, or denies", async () => {
    const q = new URLSearchParams({ client_id: idp.clientId, redirect_uri: "http://localhost:1/cb", state: "st", nonce: "n" });
    const consent = await fetch(`${idp.issuer}/oauth/authorize?${q}`, { redirect: "manual" });
    const back = new URL(consent.headers.get("location")!);
    expect(back.searchParams.get("state")).toBe("st");
    expect(back.searchParams.get("iss")).toBe(idp.issuer);
    expect(back.searchParams.get("code")).toBeTruthy();

    idp.authorizeBehaviour = "deny";
    const denied = new URL((await fetch(`${idp.issuer}/oauth/authorize?${q}`, { redirect: "manual" })).headers.get("location")!);
    expect(denied.searchParams.get("error")).toBe("access_denied");
    idp.authorizeBehaviour = "consent";
  });
});
