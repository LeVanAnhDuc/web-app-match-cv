import { apiFetch, apiFetchBinary } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type {
  CreateDocumentInput,
  DocumentDto,
  DocumentKind,
  DocumentSummaryDto
} from "#/types/Documents";

export function savedDocumentsQueryKey(kind: DocumentKind) {
  return ["documents", kind, "saved"] as const;
}

export function documentQueryKey(id: string) {
  return ["documents", id] as const;
}

/** GET /documents/:id — fetch rawText for the wizard's step 3 Review prefill. */
export function fetchDocument(id: string): Promise<DocumentDto> {
  return apiFetch<DocumentDto>(ENDPOINTS.documentById(id));
}

/** GET /documents?kind=..&saved=true — reuse list for the wizard's radio picker. */
export function fetchSavedDocuments(
  kind: DocumentKind
): Promise<Array<DocumentSummaryDto>> {
  return apiFetch<Array<DocumentSummaryDto>>(ENDPOINTS.savedDocuments(kind));
}

/** POST /documents — upload/paste a new document (JD or CV). */
export function createDocument(
  input: CreateDocumentInput
): Promise<DocumentDto> {
  if (input.mode === "file") {
    const formData = new FormData();
    formData.append("file", input.file);
    formData.append("kind", input.kind);
    formData.append("save", String(input.save));
    if (input.title) formData.append("title", input.title);

    return apiFetch<DocumentDto>(ENDPOINTS.documents, {
      method: "POST",
      body: formData
    });
  }

  return apiFetch<DocumentDto>(ENDPOINTS.documents, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      sourceText: input.sourceText,
      save: input.save,
      title: input.title
    })
  });
}

/** Builds the full URL for `GET /documents/:id/file` (inline preview or `<a download>`). */
export function documentFileUrl(id: string, download = false): string {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "http://localhost:5200/api/v1";
  return `${base}${ENDPOINTS.documentFile(id, download)}`;
}

/** PATCH /documents/:id — rename a saved document. */
export function renameDocument(
  id: string,
  title: string
): Promise<DocumentDto> {
  return apiFetch<DocumentDto>(ENDPOINTS.documentById(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
}

/**
 * PATCH /documents/:id/parent — declare (or clear, with null) which document
 * this one is a newer version of. A sub-resource of its own so the rename
 * contract above stays untouched.
 */
export function setDocumentParent(
  id: string,
  parentId: string | null
): Promise<DocumentDto> {
  return apiFetch<DocumentDto>(ENDPOINTS.documentParent(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId })
  });
}

/** DELETE /documents/:id — 204 on success, 409 when still referenced by a match. */
export function deleteDocument(id: string): Promise<void> {
  return apiFetch<void>(ENDPOINTS.documentById(id), { method: "DELETE" });
}

/**
 * GET /documents/:id/file — fetch the original file bytes for client-side
 * preview. Routed through `apiFetchBinary` (not a raw `fetch`) so base URL,
 * error handling, and credentials policy stay centralised in `#/libs/api`.
 */
export function fetchDocumentFile(id: string): Promise<ArrayBuffer> {
  return apiFetchBinary(ENDPOINTS.documentFile(id));
}
