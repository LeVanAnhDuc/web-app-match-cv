import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type {
  CoverLetterDto,
  GenerateCoverLetterInput,
  UpdateCoverLetterInput
} from "#/types/CoverLetters";

export function coverLettersQueryKey(matchResultId: string) {
  return ["cover-letters", matchResultId] as const;
}

/** GET /cover-letters?matchResultId= — every draft written from one match. */
export function fetchCoverLetters(
  matchResultId: string
): Promise<Array<CoverLetterDto>> {
  return apiFetch<Array<CoverLetterDto>>(
    ENDPOINTS.coverLettersByMatch(matchResultId)
  );
}

/**
 * POST /cover-letters — 201 even when the provider failed; the row then
 * carries status="failed" plus an errorCode.
 */
export function generateCoverLetter(
  input: GenerateCoverLetterInput
): Promise<CoverLetterDto> {
  return apiFetch<CoverLetterDto>(ENDPOINTS.coverLetters, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** PATCH /cover-letters/:id — save an in-place edit. */
export function updateCoverLetter(
  id: string,
  input: UpdateCoverLetterInput
): Promise<CoverLetterDto> {
  return apiFetch<CoverLetterDto>(ENDPOINTS.coverLetterById(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** DELETE /cover-letters/:id */
export function deleteCoverLetter(id: string): Promise<void> {
  return apiFetch<void>(ENDPOINTS.coverLetterById(id), { method: "DELETE" });
}
