// Mirrors the server DTOs in server/src/modules/cover-letters/dto/.
// See docs/specs/cover-letter-generator/design.md §6 for the contract table.

import type { AiProvider } from "#/types/AiCredentials";
import type { MatchErrorCode, MatchStatus } from "#/types/Matching";

export type CoverLetterTone = "formal" | "friendly";
export type CoverLetterLength = "short" | "standard";
/** Language the LETTER is written in — independent of the UI language. */
export type CoverLetterLanguage = "en" | "vi";

export interface CoverLetterDto {
  id: string;
  matchResultId: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  language: CoverLetterLanguage;
  /** Plain text. Empty when status is "failed". */
  content: string;
  /**
   * Job requirements the model declined to claim because the CV does not
   * support them. Surfacing this is how the ADR #13 grounding rule becomes
   * something the user can check.
   */
  omittedRequirements: Array<string>;
  status: MatchStatus;
  errorCode: MatchErrorCode | null;
  /** True once the user edited the draft by hand. */
  edited: boolean;
  /** null = the letter ran on the system key. */
  credentialId: string | null;
  provider: AiProvider;
  chatModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateCoverLetterInput {
  matchResultId: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  language: CoverLetterLanguage;
  /** Omit to run on the system key. */
  credentialId?: string;
}

export interface UpdateCoverLetterInput {
  content: string;
}
