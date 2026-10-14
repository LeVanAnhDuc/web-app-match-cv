import type { CvComparisonDto } from "#/types/Comparison";
import type { CallOptions } from "./http.client";
import { query, withOptions, type BaseClient } from "./base.client";

// server/src/modules/comparison/comparison.controller.ts. Signed-in only, no AI call. `documentId` is the NEWER
// version; the older side is always its parentId.
export function createComparisonsClient(base: BaseClient) {
  return {
    /** GET /comparisons/:documentId[?jdDocumentId=] */
    get: (documentId: string, params: { jdDocumentId?: string } = {}, options?: CallOptions) =>
      base.request<CvComparisonDto>("GET", `/comparisons/${documentId}`, withOptions({ params: query(params) }, options)),
  };
}
