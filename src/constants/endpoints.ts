import type { DocumentKind } from "#/types/Documents";

/** API endpoint paths (relative to `VITE_API_BASE_URL`). Never hard-code these in callers. */
export const ENDPOINTS = {
  documents: "/documents",
  documentById: (id: string) => `/documents/${id}`,
  savedDocuments: (kind: DocumentKind) => `/documents?kind=${kind}&saved=true`,
  documentFile: (id: string, download?: boolean) =>
    `/documents/${encodeURIComponent(id)}/file${download ? "?download=1" : ""}`,
  match: "/match",
  matchById: (id: string) => `/match/${id}`,
  matchHistory: "/match",
  matchRuns: "/match/runs",
  matchRunById: (id: string) => `/match/runs/${encodeURIComponent(id)}`,
  aiCredentials: "/ai-credentials",
  aiCredentialById: (id: string) => `/ai-credentials/${encodeURIComponent(id)}`,
  aiCredentialTest: (id: string) =>
    `/ai-credentials/${encodeURIComponent(id)}/test`,
  aiProviders: "/ai-credentials/providers",
  cvRewrite: "/cv-rewrite",
  cvRewriteAccept: "/cv-rewrite/accept"
} as const;
