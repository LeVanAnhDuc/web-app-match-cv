import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { I18nContext } from "nestjs-i18n";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard nonce length

/**
 * `Uint8Array` rather than `Buffer` because that is what Prisma's `Bytes`
 * columns produce — a Buffer satisfies it on the way in, so both directions
 * type-check without a cast at the call site.
 */
export interface EncryptedPayload {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
}

/**
 * Node's crypto helpers hand back `Buffer<ArrayBufferLike>`, while Prisma's
 * `Bytes` columns are typed `Uint8Array<ArrayBuffer>`. Copying through a plain
 * Uint8Array reconciles the two without a cast.
 */
function toBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value);
}

/**
 * AES-256-GCM for user-supplied provider API keys.
 *
 * Optional at boot (mirrors AiService): the app starts without
 * `CREDENTIAL_ENCRYPTION_KEY` so tests and every unrelated endpoint keep
 * working; the key becomes required the moment a credential is read or
 * written. A temporary key is NEVER generated — ciphertext written under a
 * throwaway key would be undecryptable after the next restart.
 */
@Injectable()
export class CredentialCryptoService {
  private readonly key?: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>("CREDENTIAL_ENCRYPTION_KEY");
    const decoded = raw ? Buffer.from(raw, "base64") : undefined;
    this.key = decoded?.length === KEY_BYTES ? decoded : undefined;
  }

  isConfigured(): boolean {
    return this.key !== undefined;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        I18nContext.current()?.t(
          "aiCredentials.errors.cryptoNotConfigured" as never
        ) ??
          "Credential storage is not configured. Please contact the administrator."
      );
    }
    return this.key;
  }

  encrypt(plain: string): EncryptedPayload {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final()
    ]);
    return {
      ciphertext: toBytes(ciphertext),
      iv: toBytes(iv),
      tag: toBytes(cipher.getAuthTag())
    };
  }

  decrypt({ ciphertext, iv, tag }: EncryptedPayload): string {
    const decipher = createDecipheriv(ALGORITHM, this.requireKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString("utf8");
  }
}
