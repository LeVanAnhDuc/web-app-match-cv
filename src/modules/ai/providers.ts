import { AiProvider } from "@prisma/client";

export interface ProviderDescriptor {
  baseUrl: string;
  defaultChatModel: string;
  defaultEmbedModel: string;
}

/**
 * The whole difference between supported providers is DATA, not behaviour:
 * all three speak the OpenAI-compatible protocol (project-goals ADR #10), so
 * one `openai` client with a different baseURL drives every one of them.
 * Gemini qualifies because its compatibility layer covers /chat/completions
 * AND /embeddings — the hybrid engine needs both (design.md §2).
 */
export const PROVIDERS: Record<AiProvider, ProviderDescriptor> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultChatModel: "openai/gpt-4o-mini",
    defaultEmbedModel: "openai/text-embedding-3-small"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbedModel: "text-embedding-3-small"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultChatModel: "gemini-2.5-flash",
    defaultEmbedModel: "gemini-embedding-001"
  }
};

/**
 * Everything needed to make one AI call. Holds a PLAINTEXT key, so it is an
 * internal runtime type only: never a DTO, never serialised into a response,
 * never logged.
 */
export interface AiRuntimeConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embedModel: string;
}

/** Per-credential overrides win over the provider default; blank counts as absent. */
export function resolveModels(
  provider: AiProvider,
  chatModel: string | null,
  embedModel: string | null
): { baseUrl: string; chatModel: string; embedModel: string } {
  const descriptor = PROVIDERS[provider];
  return {
    baseUrl: descriptor.baseUrl,
    chatModel: chatModel?.trim() || descriptor.defaultChatModel,
    embedModel: embedModel?.trim() || descriptor.defaultEmbedModel
  };
}
