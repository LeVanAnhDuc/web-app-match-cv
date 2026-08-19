// Mirrors server/src/modules/cv-rewrite/dto/*. Keep in sync with the BE DTOs.

import type { AiProvider } from "#/types/AiCredentials";

/**
 * One proposed edit, ANCHORED to an excerpt that already exists in the CV.
 * The server drops anything it cannot anchor, so every change that reaches the
 * client can be shown next to the real text it would replace (ADR #13).
 */
export interface CvRewriteChange {
  /** Stable only within one proposal — proposals are never persisted. */
  id: string;
  /** Display grouping only; it takes part in no check. */
  sectionHint: string | null;
  original: string;
  /** Empty string means: remove the excerpt. */
  replacement: string;
  rationale: string;
  addressesGap: string | null;
}

export interface CvRewriteProposalDto {
  matchResultId: string;
  cvDocumentId: string;
  cvTitle: string;
  provider: AiProvider;
  chatModel: string;
  changes: Array<CvRewriteChange>;
  /** Gaps that would need real new experience — reported, never invented. */
  unaddressedGaps: Array<string>;
}

export interface GenerateCvRewriteInput {
  matchResultId: string;
  /** Omit to run on the system key. */
  credentialId?: string;
}

export interface AcceptCvRewriteInput {
  matchResultId: string;
  title: string;
  /** Only the changes the user ticked. */
  changes: Array<{ original: string; replacement: string }>;
}
