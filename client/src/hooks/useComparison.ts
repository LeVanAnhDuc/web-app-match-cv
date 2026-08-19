import { useQuery } from "@tanstack/react-query";
import { comparisonQueryKey, fetchComparison } from "#/requests/comparison";

/**
 * GET /comparisons/:documentId — the score delta and gap diff between a CV and
 * the version it descends from, on one JD.
 *
 * A plain query and nothing more: opening a comparison must never trigger a
 * match (docs/specs/cv-version-comparison/design.md §2).
 */
export function useComparison(
  documentId: string | null,
  jdDocumentId?: string
) {
  return useQuery({
    queryKey: comparisonQueryKey(documentId ?? "", jdDocumentId),
    queryFn: () => fetchComparison(documentId as string, jdDocumentId),
    enabled: documentId !== null,
    retry: false
  });
}
