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
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(
    EnvVars,
    { ...config, PORT: Number(config.PORT ?? 5200) },
    { enableImplicitConversion: true }
  );
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length)
    throw new Error(`Config validation error: ${errors.toString()}`);
  return validated;
}
