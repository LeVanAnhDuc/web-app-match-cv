import AdmZip from "adm-zip";
import { readFileSync } from "node:fs";
import type { MatchErrorCode, MatchResultDto } from "#/types/Matching";
import { FILES } from "./shared";

// Values of module cv-jd-matching-wizard: pasted CV/JD texts, the AI stub bodies (D1: UI specs stub POST /match),
// file builders for the upload boundaries and the Vietnamese pairs of the @live-ai specs.

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** client/src/constants/fileConstraints.ts and documents.controller.ts: 10 MB = 10 485 760 bytes. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** The `{{max}}` the client passes to dropzone.hint / err.fileSize (FILE.MAX_SIZE_LABEL). */
export const MAX_UPLOAD_LABEL = "10MB";
/** CreateDocumentDto: @MaxLength(100_000) on sourceText, @MaxLength(200) on title. */
export const MAX_SOURCE_TEXT = 100_000;
export const MAX_TITLE = 200;
/** documents.service.ts deriveTitle: first non-empty line, cut at 80 chars + "…". */
export const DERIVED_TITLE_LENGTH = 80;
/** parsing.ts MAX_EXTRACTED_CHARS. */
export const MAX_EXTRACTED_CHARS = 2_000_000;

export const JD_TEXT = "We are hiring a senior backend engineer with NestJS and PostgreSQL experience.";
export const CV_TEXT = "Senior backend engineer, 6 years of Node.js, NestJS and PostgreSQL in production.";
export const OTHER_JD_TEXT = "Frontend developer wanted: React, TypeScript and accessibility testing.";

/** Unique text so a test can find exactly its own document on screen and in lists. */
export function uniqueText(label: string): string {
  return `${label} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A succeeded MatchResultDto for the POST /match stub. Ids are placeholders: the card renders the stub as-is. */
export function matchResultStub(overrides: Partial<MatchResultDto> = {}): MatchResultDto {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    cvDocumentId: "00000000-0000-4000-8000-000000000002",
    jdDocumentId: "00000000-0000-4000-8000-000000000003",
    overallScore: 82,
    semanticScore: 90,
    keywordScore: 70,
    report: {
      strengths: ["Strong backend engineering background", "Solid NestJS fundamentals"],
      gaps: ["No direct GraphQL experience mentioned"],
      suggestions: ["Highlight API design work with concrete, quantified impact."],
    },
    credentialId: null,
    runId: null,
    status: "succeeded",
    errorCode: null,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    embedModel: "openai/text-embedding-3-small",
    createdAt: "2026-10-14T00:00:00.000Z",
    ...overrides,
  };
}

/** A failed result as the server stores a provider error: 201, status failed, zero scores, empty report. */
export function failedMatchStub(errorCode: MatchErrorCode): MatchResultDto {
  return matchResultStub({
    status: "failed",
    errorCode,
    overallScore: 0,
    semanticScore: 0,
    keywordScore: 0,
    report: { strengths: [], gaps: [], suggestions: [] },
  });
}

/** Glob of the AI endpoint the UI specs stub (fixture `network`, method POST only). */
export const MATCH_URL = "**/api/v1/match";
export const MATCH_RUNS_URL = "**/api/v1/match/runs";
export const DOCUMENTS_URL = /\/api\/v1\/documents(\?.*)?$/;

// ── files ───────────────────────────────────────────────────────────────────
export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** In-memory file of `size` bytes (the client only checks name + size, never content). */
export function blankFile(name: string, mimeType: string, size: number): FilePayload {
  return { name, mimeType, buffer: Buffer.alloc(size, 0x61) };
}

/** Bytes that are not a PDF at all, sent as application/pdf. */
export function corruptPdf(name = "broken.pdf"): FilePayload {
  return { name, mimeType: PDF_MIME, buffer: Buffer.from("this is not a pdf document") };
}

/** The sample PDF renamed (e.g. upper-case extension). */
export function samplePdfAs(name: string): FilePayload {
  return { name, mimeType: PDF_MIME, buffer: readFileSync(FILES.pdf) };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function documentXml(paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}</w:body></w:document>`
  );
}

/** sample.docx with its body replaced by `paragraphs` (an empty list = a DOCX with no readable text). */
export function docxWithText(paragraphs: string[], name = "generated.docx"): FilePayload {
  const zip = new AdmZip(FILES.docx);
  zip.updateFile("word/document.xml", Buffer.from(documentXml(paragraphs), "utf8"));
  return { name, mimeType: DOCX_MIME, buffer: zip.toBuffer() };
}

/** A DOCX whose extracted text is longer than the server's 2 000 000-char ceiling (compresses to a few KB). */
export function docxOverExtractCeiling(): FilePayload {
  const word = "lorem ";
  const text = word.repeat(Math.ceil((MAX_EXTRACTED_CHARS + 1_000) / word.length));
  return docxWithText([text], "huge-text.docx");
}

/** Deterministic filler (xorshift32), stored uncompressed so the zip grows by exactly as many bytes. */
function filler(size: number): Buffer {
  const out = Buffer.alloc(size);
  let x = 0x2f6b9d3;
  for (let i = 0; i < size; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

/**
 * A real, parseable DOCX of EXACTLY `bytes` bytes: sample.docx plus a padding part. Converges in a few rounds
 * because the zip size grows linearly with the padding.
 */
export function docxOfExactSize(bytes: number, name = "exact-size.docx"): FilePayload {
  const build = (pad: number) => {
    const zip = new AdmZip(FILES.docx);
    zip.addFile("customXml/padding.bin", filler(pad));
    const entry = zip.getEntry("customXml/padding.bin");
    if (entry) entry.header.method = 0; // STORED
    return zip.toBuffer();
  };
  const base = build(0).length;
  let pad = Math.max(0, bytes - base);
  for (let round = 0; round < 12; round++) {
    const buffer = build(pad);
    if (buffer.length === bytes) return { name, mimeType: DOCX_MIME, buffer };
    pad = Math.max(0, pad + (bytes - buffer.length));
  }
  throw new Error(`docxOfExactSize: could not hit ${bytes} bytes`);
}

// ── @live-ai pairs (FR-11) ──────────────────────────────────────────────────
/** CV and JD with Vietnamese diacritics. */
export const VI_CV = "Kỹ sư phần mềm với 5 năm kinh nghiệm phát triển ứng dụng web, thành thạo NestJS, PostgreSQL và Docker; đã dẫn dắt đội ngũ bốn người.";
export const VI_JD_ACCENTED = "Tuyển kỹ sư phần mềm có kinh nghiệm phát triển ứng dụng web với NestJS, PostgreSQL, Docker; ưu tiên ứng viên từng dẫn dắt đội ngũ.";
/** The same JD typed without diacritics (đ → d). */
export const VI_JD_PLAIN = VI_JD_ACCENTED.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D");

export const EN_CV = "Backend engineer: TypeScript, NestJS, PostgreSQL, Docker, REST API design, unit testing, CI pipelines.";
export const EN_JD = "We need a backend engineer skilled in TypeScript, NestJS and PostgreSQL, with Docker and REST API design.";
