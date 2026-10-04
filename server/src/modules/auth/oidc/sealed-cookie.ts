import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;
const keyOf = (secret: string) => createHash("sha256").update(secret).digest();

/** AES-256-GCM, key = sha256(secret). Layout: iv | tag | ciphertext, base64url. */
export function seal(payload: object, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(value: string, secret: string): T | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyOf(secret),
      raw.subarray(0, IV_BYTES)
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
