import { generateKeyPairSync, createSign } from "crypto";
import {
  decodeJwt,
  IdTokenError,
  validateClaims,
  verifyRs256
} from "./id-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048
});
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(
  payload: object,
  header: object = { alg: "RS256", kid: "k1" },
  key = privateKey
) {
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = createSign("RSA-SHA256")
    .update(input)
    .sign(key)
    .toString("base64url");
  return `${input}.${sig}`;
}

const now = 1_800_000_000;
const good = {
  sub: "65f0c0ffee",
  iss: "http://localhost:3000",
  aud: "client_abc",
  exp: now + 900,
  iat: now,
  nonce: "n1"
};
const expected = {
  issuer: "http://localhost:3000",
  clientId: "client_abc",
  nonce: "n1",
  nowSec: now
};

describe("id_token", () => {
  it("verifies a token signed by the JWK", () => {
    expect(verifyRs256(sign(good), jwk)).toBe(true);
  });
  it("rejects a token signed by another key", () => {
    expect(verifyRs256(sign(good, undefined, other.privateKey), jwk)).toBe(
      false
    );
  });
  it("accepts valid claims", () => {
    expect(() =>
      validateClaims(decodeJwt(sign(good)).payload, expected)
    ).not.toThrow();
  });
  it.each([
    ["iss", { iss: "http://evil" }],
    ["aud", { aud: "someone-else" }],
    ["exp", { exp: now - 120 }],
    ["nonce", { nonce: "n2" }]
  ])("rejects a wrong %s", (reason, patch) => {
    const claims = decodeJwt(sign({ ...good, ...patch })).payload;
    try {
      validateClaims(claims, expected);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(IdTokenError);
      expect((e as IdTokenError).reason).toBe(reason);
    }
  });
  it("rejects an empty expected nonce, with or without a token nonce", () => {
    const { nonce: _omit, ...noNonce } = good;
    void _omit;
    for (const claims of [noNonce, good]) {
      expect(() => validateClaims(claims, { ...expected, nonce: "" })).toThrow(
        expect.objectContaining({ reason: "nonce" })
      );
    }
  });
  it("rejects a token without a nonce claim", () => {
    const { nonce: _omit, ...noNonce } = good;
    void _omit;
    expect(() => validateClaims(noNonce, expected)).toThrow(
      expect.objectContaining({ reason: "nonce" })
    );
  });
  it("rejects a non-RSA or garbage JWK as signature", () => {
    const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const ecJwk = ec.publicKey.export({ format: "jwk" });
    for (const bad of [ecJwk, { kty: "RSA" }]) {
      expect(() => verifyRs256(sign(good), bad)).toThrow(
        expect.objectContaining({ reason: "signature" })
      );
    }
  });
  it("accepts aud as an array containing the client", () => {
    expect(() =>
      validateClaims({ ...good, aud: ["x", "client_abc"] }, expected)
    ).not.toThrow();
  });
  it("rejects a non-RS256 header as malformed/alg", () => {
    expect(() => decodeJwt(sign(good, { alg: "none" }))).toThrow(IdTokenError);
  });
  it("rejects a malformed token", () => {
    expect(() => decodeJwt("a.b")).toThrow(IdTokenError);
  });
});
