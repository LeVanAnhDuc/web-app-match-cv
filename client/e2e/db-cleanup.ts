import { Client } from "pg";

// Dev DB only. Connection is sourced from E2E_DATABASE_URL (loaded from
// client/.env by playwright.config.ts via dotenv) so no credential is
// committed. Falls back to the local placeholder from client/.env.example.
// No DELETE endpoint exists yet, so the E2E suite cleans the rows it creates
// directly via `pg` to stay idempotent and safe to re-run.
const CONNECTION_STRING =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/matchcv";

export async function cleanDocuments(): Promise<void> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  try {
    // MatchResult references Document with the Prisma default onDelete:
    // Restrict (server/prisma/schema.prisma), so deleting documents while any
    // match row survives fails with a FK violation and takes globalSetup — and
    // therefore the whole run — down with it. Clear the child table first.
    await client.query('DELETE FROM "MatchResult"');
    // MatchRun references Document with the Prisma default onDelete: Restrict
    // too, so it has to go before the documents it points at — same reason
    // MatchResult does.
    await client.query('DELETE FROM "MatchRun"');
    await client.query('DELETE FROM "Document"');
  } finally {
    await client.end();
  }
}
