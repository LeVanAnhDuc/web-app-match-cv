import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProvider, AiTestStatus } from "@prisma/client";
import OpenAI from "openai";
import { AiRuntimeConfig, PROVIDERS } from "./providers";
import { tAi } from "./i18n-messages";

export interface MatchScores {
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
}

export interface MatchReport {
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}

const AI_TIMEOUT_MS = 20_000; // availability guard: /match must fail 503, not hang, if the AI provider stalls
const PING_INPUT = "ping";
const PING_MAX_TOKENS = 5;

// Worst-first. The aggregate test verdict is the first of these that either
// capability reported, so "chat ok + embed invalid_key" surfaces as invalid_key
// rather than a misleading ok.
const SEVERITY_ORDER: AiTestStatus[] = [
  AiTestStatus.invalid_key,
  AiTestStatus.no_quota,
  AiTestStatus.model_unavailable,
  AiTestStatus.unreachable,
  AiTestStatus.ok
];

function notConfiguredError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tAi(
      "ai.errors.notConfigured",
      "Matching service is not configured. Please contact the administrator."
    )
  );
}

/**
 * A provider call failed, and we know roughly why.
 *
 * Still a 503 carrying the same i18n message, so any caller that does NOT
 * catch it behaves exactly as before. What it adds is `reason`: multi-provider
 * compare records one failure per card, and a card has to say *which* failure.
 */
export class AiProviderError extends ServiceUnavailableException {
  constructor(readonly reason: AiTestStatus) {
    super(
      tAi(
        "ai.errors.aiFailed",
        "Matching service failed. Please try again later."
      )
    );
  }
}

function aiFailedError(reason: AiTestStatus): AiProviderError {
  return new AiProviderError(reason);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(aiFailedError(AiTestStatus.unreachable)),
      AI_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Classify a provider failure WITHOUT retaining its message. Provider error
 * bodies can echo the submitted key, so the message is inspected in memory and
 * discarded — never stored, returned, or logged.
 */
// `APIError` is generic, so `instanceof` alone leaves `status`/`message` as
// `any`. Read them through an explicit shape and type-guard the values.
function apiErrorFields(error: unknown): {
  status?: number;
  message: string;
} {
  if (!(error instanceof OpenAI.APIError)) return { message: "" };
  const { status, message } = error as { status?: unknown; message?: unknown };
  return {
    status: typeof status === "number" ? status : undefined,
    message: typeof message === "string" ? message : ""
  };
}

export function mapProviderError(error: unknown): AiTestStatus {
  const { status, message } = apiErrorFields(error);
  if (status === 401 || status === 403) return AiTestStatus.invalid_key;
  if (status === 402 || status === 429) return AiTestStatus.no_quota;
  if (status === 404) return AiTestStatus.model_unavailable;
  if (status === 400 && /model/i.test(message)) {
    return AiTestStatus.model_unavailable;
  }
  return AiTestStatus.unreachable;
}

/** Keep an already-classified failure; classify anything else. */
function asProviderError(error: unknown): AiProviderError {
  return error instanceof AiProviderError
    ? error
    : new AiProviderError(mapProviderError(error));
}

/** Aggregate per-capability verdicts into the single status stored on the credential. */
export function worstStatus(...statuses: AiTestStatus[]): AiTestStatus {
  return (
    SEVERITY_ORDER.find((candidate) => statuses.includes(candidate)) ??
    AiTestStatus.unreachable
  );
}

/**
 * Thin wrapper around the OpenAI SDK (`openai`), pointed at whichever
 * OpenAI-compatible provider the caller supplies. The hybrid matching
 * architecture (embed x2 → cosine + keyword + LLM report) is unchanged — this
 * is only the provider/SDK layer.
 *
 * The client is built PER CALL from an `AiRuntimeConfig`: this service holds
 * no key and no client, so two requests running under different users'
 * credentials can never share state. There is NO runtime fallback/mock here —
 * `embed()` and `generateReport()` throw a 503 (i18n) when a call fails.
 */
@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Fallback used when the user picked no credential of their own. Throws 503
   * when the system key is not configured.
   */
  systemRuntimeConfig(): AiRuntimeConfig {
    const apiKey = this.config.get<string>("OPENROUTER_API_KEY");
    if (!apiKey) throw notConfiguredError();
    const descriptor = PROVIDERS[AiProvider.openrouter];
    return {
      provider: AiProvider.openrouter,
      apiKey,
      baseUrl:
        this.config.get<string>("OPENROUTER_BASE_URL") ?? descriptor.baseUrl,
      chatModel:
        this.config.get<string>("OPENROUTER_CHAT_MODEL") ??
        descriptor.defaultChatModel,
      embedModel:
        this.config.get<string>("OPENROUTER_EMBED_MODEL") ??
        descriptor.defaultEmbedModel
    };
  }

  isSystemConfigured(): boolean {
    return Boolean(this.config.get<string>("OPENROUTER_API_KEY"));
  }

  private client(cfg: AiRuntimeConfig): OpenAI {
    return new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });
  }

  async embed(text: string, cfg: AiRuntimeConfig): Promise<number[]> {
    let embedding: number[] | undefined;
    try {
      const response = await withTimeout(
        this.client(cfg).embeddings.create({
          model: cfg.embedModel,
          input: text
        })
      );
      embedding = response.data[0]?.embedding;
    } catch (error) {
      throw asProviderError(error);
    }
    if (!embedding || embedding.length === 0) {
      throw aiFailedError(AiTestStatus.unreachable);
    }
    return embedding;
  }

  async generateReport(
    cvText: string,
    jdText: string,
    scores: MatchScores,
    cfg: AiRuntimeConfig
  ): Promise<MatchReport> {
    const prompt = [
      "You are a recruiting assistant comparing a candidate CV against a job description (JD).",
      `Overall match score: ${scores.overallScore}%. Semantic similarity: ${scores.semanticScore}%. Keyword overlap: ${scores.keywordScore}%.`,
      "Based on the CV and JD below, list concrete strengths (what matches well), gaps (what is missing or weak), and suggestions (concrete ways to improve the CV for this JD).",
      'Respond ONLY with a JSON object of shape { "strengths": string[], "gaps": string[], "suggestions": string[] }.',
      "--- JD ---",
      jdText,
      "--- CV ---",
      cvText
    ].join("\n\n");

    let content: string | null | undefined;
    try {
      const response = await withTimeout(
        this.client(cfg).chat.completions.create({
          model: cfg.chatModel,
          messages: [
            {
              role: "system",
              content: "You are a recruiting assistant. Respond ONLY with JSON."
            },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      );
      content = response.choices[0]?.message?.content;
    } catch (error) {
      throw asProviderError(error);
    }
    if (!content) throw aiFailedError(AiTestStatus.unreachable);

    try {
      const parsed: unknown = JSON.parse(content);
      const record = parsed as Record<string, unknown>;
      return {
        strengths: toStringArray(record.strengths),
        gaps: toStringArray(record.gaps),
        suggestions: toStringArray(record.suggestions)
      };
    } catch {
      // Unparseable JSON is the model misbehaving, not the transport.
      throw aiFailedError(AiTestStatus.model_unavailable);
    }
  }

  /**
   * Exercise BOTH capabilities the hybrid engine needs. Testing only chat
   * would report a false "ok" for a key that can chat but cannot embed, which
   * is exactly the failure the user would then hit mid-match.
   */
  async ping(
    cfg: AiRuntimeConfig
  ): Promise<{ chat: AiTestStatus; embed: AiTestStatus }> {
    const client = this.client(cfg);

    const chat = withTimeout(
      client.chat.completions.create({
        model: cfg.chatModel,
        max_tokens: PING_MAX_TOKENS,
        messages: [{ role: "user", content: PING_INPUT }]
      })
    )
      .then(() => AiTestStatus.ok)
      .catch((error: unknown) => mapProviderError(error));

    const embed = withTimeout(
      client.embeddings.create({ model: cfg.embedModel, input: PING_INPUT })
    )
      .then(() => AiTestStatus.ok)
      .catch((error: unknown) => mapProviderError(error));

    const [chatStatus, embedStatus] = await Promise.all([chat, embed]);
    return { chat: chatStatus, embed: embedStatus };
  }
}
