import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { AUTH_QUERY_KEY } from "#/requests/auth";
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runMatch,
    // Guest quota changes on success and on a 429 — refresh either way.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    }
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

/**
 * Imperative GET /match/runs/:id for `/wizard?runId=` — the wizard needs the
 * document pair before it can even pick a step, so this is a one-shot read,
 * not a subscription. Shares the key with `useMatchRun`, so step 4 starts warm.
 */
export function useFetchMatchRun() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: string) =>
      queryClient.fetchQuery({
        queryKey: matchRunQueryKey(id),
        queryFn: () => fetchMatchRun(id)
      }),
    [queryClient]
  );
}
