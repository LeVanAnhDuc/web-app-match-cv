import type {
  AiCredentialDto,
  CreateCredentialInput,
  ProviderInfoDto,
  TestResultDto,
  UpdateCredentialInput,
} from "#/types/AiCredentials";
import type { CallOptions } from "./http.client";
import { withOptions, type BaseClient, type Loose } from "./base.client";

// server/src/modules/ai-credentials/ai-credentials.controller.ts. Signed-in only. POST :id/test reaches the provider
// (throttled 10/min): plain API specs hit it only for branches decided before the call (401, bad uuid, 404).
export function createAiCredentialsClient(base: BaseClient) {
  return {
    /** GET /ai-credentials/providers — supported providers and their default models. */
    providers: (options?: CallOptions) =>
      base.request<ProviderInfoDto[]>("GET", "/ai-credentials/providers", options),
    /** GET /ai-credentials */
    list: (options?: CallOptions) => base.request<AiCredentialDto[]>("GET", "/ai-credentials", options),
    /** POST /ai-credentials { provider, label, apiKey, chatModel?, embedModel? } → 201 (409 on a duplicate label). */
    create: (body: Loose<CreateCredentialInput>, options?: CallOptions) =>
      base.request<AiCredentialDto>("POST", "/ai-credentials", withOptions({ data: body }, options)),
    /** PATCH /ai-credentials/:id { label?, apiKey?, chatModel?, embedModel? } — provider is immutable. */
    update: (id: string, body: Loose<UpdateCredentialInput>, options?: CallOptions) =>
      base.request<AiCredentialDto>("PATCH", `/ai-credentials/${id}`, withOptions({ data: body }, options)),
    /** DELETE /ai-credentials/:id → 204. */
    remove: (id: string, options?: CallOptions) => base.request<void>("DELETE", `/ai-credentials/${id}`, options),
    /** POST /ai-credentials/:id/test → 200 TestResultDto. REACHES THE PROVIDER. */
    test: (id: string, options?: CallOptions) =>
      base.request<TestResultDto>("POST", `/ai-credentials/${id}/test`, options),
  };
}
