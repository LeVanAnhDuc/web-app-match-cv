// Test values of module "data-export" (GET /me/export, /my-data). Values only: no .env, no network, no DB.

import type { CopyKey } from "@/data/copy";

/** The three items of the "The archive contains" card, in display order (client MyDataPanel). */
export const CONTENTS_KEYS = {
  documents: "myData.contents.documents",
  matches: "myData.contents.matches",
  credentials: "myData.contents.credentials",
} as const satisfies Record<string, CopyKey>;

export type ContentsItem = keyof typeof CONTENTS_KEYS;

export const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  other: "application/x-msdownload",
} as const;

/** Root keys data.json must carry today (REQ-DATAEXPORT-07). */
export const MANIFEST_ROOT_KEYS = ["schemaVersion", "exportedAt", "user", "documents", "matchResults", "aiCredentials"];

/** Fields every exported document carries (REQ-DATAEXPORT-08). */
export const DOCUMENT_FIELDS = ["id", "kind", "title", "sourceFormat", "isSaved", "createdAt", "rawText", "file"];

/** Fields every exported match result carries (REQ-DATAEXPORT-09). */
export const MATCH_RESULT_FIELDS = [
  "id",
  "cvDocumentId",
  "jdDocumentId",
  "overallScore",
  "semanticScore",
  "keywordScore",
  "report",
  "createdAt",
  "credentialId",
  "provider",
  "chatModel",
  "embedModel",
];

/** The ONLY fields an exported AI credential may carry (REQ-DATAEXPORT-10). */
export const AI_CREDENTIAL_FIELDS = [
  "id",
  "provider",
  "label",
  "keyLast4",
  "chatModel",
  "embedModel",
  "lastTestStatus",
  "lastTestedAt",
  "lastUsedAt",
  "createdAt",
];

/** Names of the secret columns, which must never appear anywhere in the archive (REQ-DATAEXPORT-13). */
export const SECRET_FIELD_NAMES = ["encryptedKey", "keyIv", "keyTag"];

/** Distinctive markers: a substring match over the whole archive proves a leak, a coincidence is implausible. */
export function secretMarkers(tag: string) {
  return {
    encryptedKey: `CIPHERTEXT_MARKER_${tag}`,
    keyIv: `IV_MARKER_${tag}`,
    keyTag: `TAG_MARKER_${tag}`,
  };
}

export const OTHER_USER_MARKER = "OTHER_USER_SECRET_MARKER";
export const GUEST_MARKER = "GUEST_USER_SECRET_MARKER";

/** Small fake file bodies (the export never parses them, it copies bytes). */
export const FAKE_PDF = (label = "x") => Buffer.from(`%PDF-1.4 fake pdf bytes ${label}`);

/** Titles and the slug the server must derive from them (REQ-DATAEXPORT-15). */
export const SLUG_CASES = [
  { title: "CV Nguyễn Văn A", mime: MIME.pdf, slug: "cv-nguyen-van-a", ext: "pdf" },
  { title: "Đơn ứng tuyển", mime: MIME.docx, slug: "don-ung-tuyen", ext: "docx" },
  { title: "payload.exe", mime: MIME.other, slug: "payload-exe", ext: "bin" },
] as const;

/** Titles that try to escape documents/ (REQ-DATAEXPORT-16). */
export const ZIP_SLIP_TITLES = ["../../etc/passwd", "/abs/path", "..\\..\\win.ini", "a\tb\nc\u0001d"];

/** Titles with nothing to slug (REQ-DATAEXPORT-17). */
export const EMPTY_SLUG_TITLES = ["", "!!!...???", "🎉🎉"];

/** Two titles that slug to the same string (REQ-DATAEXPORT-17). */
export const COLLIDING_TITLES = ["Resume", "resume!!"] as const;

/** Windows-reserved device names (REQ-DATAEXPORT-17). */
export const WINDOWS_RESERVED = ["CON", "NUL", "COM1"];
export const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A 500+ character title with diacritics and spaces (REQ-DATAEXPORT-18). */
export const LONG_TITLE = "Kỹ sư phần mềm cao cấp ".repeat(25);

export const MAX_SLUG_LENGTH = 60;
export const MAX_PATH_COMPONENT = 255;

/** Upload cap of the documents module (NFR-SEC-11): 10 MB. */
export const TEN_MB = 10 * 1024 * 1024;

export const BULK_DOCUMENT_COUNT = 200;

/** Server-generated filename: export-YYYY-MM-DD.zip, [a-z0-9-.] only. */
export const EXPORT_FILENAME_RE = /^export-\d{4}-\d{2}-\d{2}\.zip$/;

/** The filename(s) acceptable for an export made between `before` and `after` (a run can straddle UTC midnight). */
export function exportFilenames(before: Date, after: Date = new Date()): string[] {
  const day = (d: Date) => `export-${d.toISOString().slice(0, 10)}.zip`;
  return [...new Set([day(before), day(after)])];
}

/** Session token that matches no Session row. */
export const BOGUS_SESSION_COOKIE = "mcv_session=this-token-does-not-exist-anywhere";

/** Delay that keeps the real export response in flight long enough to act on the pending state. */
export const SLOW_EXPORT_MS = 2_000;

/** page.route / network-stub globs (full URL, query string included). */
export const EXPORT_URL_GLOB = "**/api/v1/me/export";
export const AUTH_ME_URL_GLOB = "**/api/v1/auth/me";

/** A server message that must never reach the UI (the client always shows its own i18n copy). */
export const SERVER_ERROR_MARKER = "SERVER_SIDE_EXPORT_FAILURE_MARKER";
