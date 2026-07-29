import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { tMatch } from "./i18n-messages";

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

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_EMBED_MODEL = "openai/text-embedding-3-small";
const AI_TIMEOUT_MS = 20_000; // availability guard: /match must fail 503, not hang, if the AI provider stalls

function notConfiguredError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tMatch(
      "matching.errors.notConfigured",
      "Matching service is not configured. Please contact the administrator."
    )
  );
}

function aiFailedError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tMatch(
      "matching.errors.aiFailed",
      "Matching service failed. Please try again later."
    )
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(aiFailedError()), AI_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Thin wrapper around the OpenAI SDK (`openai`) pointed at OpenRouter's
 * OpenAI-compatible API. OpenRouter provides both embeddings and chat
 * completions, so the existing hybrid matching architecture (embed x2 →
 * cosine + keyword + LLM report) is unchanged — only the provider/SDK layer.
 *
 * Optional at boot: the service is constructed even without
 * `OPENROUTER_API_KEY` so the app (and every endpoint other than /match) can
 * start and be tested without a real key. It becomes required at call time —
 * `embed()` and `generateReport()` both throw a 503 (i18n) when not
 * configured or when the underlying call fails. There is NO runtime
 * fallback/mock here.
 */
@Injectable()
export class AiService {
  private readonly client?: OpenAI;
  private readonly embedModel: string;
  private readonly chatModel: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("OPENROUTER_API_KEY");
    const baseURL =
      config.get<string>("OPENROUTER_BASE_URL") ?? DEFAULT_BASE_URL;
    this.embedModel =
      config.get<string>("OPENROUTER_EMBED_MODEL") ?? DEFAULT_EMBED_MODEL;
    this.chatModel =
      config.get<string>("OPENROUTER_CHAT_MODEL") ?? DEFAULT_CHAT_MODEL;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL }) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): OpenAI {
    if (!this.client) throw notConfiguredError();
    return this.client;
  }

  async embed(text: string): Promise<number[]> {
    const client = this.requireClient();
    let embedding: number[] | undefined;
    try {
      const response = await withTimeout(
        client.embeddings.create({
          model: this.embedModel,
          input: text
        })
      );
      embedding = response.data[0]?.embedding;
    } catch {
      throw aiFailedError();
    }
    if (!embedding || embedding.length === 0) throw aiFailedError();
    return embedding;
  }

  async generateReport(
    cvText: string,
    jdText: string,
    scores: MatchScores
  ): Promise<MatchReport> {
    const client = this.requireClient();
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
        client.chat.completions.create({
          model: this.chatModel,
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
    } catch {
      throw aiFailedError();
    }
    if (!content) throw aiFailedError();

    try {
      const parsed: unknown = JSON.parse(content);
      const record = parsed as Record<string, unknown>;
      return {
        strengths: toStringArray(record.strengths),
        gaps: toStringArray(record.gaps),
        suggestions: toStringArray(record.suggestions)
      };
    } catch {
      throw aiFailedError();
    }
  }
}
