// Mirrors server/src/modules/ai-credentials/dto/*. Keep in sync with the BE DTOs.

export type AiProvider = "openrouter" | "openai" | "gemini";

export type AiTestStatus =
  | "ok"
  | "invalid_key"
  | "no_quota"
  | "model_unavailable"
  /** Answered too slowly — distinct from "not there at all". */
  | "timeout"
  | "unreachable";

export interface AiCredentialDto {
  id: string;
  provider: AiProvider;
  label: string;
  /** Last 4 characters only — the full key never reaches the client. */
  keyLast4: string;
  /** null = use the provider default. */
  chatModel: string | null;
  /** null = use the provider default. */
  embedModel: string | null;
  lastTestStatus: AiTestStatus | null;
  lastTestedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ProviderInfoDto {
  id: AiProvider;
  label: string;
  defaultChatModel: string;
  defaultEmbedModel: string;
}

export interface TestResultDto {
  /** Worse of `chat` and `embed` — what gets stored on the credential. */
  status: AiTestStatus;
  chat: AiTestStatus;
  embed: AiTestStatus;
  testedAt: string;
}

export interface CreateCredentialInput {
  provider: AiProvider;
  label: string;
  apiKey: string;
  chatModel?: string;
  embedModel?: string;
}

export interface UpdateCredentialInput {
  label?: string;
  /** Omit to keep the stored key. */
  apiKey?: string;
  chatModel?: string;
  embedModel?: string;
}
