import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  DocumentKind,
  MatchStatus,
  SourceFormat,
  type Document,
  type MatchResult
} from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { AiCredentialsService } from "../ai-credentials/ai-credentials.service";
import { capForMatch } from "../matching/matching.service";
import { DocumentDto } from "../documents/dto/document.dto";
import { AcceptCvRewriteDto } from "./dto/accept-cv-rewrite.dto";
import { CvRewriteProposalDto } from "./dto/cv-rewrite-proposal.dto";
import { GenerateCvRewriteDto } from "./dto/generate-cv-rewrite.dto";
import {
  applyChanges,
  clipGaps,
  groundChanges,
  type ApplyFailure
} from "./grounding";
import { tRewrite } from "./i18n-messages";

interface StoredReport {
  gaps?: unknown;
  suggestions?: unknown;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/**
 * Turns a match report into a set of PROPOSED edits to the CV, and — once the
 * user has approved a subset of them — into a NEW Document.
 *
 * Two rules run through everything here:
 *
 * - The original CV is never touched (ADR #13). The accepted rewrite is always
 *   a new row, linked back with `parentId` (ADR #15).
 * - Nothing the model says is trusted. Every change must anchor to a verbatim,
 *   unique excerpt of the stored CV — checked when the proposal is built and
 *   checked again, from the database, when it is accepted.
 */
@Injectable()
export class CvRewriteService {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
    private readonly credentials: AiCredentialsService
  ) {}

  /** The match, and the CV it scored, must both belong to the caller. */
  private async requireOwnedMatch(
    matchResultId: string
  ): Promise<{ match: MatchResult; cvDoc: Document; jdDoc: Document }> {
    const userId = this.currentUser.getUserId();
    const match = await this.prisma.matchResult.findFirst({
      where: { id: matchResultId, userId }
    });
    if (!match) {
      throw new NotFoundException(
        tRewrite("cvRewrite.errors.matchNotFound", "Match result not found.")
      );
    }
    // Only a succeeded match carries the gaps/suggestions this works from;
    // anything else would spend an AI call on an empty brief.
    if (match.status !== MatchStatus.succeeded) {
      throw new BadRequestException(
        tRewrite(
          "cvRewrite.errors.matchFailed",
          "This match did not produce a report, so there is nothing to rewrite."
        )
      );
    }

    const [cvDoc, jdDoc] = await Promise.all([
      this.prisma.document.findFirst({
        where: { id: match.cvDocumentId, userId }
      }),
      this.prisma.document.findFirst({
        where: { id: match.jdDocumentId, userId }
      })
    ]);
    if (!cvDoc || !jdDoc) {
      throw new NotFoundException(
        tRewrite("cvRewrite.errors.matchNotFound", "Match result not found.")
      );
    }
    return { match, cvDoc, jdDoc };
  }

  async generate(dto: GenerateCvRewriteDto): Promise<CvRewriteProposalDto> {
    const { match, cvDoc, jdDoc } = await this.requireOwnedMatch(
      dto.matchResultId
    );

    // Same credential resolution as /match — no second path to a user secret.
    const runtime = dto.credentialId
      ? await this.credentials.getRuntimeConfig(dto.credentialId)
      : this.ai.systemRuntimeConfig();

    const report = (match.report ?? {}) as StoredReport;
    const raw = await this.ai.generateCvRewrite(
      capForMatch(cvDoc.rawText),
      capForMatch(jdDoc.rawText),
      toStringArray(report.gaps),
      toStringArray(report.suggestions),
      runtime
    );

    // Audit stamp, deliberately outside the read path (same reasoning as
    // MatchingService): a failed timestamp update must not lose a proposal the
    // user already paid an AI call for.
    if (dto.credentialId) await this.credentials.markUsed(dto.credentialId);

    return CvRewriteProposalDto.from({
      matchResultId: match.id,
      cvDocumentId: cvDoc.id,
      cvTitle: cvDoc.title,
      provider: runtime.provider,
      chatModel: runtime.chatModel,
      // Anything the model invented, quoted ambiguously or blew up in size is
      // dropped here — a fabrication never reaches the approval list.
      changes: groundChanges(cvDoc.rawText, raw.changes),
      unaddressedGaps: clipGaps(raw.unaddressedGaps)
    });
  }

  private applyFailureError(reason: ApplyFailure): BadRequestException {
    if (reason === "overlapping") {
      return new BadRequestException(
        tRewrite(
          "cvRewrite.errors.changesOverlap",
          "Two approved changes edit the same part of the CV."
        )
      );
    }
    if (reason === "too_long") {
      return new BadRequestException(
        tRewrite(
          "cvRewrite.errors.changeTooLong",
          "A suggested replacement is far longer than the text it replaces."
        )
      );
    }
    if (reason === "empty_result") {
      return new BadRequestException(
        tRewrite(
          "cvRewrite.errors.emptyResult",
          "Applying these changes would leave the CV empty."
        )
      );
    }
    return new BadRequestException(
      tRewrite(
        "cvRewrite.errors.changeNotGrounded",
        "One of the approved changes no longer matches the original CV. Generate the suggestions again."
      )
    );
  }

  async accept(dto: AcceptCvRewriteDto): Promise<DocumentDto> {
    const { cvDoc } = await this.requireOwnedMatch(dto.matchResultId);

    // The proposal was never stored, so the client sends the approved subset
    // back. It is re-checked against the CV IN THE DATABASE: a caller cannot
    // graft in text that was never anchored to the real CV.
    const applied = applyChanges(cvDoc.rawText, dto.changes);
    if (!applied.ok) throw this.applyFailureError(applied.reason);

    const created = await this.prisma.document.create({
      data: {
        userId: cvDoc.userId,
        kind: DocumentKind.CV,
        title: dto.title.trim(),
        // The rewrite is text. The parent's PDF/DOCX is deliberately NOT
        // copied: that file no longer says what this document says, and
        // handing it back on download would be a lie.
        sourceFormat: SourceFormat.text,
        rawText: applied.text,
        isSaved: true,
        parentId: cvDoc.id
      }
    });

    return DocumentDto.fromEntity(created);
  }
}
