import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type {
  CreateMatchInput,
  CreateMatchRunInput,
  MatchResultDto,
  MatchRunDetailDto,
  MatchRunDto,
  MatchSummaryDto
} from "#/types/Matching";

export function matchResultQueryKey(id: string) {
  return ["match", id] as const;
}

export function matchRunQueryKey(id: string) {
  return ["match", "run", id] as const;
}

export function matchHistoryQueryKey() {
  return ["match", "history"] as const;
}

/** POST /match — run the hybrid (semantic + keyword) matching engine. */
export function runMatch(input: CreateMatchInput): Promise<MatchResultDto> {
  return apiFetch<MatchResultDto>(ENDPOINTS.match, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** GET /match/:id — fetch a persisted match report (step 4 Result). */
export function fetchMatchResult(id: string): Promise<MatchResultDto> {
  return apiFetch<MatchResultDto>(ENDPOINTS.matchById(id));
}

/** GET /match — list match history for the current user, newest-first. */
export function fetchMatchHistory(): Promise<Array<MatchSummaryDto>> {
  return apiFetch<Array<MatchSummaryDto>>(ENDPOINTS.matchHistory);
}

/** POST /match/runs — open a run before firing one request per provider. */
export function createMatchRun(
  input: CreateMatchRunInput
): Promise<MatchRunDto> {
  return apiFetch<MatchRunDto>(ENDPOINTS.matchRuns, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** GET /match/runs/:id — the run plus whatever results have landed so far. */
export function fetchMatchRun(id: string): Promise<MatchRunDetailDto> {
  return apiFetch<MatchRunDetailDto>(ENDPOINTS.matchRunById(id));
}
