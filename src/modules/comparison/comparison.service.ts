import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { DocumentKind, MatchStatus, type Document } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ComparisonQueryDto } from "./dto/comparison-query.dto";
import {
  ComparisonJdOptionDto,
  ComparisonSideDto,
  CvComparisonDto,
  DocumentVersionDto
} from "./dto/cv-comparison.dto";
import { MAX_GAPS_PER_SIDE, diffGaps } from "./gap-diff";
import { tCompare } from "./i18n-messages";
import {
  MAX_LINEAGE_DEPTH,
  resolveVersion,
  type ParentLookup
} from "./lineage";

/**
 * How many of the two versions' succeeded runs are scanned, newest first.
 * Only the newest run per (CV, JD) is used, so this only truncates the list of
 * selectable job descriptions — and only for a user with hundreds of matches
 * on one CV.
 */
const MAX_MATCHES_SCANNED = 500;

/** The columns of a MatchResult this module reads, plus the JD's title. */
interface ScoredMatch {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  provider: ComparisonSideDto["provider"];
  chatModel: string;
  embedModel: string;
  report: unknown;
  createdAt: Date;
  jdDocument: { title: string };
}

/**
 * `report` is model-authored JSON. Capped at the same limit the diff uses, so
 * the response can never carry more gaps than the comparison actually looked
 * at — a longer list would be shown to the user and silently ignored by the
 * diff, which is worse than not showing it.
 */
function gapsOf(report: unknown): string[] {
  const gaps = (report as { gaps?: unknown } | null)?.gaps;
  if (!Array.isArray(gaps)) return [];
  return gaps.slice(0, MAX_GAPS_PER_SIDE).map((gap) => String(gap));
}

function toSide(match: ScoredMatch): ComparisonSideDto {
  const side = new ComparisonSideDto();
  side.matchResultId = match.id;
  side.overallScore = match.overallScore;
  side.semanticScore = match.semanticScore;
  side.keywordScore = match.keywordScore;
  side.provider = match.provider;
  side.chatModel = match.chatModel;
  side.embedModel = match.embedModel;
  side.gaps = gapsOf(match.report);
  side.createdAt = match.createdAt;
  return side;
}

function toVersion(doc: Document, version: number): DocumentVersionDto {
  const dto = new DocumentVersionDto();
  dto.id = doc.id;
  dto.title = doc.title;
  dto.version = version;
  dto.createdAt = doc.createdAt;
  return dto;
}

/**
 * Goal 9 — how much a CV improved between two versions, on the same JD.
 *
 * Read-only by design, and provably so: this module does not depend on
 * AiModule at all. Opening a comparison must never spend a chat completion or
 * send the user's CV out again, so a version that has not been matched yet is
 * reported as exactly that and the user is handed back to the wizard, which
 * already owns credential choice and the privacy notice
 * (docs/specs/cv-version-comparison/design.md §2).
 */
@Injectable()
export class ComparisonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService
  ) {}

  async compare(
    documentId: string,
    query: ComparisonQueryDto
  ): Promise<CvComparisonDto> {
    const userId = this.currentUser.getUserId();
    const revisionDoc = await this.prisma.document.findFirst({
      where: { id: documentId, userId }
    });
    if (!revisionDoc) {
      throw new NotFoundException(
        tCompare("comparison.errors.documentNotFound", "CV not found.")
      );
    }
    if (revisionDoc.kind !== DocumentKind.CV) {
      throw new BadRequestException(
        tCompare(
          "comparison.errors.notCv",
          "Only a CV can be compared against a previous version."
        )
      );
    }

    const baseDoc = revisionDoc.parentId
      ? await this.prisma.document.findFirst({
          where: { id: revisionDoc.parentId, userId }
        })
      : null;
    // Also the branch a deleted original lands in: ADR #15 nulls the link
    // rather than cascading, so there is never a dangling parentId.
    if (!baseDoc) {
      throw new BadRequestException(
        tCompare(
          "comparison.errors.noParent",
          "This CV is not marked as a new version of another CV."
        )
      );
    }
    // Defence in depth: setParent already refuses a cross-kind link, so this is
    // unreachable today — but the column itself allows one, and a JD parent
    // would silently produce a "score delta" against a job description.
    if (baseDoc.kind !== DocumentKind.CV) {
      throw new BadRequestException(
        tCompare(
          "comparison.errors.notCv",
          "Only a CV can be compared against a previous version."
        )
      );
    }

    const ancestors = await this.loadAncestors(revisionDoc, userId);

    const matches = (await this.prisma.matchResult.findMany({
      where: {
        userId,
        cvDocumentId: { in: [baseDoc.id, revisionDoc.id] },
        status: MatchStatus.succeeded
      },
      orderBy: { createdAt: "desc" },
      // Bounded: every row drags a JSON report along, and only the newest run
      // per (CV, JD) is ever read. A user with thousands of matches on one CV
      // would otherwise pay for all of them to render one screen.
      take: MAX_MATCHES_SCANNED,
      include: { jdDocument: { select: { title: true } } }
    })) as unknown as ScoredMatch[];

    const jdOptions = this.buildJdOptions(matches, baseDoc.id, revisionDoc.id);
    const jdDocumentId = this.selectJd(jdOptions, query.jdDocumentId);

    const onJd = matches.filter((m) => m.jdDocumentId === jdDocumentId);
    // Newest first already, so the head of each side is the latest run.
    const revisionMatch =
      onJd.find((m) => m.cvDocumentId === revisionDoc.id) ?? null;
    const baseMatch = this.pickBaseMatch(
      onJd.filter((m) => m.cvDocumentId === baseDoc.id),
      revisionMatch
    );

    return this.assemble({
      base: toVersion(baseDoc, resolveVersion(baseDoc.id, ancestors)),
      revision: toVersion(
        revisionDoc,
        resolveVersion(revisionDoc.id, ancestors)
      ),
      jdDocumentId,
      jdOptions,
      baseMatch,
      revisionMatch
    });
  }

  /**
   * Every JD either version has a succeeded match against, most recently
   * matched first. Not filtered by `isSaved`: a document the user never saved
   * for reuse is still a document they matched against.
   */
  private buildJdOptions(
    matches: ScoredMatch[],
    baseId: string,
    revisionId: string
  ): ComparisonJdOptionDto[] {
    const byJd = new Map<string, ComparisonJdOptionDto>();
    for (const match of matches) {
      let option = byJd.get(match.jdDocumentId);
      if (!option) {
        option = new ComparisonJdOptionDto();
        option.id = match.jdDocumentId;
        option.title = match.jdDocument.title;
        option.hasBase = false;
        option.hasRevision = false;
        byJd.set(match.jdDocumentId, option);
      }
      if (match.cvDocumentId === baseId) option.hasBase = true;
      if (match.cvDocumentId === revisionId) option.hasRevision = true;
    }
    return [...byJd.values()];
  }

  /**
   * An explicit choice is honoured or rejected — never silently swapped for
   * another JD, which would leave the user reading numbers about a job
   * description they did not pick.
   */
  private selectJd(
    options: ComparisonJdOptionDto[],
    requested: string | undefined
  ): string | null {
    if (requested) {
      if (!options.some((option) => option.id === requested)) {
        throw new BadRequestException(
          tCompare(
            "comparison.errors.jdNotComparable",
            "Neither version has been matched against that job description."
          )
        );
      }
      return requested;
    }
    const complete = options.find(
      (option) => option.hasBase && option.hasRevision
    );
    return complete?.id ?? options[0]?.id ?? null;
  }

  /**
   * Prefer the base run that used the SAME chat and embedding models as the
   * revision run, falling back to the most recent one.
   *
   * Not cosmetic: semanticScore is a cosine over embeddings, so two different
   * embedding models produce two different vector spaces and the difference
   * between them is not "the CV got better". Gaps are written by the chat
   * model, so changing it changes their wording and muddies the gap diff. When
   * no same-model pair exists the DTO says so instead of hiding it.
   */
  private pickBaseMatch(
    baseMatches: ScoredMatch[],
    revisionMatch: ScoredMatch | null
  ): ScoredMatch | null {
    if (!revisionMatch) return baseMatches[0] ?? null;
    const sameModels = baseMatches.find(
      (match) =>
        match.chatModel === revisionMatch.chatModel &&
        match.embedModel === revisionMatch.embedModel
    );
    return sameModels ?? baseMatches[0] ?? null;
  }

  private assemble(input: {
    base: DocumentVersionDto;
    revision: DocumentVersionDto;
    jdDocumentId: string | null;
    jdOptions: ComparisonJdOptionDto[];
    baseMatch: ScoredMatch | null;
    revisionMatch: ScoredMatch | null;
  }): CvComparisonDto {
    const dto = new CvComparisonDto();
    dto.base = input.base;
    dto.revision = input.revision;
    dto.jdDocumentId = input.jdDocumentId;
    dto.jdOptions = input.jdOptions;
    dto.baseResult = input.baseMatch ? toSide(input.baseMatch) : null;
    dto.revisionResult = input.revisionMatch
      ? toSide(input.revisionMatch)
      : null;

    if (!input.baseMatch || !input.revisionMatch) {
      // Deliberately null rather than zeroed — see the DTO doc comment.
      dto.delta = null;
      dto.gapDiff = null;
      dto.sameChatModel = true;
      dto.sameEmbedModel = true;
      return dto;
    }

    dto.delta = {
      overall: input.revisionMatch.overallScore - input.baseMatch.overallScore,
      semantic:
        input.revisionMatch.semanticScore - input.baseMatch.semanticScore,
      keyword: input.revisionMatch.keywordScore - input.baseMatch.keywordScore
    };
    dto.gapDiff = diffGaps(
      gapsOf(input.baseMatch.report),
      gapsOf(input.revisionMatch.report)
    );
    dto.sameChatModel =
      input.baseMatch.chatModel === input.revisionMatch.chatModel;
    dto.sameEmbedModel =
      input.baseMatch.embedModel === input.revisionMatch.embedModel;
    return dto;
  }

  /** Walk up the lineage chain, hard capped so bad data cannot loop forever. */
  private async loadAncestors(
    start: Document,
    userId: string
  ): Promise<ParentLookup> {
    const parents: ParentLookup = new Map([[start.id, start.parentId]]);
    let current = start.parentId;
    let steps = 0;
    while (current !== null && steps < MAX_LINEAGE_DEPTH) {
      if (parents.has(current)) break;
      const row: { parentId: string | null } | null =
        await this.prisma.document.findFirst({
          where: { id: current, userId },
          select: { parentId: true }
        });
      if (!row) break;
      parents.set(current, row.parentId);
      current = row.parentId;
      steps += 1;
    }
    return parents;
  }
}
