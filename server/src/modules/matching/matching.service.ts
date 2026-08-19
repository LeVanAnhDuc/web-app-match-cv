import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { DocumentKind, MatchStatus, Prisma } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { CreateMatchRunDto } from "./dto/create-match-run.dto";
import { MatchResultDto } from "./dto/match-result.dto";
import { MatchRunDetailDto } from "./dto/match-run-detail.dto";
import { MatchRunDto } from "./dto/match-run.dto";
import { MatchSummaryDto } from "./dto/match-summary.dto";
import { AiProviderError, AiService, MatchReport } from "../ai/ai.service";
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

  /** Both documents must exist, belong to the caller, and be the right kind. */
  private async requireOwnedPair(cvDocumentId: string, jdDocumentId: string) {
    const userId = this.currentUser.getUserId();

    const [cvDoc, jdDoc] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: cvDocumentId, userId } }),
      this.prisma.document.findFirst({ where: { id: jdDocumentId, userId } })
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
    return { userId, cvDoc, jdDoc };
  }

  /**
   * Opens a run BEFORE any AI call, so the client can navigate to the result
   * step and render one skeleton per provider immediately.
   */
  async createRun(dto: CreateMatchRunDto): Promise<MatchRunDto> {
    const { userId, cvDoc, jdDoc } = await this.requireOwnedPair(
      dto.cvDocumentId,
      dto.jdDocumentId
    );
    const created = await this.prisma.matchRun.create({
      data: { userId, cvDocumentId: cvDoc.id, jdDocumentId: jdDoc.id }
    });
    return MatchRunDto.fromEntity(created);
  }

  async getRun(id: string): Promise<MatchRunDetailDto> {
    const userId = this.currentUser.getUserId();
    const found = await this.prisma.matchRun.findFirst({
      where: { id, userId },
      include: { results: { orderBy: { createdAt: "asc" } } }
    });
    if (!found) {
      throw new NotFoundException(
        tMatch("matching.errors.runNotFound", "Match run not found.")
      );
    }
    return MatchRunDetailDto.fromEntity(found);
  }

  /** The run must be the caller's and must be about these same two documents. */
  private async requireRunMatches(
    runId: string,
    cvDocumentId: string,
    jdDocumentId: string
  ): Promise<void> {
    const userId = this.currentUser.getUserId();
    const run = await this.prisma.matchRun.findFirst({
      where: { id: runId, userId }
    });
    if (!run) {
      throw new NotFoundException(
        tMatch("matching.errors.runNotFound", "Match run not found.")
      );
    }
    if (
      run.cvDocumentId !== cvDocumentId ||
      run.jdDocumentId !== jdDocumentId
    ) {
      throw new BadRequestException(
        tMatch(
          "matching.errors.runDocumentMismatch",
          "This run is for a different pair of documents."
        )
      );
    }
  }

  async createMatch(dto: CreateMatchDto): Promise<MatchResultDto> {
    const { userId, cvDoc, jdDoc } = await this.requireOwnedPair(
      dto.cvDocumentId,
      dto.jdDocumentId
    );

    if (dto.runId) await this.requireRunMatches(dto.runId, cvDoc.id, jdDoc.id);

    // The user's own credential when they picked one, else the system key.
    const runtime = dto.credentialId
      ? await this.credentials.getRuntimeConfig(dto.credentialId)
      : this.ai.systemRuntimeConfig();

    const shared = {
      userId,
      cvDocumentId: cvDoc.id,
      jdDocumentId: jdDoc.id,
      runId: dto.runId ?? null,
      credentialId: dto.credentialId ?? null,
      provider: runtime.provider,
      chatModel: runtime.chatModel,
      embedModel: runtime.embedModel
    };

    let outcome: Prisma.MatchResultUncheckedCreateInput;
    try {
      const result = await this.run(cvDoc.rawText, jdDoc.rawText, runtime);
      outcome = {
        ...shared,
        status: MatchStatus.succeeded,
        errorCode: null,
        overallScore: result.overallScore,
        semanticScore: result.semanticScore,
        keywordScore: result.keywordScore,
        report: result.report as unknown as Prisma.InputJsonValue
      };
    } catch (error) {
      // A dead provider is this card's outcome, not the request's failure.
      // Rethrowing would take down every other provider in the same run, and
      // would leave the card with nothing to show after a reload.
      // Configuration errors never reach here: they are thrown before the
      // engine runs, and still surface as 503.
      if (!(error instanceof AiProviderError)) throw error;
      outcome = {
        ...shared,
        status: MatchStatus.failed,
        errorCode: error.reason,
        overallScore: 0,
        semanticScore: 0,
        keywordScore: 0,
        report: {
          strengths: [],
          gaps: [],
          suggestions: []
        }
      };
    }

    const created = await this.prisma.matchResult.create({ data: outcome });

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
