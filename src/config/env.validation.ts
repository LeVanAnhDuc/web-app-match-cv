import { plainToInstance } from 'class-transformer';
import { IsInt, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsInt() PORT: number = 5200;
  @IsString() CLIENT_ORIGIN: string = 'http://localhost:5300';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(
    EnvVars,
    { ...config, PORT: Number(config.PORT ?? 5200) },
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length)
    throw new Error(`Config validation error: ${errors.toString()}`);
  return validated;
}
