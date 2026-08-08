// Mirrors the server DTOs in server/src/modules/comparison/dto/. Keep in sync.

import type { AiProvider } from "#/types/AiCredentials";

export interface DocumentVersion {
  id: string;
  title: string;
  /** 1 for an original, 2 for its rewrite. Derived from the parentId chain. */
  version: number;
  createdAt: string;
}

export interface ComparisonJdOption {
  id: string;
  title: string;
  hasBase: boolean;
  hasRevision: boolean;
}

export interface ComparisonSide {
  matchResultId: string;
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  provider: AiProvider;
  chatModel: string;
  embedModel: string;
  gaps: Array<string>;
  createdAt: string;
}

/** Signed — negative means the score dropped. */
export interface ScoreDelta {
  overall: number;
  semantic: number;
  keyword: number;
}

export interface GapPair {
  base: string;
  revision: string;
}

export interface GapDiff {
  closed: Array<string>;
  /** Still open. Both wordings are kept, because the rephrasing is a signal. */
  persisted: Array<GapPair>;
  introduced: Array<string>;
}

/**
 * `delta` and `gapDiff` are null together, and only when both versions have a
 * succeeded match on the selected JD. They are never zero-filled: zeroes would
 * read as "no improvement", which is a different claim from "not matched yet".
 */
export interface CvComparisonDto {
  base: DocumentVersion;
  revision: DocumentVersion;
  jdDocumentId: string | null;
  jdOptions: Array<ComparisonJdOption>;
  baseResult: ComparisonSide | null;
  revisionResult: ComparisonSide | null;
  delta: ScoreDelta | null;
  gapDiff: GapDiff | null;
  /** false = the two reports came from different chat models. */
  sameChatModel: boolean;
  /** false = the two semantic scores come from different embedding spaces. */
  sameEmbedModel: boolean;
}
