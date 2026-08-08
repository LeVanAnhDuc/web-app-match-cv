import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CoverLetterStatus,
  MatchStatus,
  Prisma,
  type MatchResult
} from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiProviderError, AiService } from "../ai/ai.service";
import { AiCredentialsService } from "../ai-credentials/ai-credentials.service";
import { CoverLetterDto } from "./dto/cover-letter.dto";
import { CreateCoverLetterDto } from "./dto/create-cover-letter.dto";
import { ListCoverLettersQueryDto } from "./dto/list-cover-letters-query.dto";
import { UpdateCoverLetterDto } from "./dto/update-cover-letter.dto";
import { tLetter } from "./i18n-messages";
import { buildCoverLetterPrompt } from "./prompt";

/** The report shape stored as jsonb on MatchResult. */
interface StoredReport {
  strengths?: unknown;
  gaps?: unknown;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/**
 * Generates cover letters from an existing match.
 *
 * Two properties are load-bearing and deliberate:
 *
 * - **Grounded** — the prompt is built from the match's own report: strengths
 *   are the material, gaps are a forbidden list (ADR #13, see prompt.ts).
 * - **Failures are stored, not thrown** — a dead provider is this letter's
 *   outcome, so the user can see what broke and retry, and a reload still
 *   shows it. Same contract `POST /match` adopted in multi-provider-compare.
 *   Configuration errors (missing system key, missing encryption key) are
 *   thrown before generation runs and still surface as 503.
 */
@Injectable()
export class CoverLettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly credentials: AiCredentialsService,
    private readonly currentUser: CurrentUserService
  ) {}

  /** The match must be the caller's, and must have actually produced a report. */
  private async requireUsableMatch(matchResultId: string): Promise<
    MatchResult & {
      cvDocument: { rawText: string };
      jdDocument: { rawText: string };
    }
  > {
    const userId = this.currentUser.getUserId();
    const match = await this.prisma.matchResult.findFirst({
      where: { id: matchResultId, userId },
      include: {
        cvDocument: { select: { rawText: true } },
        jdDocument: { select: { rawText: true } }
      }
    });
    if (!match) {
      throw new NotFoundException(
        tLetter(
          "coverLetters.errors.matchNotFound",
          "Match result not found or does not belong to you."
        )
      );
    }
    if (match.status !== MatchStatus.succeeded) {
      // No strengths means no material to write from, and no gaps means
      // nothing to ground the letter against. Both halves are missing.
      throw new BadRequestException(
        tLetter(
          "coverLetters.errors.matchNotSucceeded",
          "This match did not produce a report, so there is nothing to write a letter from."
        )
      );
    }
    return match;
  }

  async generate(dto: CreateCoverLetterDto): Promise<CoverLetterDto> {
    const userId = this.currentUser.getUserId();
    const match = await this.requireUsableMatch(dto.matchResultId);

    // The user's own credential when they picked one, else the system key.
    const runtime = dto.credentialId
      ? await this.credentials.getRuntimeConfig(dto.credentialId)
      : this.ai.systemRuntimeConfig();

    const report = (match.report ?? {}) as StoredReport;
    const prompt = buildCoverLetterPrompt({
      cvText: match.cvDocument.rawText,
      jdText: match.jdDocument.rawText,
      strengths: toStringArray(report.strengths),
      gaps: toStringArray(report.gaps),
      tone: dto.tone,
      length: dto.length,
      language: dto.language
    });

    const shared = {
      userId,
      matchResultId: match.id,
      tone: dto.tone,
      length: dto.length,
      language: dto.language,
      credentialId: dto.credentialId ?? null,
      provider: runtime.provider,
      chatModel: runtime.chatModel
    };

    let outcome: Prisma.CoverLetterUncheckedCreateInput;
    try {
      const draft = await this.ai.generateCoverLetter(prompt, runtime);
      outcome = {
        ...shared,
        status: CoverLetterStatus.succeeded,
        errorCode: null,
        content: draft.body,
        omittedRequirements: draft.omittedRequirements
      };
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      outcome = {
        ...shared,
        status: CoverLetterStatus.failed,
        errorCode: error.reason,
        content: "",
        omittedRequirements: []
      };
    }

    const created = await this.prisma.coverLetter.create({ data: outcome });

    // Audit stamp, deliberately outside the write above: a failed timestamp
    // update must not roll back a generation the user already paid for.
    if (dto.credentialId) await this.credentials.markUsed(dto.credentialId);

    return CoverLetterDto.fromEntity(created);
  }

  /**
   * Letters of one match, newest first. A `matchResultId` belonging to someone
   * else yields an empty list rather than a 403 — not confirming that the id
   * exists at all.
   */
  async list(query: ListCoverLettersQueryDto): Promise<CoverLetterDto[]> {
    const userId = this.currentUser.getUserId();
    const rows = await this.prisma.coverLetter.findMany({
      where: { userId, matchResultId: query.matchResultId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => CoverLetterDto.fromEntity(row));
  }

  async update(id: string, dto: UpdateCoverLetterDto): Promise<CoverLetterDto> {
    const found = await this.findOwned(id);
    if (found.status !== CoverLetterStatus.succeeded) {
      throw new BadRequestException(
        tLetter(
          "coverLetters.errors.notEditable",
          "This letter failed to generate, so there is nothing to edit."
        )
      );
    }
    const updated = await this.prisma.coverLetter.update({
      where: { id },
      // `edited` is what lets the UI tell an AI draft from a human-revised one.
      data: { content: dto.content, edited: true }
    });
    return CoverLetterDto.fromEntity(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOwned(id);
    await this.prisma.coverLetter.delete({ where: { id } });
  }

  private async findOwned(id: string) {
    const userId = this.currentUser.getUserId();
    const found = await this.prisma.coverLetter.findFirst({
      where: { id, userId }
    });
    if (!found) {
      throw new NotFoundException(
        tLetter("coverLetters.errors.notFound", "Cover letter not found.")
      );
    }
    return found;
  }
}
