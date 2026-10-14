import { join } from "node:path";

// Constants and generators shared by several modules. No .env, no network: values only.
// A value only one module uses belongs in test-data/<module>.ts instead.

// Unique per call so parallel tests never collide on the same address.
export function randomEmail(prefix = "qa"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Unique suffix for titles / labels a test creates, so leftovers of a crashed run never collide. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Sample uploads in src/data/files/ (absolute paths, ready for documents.upload / setInputFiles). */
export const FILES = {
  pdf: join(__dirname, "..", "files", "sample.pdf"),
  docx: join(__dirname, "..", "files", "sample.docx"),
} as const;
