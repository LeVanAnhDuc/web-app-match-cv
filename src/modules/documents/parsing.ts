import { BadRequestException } from '@nestjs/common';
import { SourceFormat } from '@prisma/client';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { tDoc } from './i18n-messages';

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface ParsedFile {
  rawText: string;
  sourceFormat: SourceFormat;
}

// Hardening (security review): the 10MB upload cap only bounds the COMPRESSED
// bytes. A crafted small PDF/DOCX (zip bomb, pathological structure) can still
// exhaust CPU/memory during parsing. Bound parse wall-time and the extracted
// text size as a proportionate mitigation. (Full isolation via a worker thread
// is a future hardening — noted in security-report.md.)
const PARSE_TIMEOUT_MS = 15_000;
const MAX_EXTRACTED_CHARS = 2_000_000; // ~2MB of text

function parseFailedError(): BadRequestException {
  return new BadRequestException(
    tDoc(
      'documents.errors.parseFailed',
      'Could not read the uploaded file. Make sure it is a valid PDF or DOCX.',
    ),
  );
}

async function withParseTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(parseFailedError()), PARSE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function capExtracted(rawText: string): string {
  if (rawText.length > MAX_EXTRACTED_CHARS) throw parseFailedError();
  return rawText;
}

async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ pageJoiner: '' });
    const rawText = capExtracted(result.text.trim());
    if (!rawText) throw parseFailedError();
    return { rawText, sourceFormat: SourceFormat.pdf };
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw parseFailedError();
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<ParsedFile> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const rawText = capExtracted(result.value.trim());
    if (!rawText) throw parseFailedError();
    return { rawText, sourceFormat: SourceFormat.docx };
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw parseFailedError();
  }
}

/**
 * Parse an uploaded file buffer into raw text. Only PDF and DOCX mimetypes
 * are supported — the caller (ParseFilePipe) is expected to have already
 * rejected other mimetypes, but this is a defensive second check.
 */
export async function parseFile(
  buffer: Buffer,
  mimetype: string,
): Promise<ParsedFile> {
  if (mimetype === PDF_MIME) return withParseTimeout(parsePdf(buffer));
  if (mimetype === DOCX_MIME) return withParseTimeout(parseDocx(buffer));
  throw new BadRequestException(
    tDoc(
      'documents.errors.unsupportedFileType',
      'Unsupported file type. Only PDF and DOCX are allowed.',
    ),
  );
}
