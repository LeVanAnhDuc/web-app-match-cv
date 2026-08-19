import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type {
  AiCredentialDto,
  CreateCredentialInput,
  ProviderInfoDto,
  TestResultDto,
  UpdateCredentialInput
} from "#/types/AiCredentials";

export function aiCredentialsQueryKey() {
  return ["ai-credentials"] as const;
}

export function aiProvidersQueryKey() {
  return ["ai-credentials", "providers"] as const;
}

/** GET /ai-credentials — the current user's credentials, newest first. */
export function fetchAiCredentials(): Promise<Array<AiCredentialDto>> {
  return apiFetch<Array<AiCredentialDto>>(ENDPOINTS.aiCredentials);
}

/** GET /ai-credentials/providers — whitelist plus each provider's default models. */
export function fetchAiProviders(): Promise<Array<ProviderInfoDto>> {
  return apiFetch<Array<ProviderInfoDto>>(ENDPOINTS.aiProviders);
}

/** POST /ai-credentials — store a new key (encrypted server-side). */
export function createAiCredential(
  input: CreateCredentialInput
): Promise<AiCredentialDto> {
  return apiFetch<AiCredentialDto>(ENDPOINTS.aiCredentials, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** PATCH /ai-credentials/:id — rename, change models, or rotate the key. */
export function updateAiCredential(
  id: string,
  input: UpdateCredentialInput
): Promise<AiCredentialDto> {
  return apiFetch<AiCredentialDto>(ENDPOINTS.aiCredentialById(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** DELETE /ai-credentials/:id — past matches keep their provider snapshot. */
export function deleteAiCredential(id: string): Promise<void> {
  return apiFetch<void>(ENDPOINTS.aiCredentialById(id), { method: "DELETE" });
}

/** POST /ai-credentials/:id/test — ping chat and embeddings with the stored key. */
export function testAiCredential(id: string): Promise<TestResultDto> {
  return apiFetch<TestResultDto>(ENDPOINTS.aiCredentialTest(id), {
    method: "POST"
  });
}
