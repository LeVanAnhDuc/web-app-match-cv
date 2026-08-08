import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  coverLettersQueryKey,
  deleteCoverLetter,
  fetchCoverLetters,
  generateCoverLetter,
  updateCoverLetter
} from "#/requests/coverLetters";
import type { UpdateCoverLetterInput } from "#/types/CoverLetters";

/** GET /cover-letters?matchResultId= — the drafts written from one match. */
export function useCoverLetters(matchResultId: string | null, enabled = true) {
  return useQuery({
    queryKey: coverLettersQueryKey(matchResultId ?? ""),
    queryFn: () => fetchCoverLetters(matchResultId as string),
    enabled: matchResultId !== null && enabled
  });
}

/** POST /cover-letters — every generation is stored, failures included. */
export function useGenerateCoverLetter(matchResultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateCoverLetter,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: coverLettersQueryKey(matchResultId)
      })
  });
}

export function useUpdateCoverLetter(matchResultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input
    }: {
      id: string;
      input: UpdateCoverLetterInput;
    }) => updateCoverLetter(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: coverLettersQueryKey(matchResultId)
      })
  });
}

export function useDeleteCoverLetter(matchResultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCoverLetter,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: coverLettersQueryKey(matchResultId)
      })
  });
}
