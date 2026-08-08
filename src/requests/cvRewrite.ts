import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type { DocumentDto } from "#/types/Documents";
import type {
  AcceptCvRewriteInput,
  CvRewriteProposalDto,
  GenerateCvRewriteInput
} from "#/types/CvRewrite";

// No query-key factory here on purpose: a proposal is never persisted server
// side (ADR #13), so there is nothing to cache or refetch — both calls are
// mutations.

/** POST /cv-rewrite — ask for edits that close this match's gaps. */
export function generateCvRewrite(
  input: GenerateCvRewriteInput
): Promise<CvRewriteProposalDto> {
  return apiFetch<CvRewriteProposalDto>(ENDPOINTS.cvRewrite, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** POST /cv-rewrite/accept — save the approved subset as a NEW CV document. */
export function acceptCvRewrite(
  input: AcceptCvRewriteInput
): Promise<DocumentDto> {
  return apiFetch<DocumentDto>(ENDPOINTS.cvRewriteAccept, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
