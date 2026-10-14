import type { AiProvider, AiTestStatus, ProviderInfoDto, TestResultDto } from "#/types/AiCredentials";

// Values of module ai-credentials (REQ-AICREDENTIALS-*). Values only: no .env, no network.

/**
 * A syntactically valid key (20–400 chars, no whitespace) that no provider accepts. Distinctive enough that a
 * substring search over a whole response body / DOM proves it never leaked (REQ-AICREDENTIALS-13, -19).
 */
export const FAKE_KEY = "sk-e2e-secret-do-not-leak-9876";
export const FAKE_KEY_LAST4 = "9876";
/** A second key, for rotations. */
export const ROTATED_KEY = "sk-e2e-rotated-key-abcdefgh4321";
export const ROTATED_KEY_LAST4 = "4321";
/** Recognisable prefix shared by FAKE_KEY: the leak assertions also search for it. */
export const KEY_PREFIX = "sk-e2e-secret";

export const KEY_MIN = 20;
export const KEY_MAX = 400;
export const LABEL_MAX = 60;
export const MODEL_MAX = 120;

/** Every field of AiCredentialDto, in the documented order (REQ-AICREDENTIALS-18). */
export const CREDENTIAL_FIELDS = [
  "id",
  "provider",
  "label",
  "keyLast4",
  "chatModel",
  "embedModel",
  "lastTestStatus",
  "lastTestedAt",
  "lastUsedAt",
  "createdAt",
] as const;

/** Columns that must never leave the server. */
export const SECRET_FIELDS = ["apiKey", "encryptedKey", "keyIv", "keyTag"] as const;

/** The provider whitelist (ADR-0010, REQ-AICREDENTIALS-14). */
export const PROVIDERS: ProviderInfoDto[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultChatModel: "openai/gpt-4o-mini",
    defaultEmbedModel: "openai/text-embedding-3-small",
  },
  { id: "openai", label: "OpenAI", defaultChatModel: "gpt-4o-mini", defaultEmbedModel: "text-embedding-3-small" },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultChatModel: "gemini-2.5-flash",
    defaultEmbedModel: "gemini-embedding-001",
  },
];

export const providerInfo = (id: AiProvider): ProviderInfoDto => PROVIDERS.find((p) => p.id === id)!;

/** Every connection-test verdict the UI must translate (REQ-AICREDENTIALS-12). */
export const TEST_STATUSES: AiTestStatus[] = ["ok", "invalid_key", "no_quota", "model_unavailable", "timeout", "unreachable"];

/** Stubbed body of POST /ai-credentials/:id/test (D1: UI specs never reach the provider). */
export function testResult(chat: AiTestStatus, embed: AiTestStatus = chat, status?: AiTestStatus): TestResultDto {
  return { chat, embed, status: status ?? (chat === "ok" ? embed : chat), testedAt: new Date().toISOString() };
}

/** POST /ai-credentials/:id/test, any id (RegExp: the id segment). */
export const TEST_ENDPOINT = /\/api\/v1\/ai-credentials\/[^/?]+\/test$/;
/** GET/POST /ai-credentials (the collection, not /providers or /:id). */
export const COLLECTION_ENDPOINT = /\/api\/v1\/ai-credentials(\?.*)?$/;
/** PATCH/DELETE /ai-credentials/:id. */
export const ITEM_ENDPOINT = /\/api\/v1\/ai-credentials\/[0-9a-f-]{36}$/;
/** Every credential endpoint, for "nothing was requested" assertions. */
export const ANY_CREDENTIAL_ENDPOINT = /\/api\/v1\/ai-credentials/;

/** Unique per call so tests never collide on the (userId, label) constraint, even across crashed runs. */
export function uniqueLabel(prefix = "E2E key"): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Wizard texts for reaching step 3 (pasted, transient documents). */
export const WIZARD_JD_TEXT = "We are hiring a senior backend engineer with NestJS and PostgreSQL experience.";
export const WIZARD_CV_TEXT = "Senior backend engineer, 6 years with Node.js, NestJS and PostgreSQL.";

/** Minimum touch target on a touch screen (NFR-A11Y-03, REQ-AICREDENTIALS-42). */
export const TOUCH_TARGET_PX = 44;

/** Same pattern as the old suite: a missing translation surfaces as a raw `credentials.*` key. */
export const RAW_KEY_PATTERN = /\bcredentials\.[a-zA-Z_.]+/;

/** Swagger placeholder for apiKey examples (REQ-AICREDENTIALS-43). */
export const PLACEHOLDER_KEY_EXAMPLE = /^sk-x+$/;
