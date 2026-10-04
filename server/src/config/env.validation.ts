import { plainToInstance } from "class-transformer";
import { IsInt, IsOptional, IsString, validateSync } from "class-validator";

class EnvVars {
  @IsInt() PORT: number = 5200;
  @IsString() CLIENT_ORIGIN: string = "http://localhost:5300";
  @IsString() DATABASE_URL!: string;

  // --- AI provider (Plan 2 matching engine) — OpenRouter, optional at boot, required at match time ---
  @IsOptional() @IsString() OPENROUTER_API_KEY?: string;
  @IsOptional() @IsString() OPENROUTER_BASE_URL?: string;
  @IsOptional() @IsString() OPENROUTER_CHAT_MODEL?: string;
  @IsOptional() @IsString() OPENROUTER_EMBED_MODEL?: string;

  // --- Credential encryption (BYO AI credentials) — base64 of exactly 32 bytes.
  // Optional at boot so tests/CI need no real key; required the moment any
  // /ai-credentials endpoint is called (503 otherwise). Length is checked in
  // CredentialCryptoService, which owns what "valid" means for this value.
  @IsOptional() @IsString() CREDENTIAL_ENCRYPTION_KEY?: string;

  // --- Sign-in through Ducker ID (ADR-0022). Optional at boot so unit/e2e
  // tests need no IdP; /auth/login and /auth/callback answer 503 without them.
  @IsOptional() @IsString() OIDC_ISSUER?: string;
  @IsOptional() @IsString() OIDC_CLIENT_ID?: string;
  @IsOptional() @IsString() OIDC_CLIENT_SECRET?: string;
  @IsOptional() @IsString() OIDC_REDIRECT_URI?: string;
  // >=32 chars. Seals the mcv_oauth cookie and keys the guest IP HMAC.
  @IsOptional() @IsString() SESSION_SECRET?: string;
  @IsInt() SESSION_TTL_DAYS: number = 7;
  @IsInt() GUEST_TTL_HOURS: number = 24;
  @IsInt() GUEST_MATCH_LIMIT_PER_DAY: number = 5;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(
    EnvVars,
    {
      ...config,
      PORT: Number(config.PORT ?? 5200),
      SESSION_TTL_DAYS: Number(config.SESSION_TTL_DAYS ?? 7),
      GUEST_TTL_HOURS: Number(config.GUEST_TTL_HOURS ?? 24),
      GUEST_MATCH_LIMIT_PER_DAY: Number(config.GUEST_MATCH_LIMIT_PER_DAY ?? 5)
    },
    { enableImplicitConversion: true }
  );
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length)
    throw new Error(`Config validation error: ${errors.toString()}`);
  return validated;
}
