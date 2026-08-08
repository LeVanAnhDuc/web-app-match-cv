import type { AiCredential, Document, MatchResult, User } from "@prisma/client";

/** Bumped whenever the exported shape changes, so an old export stays parseable. */
const SCHEMA_VERSION = 1;
/** 6 hex chars off the uuid — enough to separate two documents sharing a title. */
const ID_SUFFIX_LENGTH = 6;
/** Keeps the whole entry name inside the 255-char per-component filesystem limit. */
const MAX_SLUG_LENGTH = 60;
const COMBINING_MARKS = /\p{M}/gu;
const D_STROKE = /đ/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
// NUL only. Written as an explicit escape so it is never mistaken for a
// space when this file is edited — stripping spaces from rawText would
// silently corrupt every exported document.
// eslint-disable-next-line no-control-regex -- intentional: strip NUL only
const NULL_BYTES = /\u0000/g;

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function extensionFor(fileMime: string | null): string {
  if (fileMime === PDF_MIME) return "pdf";
  if (fileMime === DOCX_MIME) return "docx";
  return "bin";
}

/**
 * Builds the zip entry name for a document's original upload.
 *
 * The title is user-controlled, so this is a security boundary, not a
 * cosmetic helper: everything outside [a-z0-9-] is dropped, which removes
 * path separators and `..` traversal in one step. The extension comes from
 * `fileMime` rather than the title, so a document called `payload.exe`
 * cannot dictate what the extracted file is called.
 *
 * The id suffix is not decoration either — it keeps two documents that slug
 * to the same string from overwriting each other in the archive, and it
 * incidentally defuses Windows-reserved names (`CON` becomes `con-a1b2c3`).
 */
export function slugifyDocumentName(
  title: string,
  id: string,
  fileMime: string | null
): string {
  const folded = title
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(D_STROKE, "d");
  const slug =
    folded
      .replace(NON_SLUG_CHARS, "-")
      .replace(EDGE_DASHES, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(EDGE_DASHES, "") || "document";
  const suffix = id.replace(/-/g, "").slice(0, ID_SUFFIX_LENGTH);
  return `${slug}-${suffix}.${extensionFor(fileMime)}`;
}

export interface ExportedDocument {
  id: string;
  kind: string;
  title: string;
  sourceFormat: string;
  isSaved: boolean;
  createdAt: string;
  rawText: string;
  /** Path inside the archive, or null for paste-text documents. */
  file: string | null;
}

export interface ExportedMatchResult {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  report: unknown;
  createdAt: string;
  /**
   * Which credential ran this match, snapshotted as an id reference only
   * (not the credential row itself) — the credential can later be
   * re-pointed or deleted, but the historical match must stay readable.
   */
  credentialId: string | null;
  provider: string;
  chatModel: string;
  embedModel: string;
}

export interface ExportedAiCredential {
  id: string;
  provider: string;
  label: string;
  keyLast4: string;
  chatModel: string | null;
  embedModel: string | null;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ExportManifest {
  schemaVersion: number;
  exportedAt: string;
  user: { id: string; role: string; createdAt: string };
  documents: Array<ExportedDocument>;
  matchResults: Array<ExportedMatchResult>;
  aiCredentials: Array<ExportedAiCredential>;
}

// Narrowed to the exact fields this function reads (mirroring `user` below)
// rather than the full Prisma entities. `role` is widened to `string` — a
// `User` fetched by the caller is typed `Role`, which is still assignable
// into `string` — so a real Prisma row always satisfies this input type.
export interface ExportInput {
  user: Pick<User, "id" | "createdAt"> & { role: string };
  documents: Array<
    Pick<
      Document,
      | "id"
      | "kind"
      | "title"
      | "sourceFormat"
      | "rawText"
      | "fileMime"
      | "isSaved"
      | "createdAt"
    > & {
      /**
       * Whether this document has stored file bytes — computed by the
       * caller (an `octet_length` probe against the DB), never the bytes
       * themselves. Keeping this a boolean rather than a `fileData: Bytes`
       * field means a caller that only knows "yes/no" cannot be tempted
       * into passing placeholder bytes that lie about size or content.
       */
      hasFile: boolean;
    }
  >;
  matchResults: Array<
    Pick<
      MatchResult,
      | "id"
      | "cvDocumentId"
      | "jdDocumentId"
      | "overallScore"
      | "semanticScore"
      | "keywordScore"
      | "report"
      | "createdAt"
      | "credentialId"
      | "provider"
      | "chatModel"
      | "embedModel"
    >
  >;
  aiCredentials: Array<
    Pick<
      AiCredential,
      | "id"
      | "provider"
      | "label"
      | "keyLast4"
      | "chatModel"
      | "embedModel"
      | "lastTestStatus"
      | "lastTestedAt"
      | "lastUsedAt"
      | "createdAt"
    >
  >;
  exportedAt: Date;
}

const iso = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * Maps entities to the exported shape. This function is the single place the
 * export decides what leaves the system, which is why it is pure and covered
 * by its own tests: `AiCredential.encryptedKey` / `keyIv` / `keyTag` must
 * never appear in the output, and a field-by-field mapping (rather than a
 * spread) is what guarantees that a column added later is not leaked by
 * default.
 */
export function buildExportManifest(input: ExportInput): ExportManifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    user: {
      id: input.user.id,
      role: String(input.user.role),
      createdAt: input.user.createdAt.toISOString()
    },
    documents: input.documents.map((doc) => ({
      id: doc.id,
      kind: String(doc.kind),
      title: doc.title,
      sourceFormat: String(doc.sourceFormat),
      isSaved: doc.isSaved,
      createdAt: doc.createdAt.toISOString(),
      rawText: doc.rawText.replace(NULL_BYTES, ""),
      // `hasFile` comes from the caller's `octet_length` probe against the
      // DB, not from reading the bytes here — this function never touches
      // the actual file content.
      file: doc.hasFile
        ? `documents/${slugifyDocumentName(doc.title, doc.id, doc.fileMime)}`
        : null
    })),
    matchResults: input.matchResults.map((match) => ({
      id: match.id,
      cvDocumentId: match.cvDocumentId,
      jdDocumentId: match.jdDocumentId,
      overallScore: match.overallScore,
      semanticScore: match.semanticScore,
      keywordScore: match.keywordScore,
      report: match.report,
      createdAt: match.createdAt.toISOString(),
      credentialId: match.credentialId ?? null,
      provider: String(match.provider),
      chatModel: match.chatModel,
      embedModel: match.embedModel
    })),
    aiCredentials: input.aiCredentials.map((cred) => ({
      id: cred.id,
      provider: String(cred.provider),
      label: cred.label,
      keyLast4: cred.keyLast4,
      chatModel: cred.chatModel ?? null,
      embedModel: cred.embedModel ?? null,
      lastTestStatus:
        cred.lastTestStatus === null ? null : String(cred.lastTestStatus),
      lastTestedAt: iso(cred.lastTestedAt),
      lastUsedAt: iso(cred.lastUsedAt),
      createdAt: cred.createdAt.toISOString()
    }))
  };
}
