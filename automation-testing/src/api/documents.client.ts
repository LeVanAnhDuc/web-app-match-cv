import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import type { DocumentDto, DocumentKind, DocumentSummaryDto } from "#/types/Documents";
import type { CallOptions } from "./http.client";
import { query, withOptions, type BaseClient, type FilePart, type Loose } from "./base.client";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MIME_BY_EXT: Record<string, string> = { ".pdf": PDF_MIME, ".docx": DOCX_MIME, ".txt": "text/plain" };

/** A path on disk becomes a multipart file part (mime from the extension); a FilePart passes through untouched. */
export function filePart(file: string | FilePart): FilePart {
  if (typeof file !== "string") return file;
  return {
    name: basename(file),
    mimeType: MIME_BY_EXT[extname(file).toLowerCase()] ?? "application/octet-stream",
    buffer: readFileSync(file),
  };
}

export interface PasteDocumentInput {
  kind: DocumentKind;
  save: boolean;
  title?: string;
  sourceText: string;
}

export interface UploadDocumentInput {
  kind: DocumentKind | string;
  save: boolean | string;
  title?: string;
  /** Path on disk (e.g. FILES.pdf from @/data/test-data) or an in-memory part (wrong mime, oversize buffer…). */
  file?: string | FilePart;
  /** Also sent as a form field, to test "file AND text" or "text via multipart". */
  sourceText?: string;
}

// server/src/modules/documents/documents.controller.ts. POST / GET :id / GET :id/file are @AllowGuest (an anonymous
// POST mints a guest and answers Set-Cookie mcv_session); list, rename, setParent, remove need a signed-in user.
export function createDocumentsClient(base: BaseClient) {
  return {
    /** POST /documents (JSON) — pasted text. 201 DocumentDto. */
    create: (body: Loose<PasteDocumentInput>, options?: CallOptions) =>
      base.request<DocumentDto>("POST", "/documents", withOptions({ data: body }, options)),
    /** POST /documents (multipart, field `file`) — PDF/DOCX up to 10 MB. 201 DocumentDto. */
    upload: (input: UploadDocumentInput, options?: CallOptions) => {
      const multipart: NonNullable<CallOptions["multipart"]> = {
        kind: String(input.kind),
        save: String(input.save),
      };
      if (input.title !== undefined) multipart.title = input.title;
      if (input.sourceText !== undefined) multipart.sourceText = input.sourceText;
      if (input.file !== undefined) multipart.file = filePart(input.file);
      return base.request<DocumentDto>("POST", "/documents", withOptions({ multipart }, options));
    },
    /** GET /documents?kind=&saved= — the caller's documents. */
    list: (params: { kind?: DocumentKind | string; saved?: boolean | string } = {}, options?: CallOptions) =>
      base.request<DocumentSummaryDto[]>("GET", "/documents", withOptions({ params: query(params) }, options)),
    /** GET /documents/:id */
    get: (id: string, options?: CallOptions) => base.request<DocumentDto>("GET", `/documents/${id}`, options),
    /** PATCH /documents/:id { title } — rename (trimmed, required). A string is sent as { title }. */
    rename: (id: string, body: Loose<{ title: string }> | string, options?: CallOptions) =>
      base.request<DocumentDto>(
        "PATCH",
        `/documents/${id}`,
        withOptions({ data: typeof body === "string" ? { title: body } : body }, options)
      ),
    /** PATCH /documents/:id/parent { parentId } — set (uuid) or clear (null) the lineage. */
    setParent: (id: string, parentId: string | null | Loose<{ parentId: string | null }>, options?: CallOptions) =>
      base.request<DocumentDto>(
        "PATCH",
        `/documents/${id}/parent`,
        withOptions({ data: parentId === null || typeof parentId === "string" ? { parentId } : parentId }, options)
      ),
    /** DELETE /documents/:id → 204. */
    remove: (id: string, options?: CallOptions) => base.request<void>("DELETE", `/documents/${id}`, options),
    /** GET /documents/:id/file[?download=1] — original bytes (inline, or attachment with download). Read `raw`. */
    file: (id: string, params: { download?: boolean | string } = {}, options?: CallOptions) => {
      const download = params.download === true ? "1" : params.download === false ? undefined : params.download;
      return base.request<Buffer>("GET", `/documents/${id}/file`, withOptions({ params: query({ download }) }, options));
    },
  };
}
