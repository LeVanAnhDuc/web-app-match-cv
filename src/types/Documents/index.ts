// Types mirror the API Contract in docs/specs/cv-jd-matching-wizard/plan.md
// ("API Contract (BE DTO ↔ FE type)"). Keep in sync with server DTOs.

export type DocumentKind = "CV" | "JD";
export type SourceFormat = "pdf" | "docx" | "text";

export interface DocumentDto {
  id: string;
  kind: DocumentKind;
  title: string;
  sourceFormat: SourceFormat;
  rawText: string;
  isSaved: boolean;
  /** Lineage: the document this one is a rewritten version of. */
  parentId: string | null;
  createdAt: string;
}

export interface DocumentSummaryDto {
  id: string;
  kind: DocumentKind;
  title: string;
  sourceFormat: SourceFormat;
  createdAt: string;
}

interface CreateDocumentBase {
  kind: DocumentKind;
  save: boolean;
  title?: string;
}

export interface CreateDocumentFileInput extends CreateDocumentBase {
  mode: "file";
  file: File;
}

export interface CreateDocumentPasteInput extends CreateDocumentBase {
  mode: "paste";
  sourceText: string;
}

export type CreateDocumentInput =
  CreateDocumentFileInput | CreateDocumentPasteInput;
