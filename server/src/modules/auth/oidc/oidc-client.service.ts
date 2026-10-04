import type { JsonWebKey } from "crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  decodeJwt,
  type IdTokenClaims,
  IdTokenError,
  validateClaims,
  verifyRs256
} from "./id-token";

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}
type Jwk = JsonWebKey & { kid?: string };

const HTTP_TIMEOUT_MS = 5000;

/** Hand-rolled on purpose (ADR-0022): openid-client/jose are pure ESM and break the CommonJS Jest run. */
@Injectable()
export class OidcClientService {
  private discovery: Discovery | null = null;
  private jwks = new Map<string, Jwk>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return [
      "OIDC_ISSUER",
      "OIDC_CLIENT_ID",
      "OIDC_CLIENT_SECRET",
      "OIDC_REDIRECT_URI",
      "SESSION_SECRET"
    ].every((k) => Boolean(this.config.get<string>(k)));
  }

  private setting(key: string): string {
    const value = this.config.get<string>(key);
    if (!value)
      throw new ServiceUnavailableException({ code: "AUTH_NOT_CONFIGURED" });
    return value;
  }

  private async getDiscovery(): Promise<Discovery> {
    if (this.discovery) return this.discovery;
    const issuer = this.setting("OIDC_ISSUER").replace(/\/$/, "");
    const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`discovery ${res.status}`);
    const doc = (await res.json()) as Discovery;
    if (doc.issuer !== issuer) throw new Error("discovery issuer mismatch");
    this.discovery = doc;
    return doc;
  }

  async authorizeUrl(p: {
    state: string;
    nonce: string;
    codeChallenge: string;
  }): Promise<string> {
    const d = await this.getDiscovery();
    const url = new URL(d.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.setting("OIDC_CLIENT_ID"),
      redirect_uri: this.setting("OIDC_REDIRECT_URI"),
      scope: "openid profile email",
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.codeChallenge,
      code_challenge_method: "S256"
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string, verifier: string): Promise<string> {
    const d = await this.getDiscovery();
    const id = encodeURIComponent(this.setting("OIDC_CLIENT_ID"));
    const secret = encodeURIComponent(this.setting("OIDC_CLIENT_SECRET"));
    const res = await fetch(d.token_endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.setting("OIDC_REDIRECT_URI"),
        code_verifier: verifier
      }).toString(),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
    });
    // Ducker ID's rate limiter answers in its own error shape, not OAuth's — treat every non-2xx alike.
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new Error("token response without id_token");
    return body.id_token;
  }

  private async loadJwks(): Promise<void> {
    const d = await this.getDiscovery();
    const res = await fetch(d.jwks_uri, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const { keys } = (await res.json()) as { keys: Jwk[] };
    this.jwks = new Map(
      keys.filter((k) => k.kid).map((k) => [k.kid as string, k])
    );
  }

  async verifyIdToken(idToken: string, nonce: string): Promise<IdTokenClaims> {
    const { header, payload } = decodeJwt(idToken);
    if (!header.kid) throw new IdTokenError("kid");
    // Ducker ID's dev keypair is regenerated on every restart — an unknown kid earns exactly one refetch.
    if (!this.jwks.has(header.kid)) await this.loadJwks();
    const jwk = this.jwks.get(header.kid);
    if (!jwk) throw new IdTokenError("kid");
    if (!verifyRs256(idToken, jwk)) throw new IdTokenError("signature");
    validateClaims(payload, {
      issuer: this.setting("OIDC_ISSUER").replace(/\/$/, ""),
      clientId: this.setting("OIDC_CLIENT_ID"),
      nonce,
      nowSec: Math.floor(Date.now() / 1000)
    });
    return payload;
  }
}
