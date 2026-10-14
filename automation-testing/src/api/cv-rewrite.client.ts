import type { AcceptCvRewriteInput, CvRewriteProposalDto, GenerateCvRewriteInput } from "#/types/CvRewrite";
import type { DocumentDto } from "#/types/Documents";
import type { CallOptions } from "./http.client";
import { withOptions, type BaseClient, type Loose } from "./base.client";

// server/src/modules/cv-rewrite/cv-rewrite.controller.ts. Signed-in only. generate reaches the provider (10/min);
// accept calls no provider (20/min) and writes a new CV version whose parentId is the original.
export function createCvRewriteClient(base: BaseClient) {
  return {
    /** POST /cv-rewrite { matchResultId, credentialId? } → 201 proposal (never persisted). REACHES THE PROVIDER. */
    generate: (body: Loose<GenerateCvRewriteInput>, options?: CallOptions) =>
      base.request<CvRewriteProposalDto>("POST", "/cv-rewrite", withOptions({ data: body }, options)),
    /** POST /cv-rewrite/accept { matchResultId, title, changes: [{ original, replacement }] } → 201 new DocumentDto. */
    accept: (body: Loose<AcceptCvRewriteInput>, options?: CallOptions) =>
      base.request<DocumentDto>("POST", "/cv-rewrite/accept", withOptions({ data: body }, options)),
  };
}
