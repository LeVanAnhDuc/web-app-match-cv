import { createHash, randomBytes } from "crypto";

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url")
  };
}
