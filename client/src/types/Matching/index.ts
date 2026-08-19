// Types mirror the API Contract in docs/specs/cv-jd-matching-wizard/plan.md
// ("API Contract (Plan 2)"). Keep in sync with server DTOs.

import type { AiProvider } from "#/types/AiCredentials";

export interface MatchReport {
  strengths: Array<string>;
  gaps: Array<string>;
  suggestions: Array<string>;
}

export type MatchStatus = "succeeded" | "failed";

/**
 * Closed set mirrored from the server. A failed result never carries the
 * provider's own message — only one of these codes.
 */
export type MatchErrorCode =
  "invalid_key" | "no_quota" | "model_unavailable" | "timeout" | "unreachable";

export interface MatchResultDto {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  report: MatchReport;
  /** null = the match ran on the system key. */
  credentialId: string | null;
  provider: AiProvider;
  chatModel: string;
  embedModel: string;
  /** null for results created before runs existed. */
  runId: string | null;
  status: MatchStatus;
  errorCode: MatchErrorCode | null;
  createdAt: string;
}

export interface MatchRunDto {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  createdAt: string;
}

/** Fewer results than providers chosen is valid — the rest are still running. */
export interface MatchRunDetailDto extends MatchRunDto {
  results: Array<MatchResultDto>;
}

export interface CreateMatchRunInput {
  cvDocumentId: string;
  jdDocumentId: string;
}

export interface CreateMatchInput {
  cvDocumentId: string;
  jdDocumentId: string;
  /** Omit to run on the system key. */
  credentialId?: string;
  /** Groups this result with the other providers of the same run. */
  runId?: string;
}

export interface MatchSummaryDto {
  id: string;
  cvTitle: string;
  jdTitle: string;
  overallScore: number;
  createdAt: string;
}
