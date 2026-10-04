import { createPublicKey, createVerify, type JsonWebKey } from "crypto";

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string | null;
}

export type IdTokenFailure =
  "malformed" | "alg" | "signature" | "iss" | "aud" | "exp" | "nonce" | "kid";

export class IdTokenError extends Error {
  constructor(readonly reason: IdTokenFailure) {
    super(`id_token rejected: ${reason}`);
  }
}

const CLOCK_SKEW_SEC = 60;

function parsePart<T>(part: string): T {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
  } catch {
    throw new IdTokenError("malformed");
  }
}

export function decodeJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new IdTokenError("malformed");
  const header = parsePart<{ alg: string; kid?: string }>(parts[0]);
  if (header.alg !== "RS256") throw new IdTokenError("alg");
  const payload = parsePart<IdTokenClaims>(parts[1]);
  if (typeof payload.sub !== "string" || !payload.sub)
    throw new IdTokenError("malformed");
  return {
    header,
    payload,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: Buffer.from(parts[2], "base64url")
  };
}

export function verifyRs256(token: string, jwk: JsonWebKey): boolean {
  const { signingInput, signature } = decodeJwt(token);
  const key = createPublicKey({ key: jwk, format: "jwk" });
  return createVerify("RSA-SHA256").update(signingInput).verify(key, signature);
}

export function validateClaims(
  claims: IdTokenClaims,
  expected: { issuer: string; clientId: string; nonce: string; nowSec: number }
): void {
  if (claims.iss !== expected.issuer) throw new IdTokenError("iss");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.clientId)) throw new IdTokenError("aud");
  if (
    typeof claims.exp !== "number" ||
    claims.exp + CLOCK_SKEW_SEC < expected.nowSec
  )
    throw new IdTokenError("exp");
  if (claims.nonce !== expected.nonce) throw new IdTokenError("nonce");
}
