import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { DocumentKind, Prisma } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { MatchResultDto } from "./dto/match-result.dto";
import { MatchSummaryDto } from "./dto/match-summary.dto";
import { AiService, MatchReport } from "../ai/ai.service";
import { AiRuntimeConfig } from "../ai/providers";
import { AiCredentialsService } from "../ai-credentials/ai-credentials.service";
import { tMatch } from "./i18n-messages";
import { tokenize } from "./tokenizer";

export interface MatchRunResult {
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  report: MatchReport;
}

const SEMANTIC_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;
// Cap text actually sent to the AI provider (embed + report), independent of the
// storage-time caps (paste 100k / uploaded-doc extract 2M). Bounds cost +
// latency: a match report doesn't need the full body of a huge PDF.
const MAX_MATCH_CHARS = 20_000;
export const capForMatch = (text: string): string =>
  text.slice(0, MAX_MATCH_CHARS);

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Hybrid CV↔JD matching engine — keyword overlap (in-app) + semantic
 * similarity (cosine over OpenRouter embeddings, computed in-app — NO
 * pgvector, NO stored vectors) combined into a single overall score, plus an
 * AI-generated strengths/gaps/suggestions report.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
    private readonly credentials: AiCredentialsService
  ) {}

  /** |JD ∩ CV| / |JD| * 100, rounded, clamped to [0, 100]. 0 if JD has no meaningful tokens. */
  keywordScore(cvText: string, jdText: string): number {
    const jdTokens = tokenize(jdText);
    if (jdTokens.size === 0) return 0;
    const cvTokens = tokenize(cvText);
    let overlap = 0;
    for (const token of jdTokens) {
      if (cvTokens.has(token)) overlap += 1;
    }
    return clampPercent(Math.round((overlap / jdTokens.size) * 100));
  }

  /** Cosine similarity of two vectors. Returns 0 for empty/mismatched/zero vectors. */
  cosine(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /** overallScore = round(0.6*semantic + 0.4*keyword), clamped to [0, 100]. */
  combineOverall(semanticScore: number, keywordScoreValue: number): number {
    return clampPercent(
      Math.round(
        SEMANTIC_WEIGHT * semanticScore + KEYWORD_WEIGHT * keywordScoreValue
      )
    );
  }

  /** Runs the hybrid engine (embed x2 + cosine + keyword + AI report) over raw text. */
  async run(
    rawCvText: string,
    rawJdText: string,
    cfg: AiRuntimeConfig
  ): Promise<MatchRunResult> {
    const cvText = capForMatch(rawCvText);
    const jdText = capForMatch(rawJdText);
    const [cvEmbedding, jdEmbedding] = await Promise.all([
      this.ai.embed(cvText, cfg),
      this.ai.embed(jdText, cfg)
    ]);
    const semanticScore = clampPercent(
      Math.round(this.cosine(cvEmbedding, jdEmbedding) * 100)
    );
    const keywordScoreValue = this.keywordScore(cvText, jdText);
    const overallScore = this.combineOverall(semanticScore, keywordScoreValue);
    const report = await this.ai.generateReport(
      cvText,
      jdText,
      { overallScore, semanticScore, keywordScore: keywordScoreValue },
      cfg
    );
    return {
      overallScore,
      semanticScore,
      keywordScore: keywordScoreValue,
      report
    };
  }

  async createMatch(dto: CreateMatchDto): Promise<MatchResultDto> {
    const userId = this.currentUser.getUserId();

    const [cvDoc, jdDoc] = await Promise.all([
      this.prisma.document.findFirst({
        where: { id: dto.cvDocumentId, userId }
      }),
      this.prisma.document.findFirst({
        where: { id: dto.jdDocumentId, userId }
      })
    ]);

    if (!cvDoc || !jdDoc) {
      throw new BadRequestException(
        tMatch(
          "matching.errors.documentNotOwned",
          "Document not found or does not belong to you."
        )
      );
    }
    if (cvDoc.kind !== DocumentKind.CV || jdDoc.kind !== DocumentKind.JD) {
      throw new BadRequestException(
        tMatch(
          "matching.errors.invalidDocumentKind",
          "Document kind does not match (expected CV/JD as specified)."
        )
      );
    }

    // The user's own credential when they picked one, else the system key.
    const runtime = dto.credentialId
      ? await this.credentials.getRuntimeConfig(dto.credentialId)
      : this.ai.systemRuntimeConfig();

    const result = await this.run(cvDoc.rawText, jdDoc.rawText, runtime);

    const created = await this.prisma.matchResult.create({
      data: {
        userId,
        cvDocumentId: cvDoc.id,
        jdDocumentId: jdDoc.id,
        credentialId: dto.credentialId ?? null,
        provider: runtime.provider,
        chatModel: runtime.chatModel,
        embedModel: runtime.embedModel,
        overallScore: result.overallScore,
        semanticScore: result.semanticScore,
        keywordScore: result.keywordScore,
        report: result.report as unknown as Prisma.InputJsonValue
      }
    });

    // Audit stamp, deliberately AFTER (and outside) the result write: a failed
    // timestamp update must not roll back a match the user already paid for.
    if (dto.credentialId) await this.credentials.markUsed(dto.credentialId);

    return MatchResultDto.fromEntity(created);
  }

  async getById(id: string): Promise<MatchResultDto> {
    const userId = this.currentUser.getUserId();
    const found = await this.prisma.matchResult.findFirst({
      where: { id, userId }
    });
    if (!found) {
      throw new NotFoundException(
        tMatch("matching.errors.matchNotFound", "Match result not found.")
      );
    }
    return MatchResultDto.fromEntity(found);
  }

  async list(): Promise<MatchSummaryDto[]> {
    const userId = this.currentUser.getUserId();
    const rows = await this.prisma.matchResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        cvDocument: { select: { title: true } },
        jdDocument: { select: { title: true } }
      }
    });
    return rows.map((r) => MatchSummaryDto.fromEntity(r));
  }
}
