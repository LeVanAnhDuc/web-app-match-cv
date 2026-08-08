import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type { CvComparisonDto } from "#/types/Comparison";

export function comparisonQueryKey(documentId: string, jdDocumentId?: string) {
  return ["comparison", documentId, jdDocumentId ?? null] as const;
}

/**
 * GET /comparisons/:documentId — how much this CV improved over the version it
 * descends from. Read-only: the server never runs a match for this.
 */
export function fetchComparison(
  documentId: string,
  jdDocumentId?: string
): Promise<CvComparisonDto> {
  return apiFetch<CvComparisonDto>(
    ENDPOINTS.comparison(documentId, jdDocumentId)
  );
}
