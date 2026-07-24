import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { tMatch } from './i18n-messages';

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

const DEFAULT_GEN_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBED_MODEL = 'text-embedding-004';
const GEMINI_TIMEOUT_MS = 20_000; // availability guard: /match must fail 503, not hang, if Gemini stalls

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['strengths', 'gaps', 'suggestions'],
};

function notConfiguredError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tMatch(
      'matching.errors.notConfigured',
      'Matching service is not configured. Please contact the administrator.',
    ),
  );
}

function geminiFailedError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tMatch(
      'matching.errors.geminiFailed',
      'Matching service failed. Please try again later.',
    ),
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(geminiFailedError()), GEMINI_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Thin wrapper around the Google Gemini SDK (`@google/genai`).
 *
 * Optional at boot: the service is constructed even without `GEMINI_API_KEY`
 * so the app (and every endpoint other than /match) can start and be tested
 * without a real key. It becomes required at call time — `embed()` and
 * `generateReport()` both throw a 503 (i18n) when not configured or when the
 * underlying Gemini call fails. There is NO runtime fallback/mock here.
 */
@Injectable()
export class GeminiService {
  private readonly client?: GoogleGenAI;
  private readonly embedModel: string;
  private readonly genModel: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('GEMINI_API_KEY');
    this.embedModel =
      config.get<string>('GEMINI_EMBED_MODEL') ?? DEFAULT_EMBED_MODEL;
    this.genModel = config.get<string>('GEMINI_GEN_MODEL') ?? DEFAULT_GEN_MODEL;
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): GoogleGenAI {
    if (!this.client) throw notConfiguredError();
    return this.client;
  }

  async embed(text: string): Promise<number[]> {
    const client = this.requireClient();
    let values: number[] | undefined;
    try {
      const response = await withTimeout(
        client.models.embedContent({
          model: this.embedModel,
          contents: text,
        }),
      );
      values = response.embeddings?.[0]?.values;
    } catch {
      throw geminiFailedError();
    }
    if (!values || values.length === 0) throw geminiFailedError();
    return values;
  }

  async generateReport(
    cvText: string,
    jdText: string,
    scores: MatchScores,
  ): Promise<MatchReport> {
    const client = this.requireClient();
    const prompt = [
      'You are a recruiting assistant comparing a candidate CV against a job description (JD).',
      `Overall match score: ${scores.overallScore}%. Semantic similarity: ${scores.semanticScore}%. Keyword overlap: ${scores.keywordScore}%.`,
      'Based on the CV and JD below, list concrete strengths (what matches well), gaps (what is missing or weak), and suggestions (concrete ways to improve the CV for this JD).',
      '--- JD ---',
      jdText,
      '--- CV ---',
      cvText,
    ].join('\n\n');

    let text: string | undefined;
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model: this.genModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: REPORT_SCHEMA,
          },
        }),
      );
      text = response.text;
    } catch {
      throw geminiFailedError();
    }
    if (!text) throw geminiFailedError();

    try {
      const parsed: unknown = JSON.parse(text);
      const record = parsed as Record<string, unknown>;
      return {
        strengths: toStringArray(record.strengths),
        gaps: toStringArray(record.gaps),
        suggestions: toStringArray(record.suggestions),
      };
    } catch {
      throw geminiFailedError();
    }
  }
}
