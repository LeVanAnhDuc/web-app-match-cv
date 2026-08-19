import { randomBytes } from "crypto";
import { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "./credential-crypto.service";

const KEY_B64 = randomBytes(32).toString("base64");
const PLAINTEXT = "sk-super-secret-value-1234";

function makeService(key?: string): CredentialCryptoService {
  const config = {
    get: (name: string) =>
      name === "CREDENTIAL_ENCRYPTION_KEY" ? key : undefined
  } as unknown as ConfigService;
  return new CredentialCryptoService(config);
}

describe("CredentialCryptoService", () => {
  it("reports configured only for a base64 key of exactly 32 bytes", () => {
    expect(makeService(KEY_B64).isConfigured()).toBe(true);
    expect(makeService(undefined).isConfigured()).toBe(false);
    expect(makeService(randomBytes(16).toString("base64")).isConfigured()).toBe(
      false
    );
    expect(makeService(randomBytes(64).toString("base64")).isConfigured()).toBe(
      false
    );
  });

  it("round-trips a value", () => {
    const service = makeService(KEY_B64);
    expect(service.decrypt(service.encrypt(PLAINTEXT))).toBe(PLAINTEXT);
  });

  it("never reuses an IV and never leaves plaintext in the ciphertext", () => {
    const service = makeService(KEY_B64);
    const a = service.encrypt(PLAINTEXT);
    const b = service.encrypt(PLAINTEXT);
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(
      false
    );
    expect(Buffer.from(a.ciphertext).toString("utf8")).not.toContain(
      "sk-super-secret"
    );
  });

  it("throws when the ciphertext is tampered with", () => {
    const service = makeService(KEY_B64);
    const payload = service.encrypt(PLAINTEXT);
    payload.ciphertext[0] ^= 0xff;
    expect(() => service.decrypt(payload)).toThrow();
  });

  it("throws when the auth tag is tampered with", () => {
    const service = makeService(KEY_B64);
    const payload = service.encrypt(PLAINTEXT);
    payload.tag[0] ^= 0xff;
    expect(() => service.decrypt(payload)).toThrow();
  });

  it("cannot decrypt ciphertext produced under a different key", () => {
    const payload = makeService(KEY_B64).encrypt(PLAINTEXT);
    const other = makeService(randomBytes(32).toString("base64"));
    expect(() => other.decrypt(payload)).toThrow();
  });

  it("throws on encrypt when not configured", () => {
    expect(() => makeService(undefined).encrypt(PLAINTEXT)).toThrow();
  });
});
