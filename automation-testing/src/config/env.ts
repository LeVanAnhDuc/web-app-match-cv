export type EnvName = "dev" | "stg" | "prd";

const ENVS: readonly EnvName[] = ["dev", "stg", "prd"];

export function resolveEnv(raw: string | undefined): EnvName {
  const value = (raw ?? "dev").trim().toLowerCase();
  if (!(ENVS as readonly string[]).includes(value)) {
    throw new Error(`Unknown ENV "${raw}". Use one of: ${ENVS.join(", ")}`);
  }
  return value as EnvName;
}

export function requireVar(name: string, source: NodeJS.ProcessEnv = process.env): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var ${name} — copy .env.example to .env and fill it`);
  }
  return value;
}
