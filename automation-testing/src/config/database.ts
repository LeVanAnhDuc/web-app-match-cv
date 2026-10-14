// Dev Postgres the app writes to. Tests seed and clean rows directly (no DELETE endpoints exist yet), so this must
// point at a disposable dev database, never stg/prd.
export function databaseUrl(source: NodeJS.ProcessEnv = process.env): string {
  return source.E2E_DATABASE_URL?.trim() || "postgresql://postgres:postgres@localhost:5432/matchcv";
}
