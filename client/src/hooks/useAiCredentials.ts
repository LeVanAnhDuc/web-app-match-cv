import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aiCredentialsQueryKey,
  aiProvidersQueryKey,
  createAiCredential,
  deleteAiCredential,
  fetchAiCredentials,
  fetchAiProviders,
  testAiCredential,
  updateAiCredential
} from "#/requests/aiCredentials";
import type { UpdateCredentialInput } from "#/types/AiCredentials";

/** GET /ai-credentials — list for the credentials page and the wizard selector. */
export function useAiCredentials() {
  return useQuery({
    queryKey: aiCredentialsQueryKey(),
    queryFn: fetchAiCredentials
  });
}

/** GET /ai-credentials/providers — a static whitelist, so never refetch it. */
export function useProviders() {
  return useQuery({
    queryKey: aiProvidersQueryKey(),
    queryFn: fetchAiProviders,
    staleTime: Infinity
  });
}

export function useCreateCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAiCredential,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}

export function useUpdateCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCredentialInput }) =>
      updateAiCredential(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}

export function useDeleteCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAiCredential,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}

/** POST /ai-credentials/:id/test — refreshes the list so the stored verdict updates. */
export function useTestCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testAiCredential,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}
