import { databaseUrl } from "@/config/database";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

// Direct row access to the dev Postgres for the API specs: seeding rows no endpoint creates (another user's data,
// failed matches, letters) and reading back what an endpoint wrote. The successor of the PrismaService calls in the
// old in-process Jest suite. Table and column names follow server/prisma/schema.prisma (quoted PascalCase / camelCase).
//
// Timestamps: Prisma writes `timestamp(3)` columns in UTC, so every value here goes in as
// `$n::timestamptz AT TIME ZONE 'UTC'` from an ISO string, never as a bare Date or `now()` (node-pg would send local
// time and the server, reading through Prisma, would see it shifted by the machine's offset).

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

export const utc = (value: Date | string = new Date()): string =>
  (typeof value === "string" ? new Date(value) : value).toISOString();

/** `count(*)` of a whole table, e.g. `countRows("CoverLetter")`. */
export async function countRows(table: string): Promise<number> {
  const [row] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`);
  return row.n;
}

export interface DocumentRow {
  id: string;
  userId: string;
  kind: "CV" | "JD";
  title: string;
  sourceFormat: "pdf" | "docx" | "text";
  rawText: string;
  fileData: Buffer | null;
  fileMime: string | null;
  isSaved: boolean;
  parentId: string | null;
}

export async function insertDocument(input: {
  userId: string;
  kind: "CV" | "JD";
  title: string;
  sourceFormat?: "pdf" | "docx" | "text";
  rawText: string;
  isSaved?: boolean;
  parentId?: string | null;
  fileData?: Buffer | null;
  fileMime?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await sql(
    `INSERT INTO "Document"
       (id, "userId", kind, title, "sourceFormat", "rawText", "fileData", "fileMime", "isSaved", "parentId", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz AT TIME ZONE 'UTC')`,
    [
      id,
      input.userId,
      input.kind,
      input.title,
      input.sourceFormat ?? "text",
      input.rawText,
      input.fileData ?? null,
      input.fileMime ?? null,
      input.isSaved ?? false,
      input.parentId ?? null,
      utc(),
    ]
  );
  return id;
}

export async function findDocument(id: string): Promise<DocumentRow | null> {
  const [row] = await sql<DocumentRow & Record<string, unknown>>(
    `SELECT id, "userId", kind, title, "sourceFormat", "rawText", "fileData", "fileMime", "isSaved", "parentId"
       FROM "Document" WHERE id = $1`,
    [id]
  );
  return row ?? null;
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length) await sql(`DELETE FROM "Document" WHERE id = ANY($1::text[])`, [ids]);
}

export type MatchReport = { strengths: string[]; gaps: string[]; suggestions: string[] };

export interface MatchResultRow {
  id: string;
  userId: string;
  credentialId: string | null;
  provider: string;
  chatModel: string;
  status: string;
}

export async function insertMatchResult(input: {
  userId: string;
  cvDocumentId: string;
  jdDocumentId: string;
  scores?: [overall: number, semantic: number, keyword: number];
  report?: MatchReport | Record<string, never>;
  status?: "succeeded" | "failed";
  errorCode?: string | null;
  runId?: string | null;
  credentialId?: string | null;
  provider?: "openrouter" | "openai" | "gemini";
  chatModel?: string;
  embedModel?: string;
  createdAt?: Date | string;
}): Promise<string> {
  const id = randomUUID();
  const [overall, semantic, keyword] = input.scores ?? [50, 50, 50];
  await sql(
    `INSERT INTO "MatchResult"
       (id, "userId", "cvDocumentId", "jdDocumentId", "overallScore", "semanticScore", "keywordScore", report,
        "runId", status, "errorCode", "credentialId", provider, "chatModel", "embedModel", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15,
             $16::timestamptz AT TIME ZONE 'UTC')`,
    [
      id,
      input.userId,
      input.cvDocumentId,
      input.jdDocumentId,
      overall,
      semantic,
      keyword,
      JSON.stringify(input.report ?? { strengths: [], gaps: [], suggestions: [] }),
      input.runId ?? null,
      input.status ?? "succeeded",
      input.errorCode ?? null,
      input.credentialId ?? null,
      input.provider ?? "openrouter",
      input.chatModel ?? "openai/gpt-4o-mini",
      input.embedModel ?? "openai/text-embedding-3-small",
      utc(input.createdAt),
    ]
  );
  return id;
}

export async function findMatchResult(id: string): Promise<MatchResultRow | null> {
  const [row] = await sql<MatchResultRow & Record<string, unknown>>(
    `SELECT id, "userId", "credentialId", provider, "chatModel", status FROM "MatchResult" WHERE id = $1`,
    [id]
  );
  return row ?? null;
}

export async function deleteMatchResults(ids: string[]): Promise<void> {
  if (ids.length) await sql(`DELETE FROM "MatchResult" WHERE id = ANY($1::text[])`, [ids]);
}

export async function insertMatchRun(input: {
  userId: string;
  cvDocumentId: string;
  jdDocumentId: string;
}): Promise<string> {
  const id = randomUUID();
  await sql(
    `INSERT INTO "MatchRun" (id, "userId", "cvDocumentId", "jdDocumentId", "createdAt")
     VALUES ($1, $2, $3, $4, $5::timestamptz AT TIME ZONE 'UTC')`,
    [id, input.userId, input.cvDocumentId, input.jdDocumentId, utc()]
  );
  return id;
}

export interface AiCredentialRow {
  id: string;
  encryptedKey: Buffer;
  keyIv: Buffer;
  keyTag: Buffer;
  lastTestStatus: string | null;
  lastTestedAt: Date | null;
}

export async function insertAiCredential(input: {
  userId: string;
  provider: "openrouter" | "openai" | "gemini";
  label: string;
  encryptedKey: Buffer;
  keyIv: Buffer;
  keyTag: Buffer;
  keyLast4: string;
}): Promise<string> {
  const id = randomUUID();
  const now = utc();
  await sql(
    `INSERT INTO "AiCredential"
       (id, "userId", provider, label, "encryptedKey", "keyIv", "keyTag", "keyLast4", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz AT TIME ZONE 'UTC', $9::timestamptz AT TIME ZONE 'UTC')`,
    [id, input.userId, input.provider, input.label, input.encryptedKey, input.keyIv, input.keyTag, input.keyLast4, now]
  );
  return id;
}

export async function findAiCredential(id: string): Promise<AiCredentialRow | null> {
  const [row] = await sql<AiCredentialRow & Record<string, unknown>>(
    `SELECT id, "encryptedKey", "keyIv", "keyTag", "lastTestStatus", "lastTestedAt" FROM "AiCredential" WHERE id = $1`,
    [id]
  );
  return row ?? null;
}

export async function insertCoverLetter(input: {
  userId: string;
  matchResultId: string;
  tone?: "formal" | "friendly";
  length?: "short" | "standard";
  language?: "en" | "vi";
  content?: string;
  omittedRequirements?: string[];
  status?: "succeeded" | "failed";
  errorCode?: string | null;
  provider?: "openrouter" | "openai" | "gemini";
  chatModel?: string;
  createdAt?: Date | string;
}): Promise<string> {
  const id = randomUUID();
  const at = utc(input.createdAt);
  await sql(
    `INSERT INTO "CoverLetter"
       (id, "userId", "matchResultId", tone, length, language, content, "omittedRequirements", status, "errorCode",
        provider, "chatModel", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $10, $11, $12,
             $13::timestamptz AT TIME ZONE 'UTC', $13::timestamptz AT TIME ZONE 'UTC')`,
    [
      id,
      input.userId,
      input.matchResultId,
      input.tone ?? "formal",
      input.length ?? "standard",
      input.language ?? "en",
      input.content ?? "Dear hiring manager,",
      input.omittedRequirements ?? [],
      input.status ?? "succeeded",
      input.errorCode ?? null,
      input.provider ?? "openrouter",
      input.chatModel ?? "openai/gpt-4o-mini",
      at,
    ]
  );
  return id;
}
