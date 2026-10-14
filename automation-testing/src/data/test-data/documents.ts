import { readFileSync } from "node:fs";
import { FILES, uniqueSuffix } from "./shared";

// Values of module "documents" (FR-02 save/isolation · FR-07 /cv + /jd library). Values only: no network, no .env.

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Text the sample files in data/files/ parse to (server pdf-parse / mammoth). */
export const SAMPLE_TEXT = { pdf: "Hello matchcv PDF", docx: "Apple" } as const;

/** Bytes of the sample files, to compare against GET /documents/:id/file. */
export const sampleBytes = (kind: keyof typeof FILES): Buffer => readFileSync(FILES[kind]);

/** A unique, readable title so leftovers of a crashed run never collide. */
export const docTitle = (label: string): string => `${label} ${uniqueSuffix()}`;

/** Pasted text that is clearly a CV / JD, with a unique marker line. */
export const docText = (kind: "CV" | "JD", marker = uniqueSuffix()): string =>
  kind === "CV"
    ? `Experienced software engineer ${marker}\nTypeScript, NestJS, PostgreSQL`
    : `We are hiring a Senior Backend Engineer ${marker}\nRequirements: NestJS, PostgreSQL`;

/** Title/length limits (create-document.dto.ts, update-document.dto.ts, documents.service.ts). */
export const LIMITS = {
  title: 200,
  sourceText: 100_000,
  fileBytes: 10 * 1024 * 1024,
  derivedTitle: 80,
  filename: 100,
} as const;

export const repeat = (n: number, ch = "a"): string => ch.repeat(n);

/** Header-injection attempt in a title (security-report home-dashboard-library). */
export const EVIL_TITLE = 'evil";x=1\r\nSet-Cookie: a';
export const EVIL_TITLE_FILENAME = "evil_x_1_Set-Cookie_a.pdf";

/** Vietnamese title with diacritics (Q6 / BUG-DOCUMENTS-05). */
export const VI_TITLE = "Sơ yếu Lý lịch";
/** RFC 5987 form a client needs to restore the original name. */
export const viTitleFilenameStar = (ext: "pdf" | "docx"): string =>
  `filename*=UTF-8''${encodeURIComponent(`${VI_TITLE}.${ext}`)}`;

/** Pasted text that would be markup if the preview rendered it as HTML. */
export const HTML_TEXT = '<b id="injected">bold?</b> <img src=x onerror="window.__xss=1"> plain line';

/** A random but well-formed uuid that no row has. */
export const MISSING_ID = "00000000-0000-4000-8000-000000000001";

/**
 * A minimal, valid multi-page PDF (Helvetica text "Page N" on each page), built byte-exact with a correct xref so
 * pdf.js renders every page. Used to prove the preview shows ALL pages (REQ-DOCUMENTS-35).
 */
export function multiPagePdf(pages: number): Buffer {
  const objects: string[] = [];
  // 1 catalog · 2 pages · 3 font · then per page: page object + content stream
  const pageIds = Array.from({ length: pages }, (_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pageIds.forEach((id, i) => {
    const stream = `BT /F1 24 Tf 40 120 Td (Page ${i + 1}) Tj ET`;
    objects[id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents ${id + 1} 0 R ` +
      "/Resources << /Font << /F1 3 0 R >> >> >>";
    objects[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Text a multi-page PDF row carries in rawText (seeded directly, the server never parses it). */
export const multiPageText = (pages: number): string =>
  Array.from({ length: pages }, (_, i) => `Page ${i + 1}`).join("\n");
