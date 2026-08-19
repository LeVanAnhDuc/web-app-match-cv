import { useMutation, useQueryClient } from "@tanstack/react-query";
import { acceptCvRewrite, generateCvRewrite } from "#/requests/cvRewrite";
import { savedDocumentsQueryKey } from "#/requests/documents";

/** POST /cv-rewrite — one chat call on the chosen key, so never automatic. */
export function useGenerateCvRewrite() {
  return useMutation({ mutationFn: generateCvRewrite });
}

/** POST /cv-rewrite/accept — creates a new saved CV, so the library is stale. */
export function useAcceptCvRewrite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptCvRewrite,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedDocumentsQueryKey("CV") })
  });
}
