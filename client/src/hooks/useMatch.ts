import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createMatchRun,
  fetchMatchHistory,
  fetchMatchRun,
  matchRunQueryKey,
  fetchMatchResult,
  matchHistoryQueryKey,
  matchResultQueryKey,
  runMatch
} from "#/requests/match";

/** POST /match — run the hybrid (semantic + keyword) matching engine. */
export function useRunMatch() {
  return useMutation({
    mutationFn: runMatch
  });
}

/** GET /match/:id — fetch a persisted match report (step 4 Result). */
export function useMatchResult(id: string | null) {
  return useQuery({
    queryKey: matchResultQueryKey(id ?? ""),
    queryFn: () => fetchMatchResult(id as string),
    enabled: id !== null
  });
}

/** GET /match — list match history for the current user (Home dashboard). */
export function useMatchHistory() {
  return useQuery({
    queryKey: matchHistoryQueryKey(),
    queryFn: fetchMatchHistory
  });
}

/** POST /match/runs — call once per "Run match" press, before the N matches. */
export function useCreateMatchRun() {
  return useMutation({ mutationFn: createMatchRun });
}

/**
 * GET /match/runs/:id — used on the reload path only. During a live run the
 * cards own their own requests, so there is nothing to poll for.
 */
export function useMatchRun(id: string | null, enabled = true) {
  return useQuery({
    queryKey: matchRunQueryKey(id ?? ""),
    queryFn: () => fetchMatchRun(id as string),
    enabled: id !== null && enabled
  });
}
