import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { SourceFormat } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MAX_LINEAGE_DEPTH,
  wouldCreateCycle,
  type ParentLookup
} from "../comparison/lineage";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { DocumentDto } from "./dto/document.dto";
import { DocumentSummaryDto } from "./dto/document-summary.dto";
import { ListDocumentsQueryDto } from "./dto/list-documents-query.dto";
import { SetDocumentParentDto } from "./dto/set-document-parent.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { tDoc } from "./i18n-messages";
import { parseFile } from "./parsing";

const TITLE_FALLBACK_LENGTH = 80;

function deriveTitle(rawText: string): string {
  const firstLine = rawText
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  const candidate = (firstLine ?? rawText).trim();
  if (!candidate) return "Untitled";
  return candidate.length > TITLE_FALLBACK_LENGTH
    ? `${candidate.slice(0, TITLE_FALLBACK_LENGTH)}…`
    : candidate;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService
  ) {}

  async create(
    dto: CreateDocumentDto,
    file?: Express.Multer.File
  ): Promise<DocumentDto> {
    const trimmedTitle = dto.title?.trim();

    if (dto.save && !trimmedTitle) {
      throw new BadRequestException(
        tDoc(
          "documents.errors.titleRequiredWhenSaving",
          "Title is required when saving a document."
        )
      );
    }

    let rawText: string;
    let sourceFormat: SourceFormat;

    if (file) {
      const parsed = await parseFile(file.buffer, file.mimetype);
      rawText = parsed.rawText;
      sourceFormat = parsed.sourceFormat;
    } else {
      const pasted = dto.sourceText?.trim();
      if (!pasted) {
        throw new BadRequestException(
          tDoc("documents.errors.emptyText", "Provide a file or pasted text.")
        );
      }
      rawText = pasted;
      sourceFormat = SourceFormat.text;
    }

    const userId = this.currentUser.getUserId();
    const created = await this.prisma.document.create({
      data: {
        userId,
        kind: dto.kind,
        title: trimmedTitle || deriveTitle(rawText),
        sourceFormat,
        rawText,
        isSaved: dto.save,
        fileData: file ? Buffer.from(file.buffer) : null,
        fileMime: file ? file.mimetype : null
      }
    });

    return DocumentDto.fromEntity(created);
  }

  async getFile(
    id: string
  ): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({
      where: { id, userId }
    });
    if (!doc || !doc.fileData || !doc.fileMime) {
      throw new NotFoundException(
        tDoc(
          "documents.errors.noOriginalFile",
          "No original file for this document."
        )
      );
    }
    const ext = doc.fileMime.includes("pdf") ? "pdf" : "docx";
    const safeTitle =
      doc.title.replace(/[^\w.-]+/g, "_").slice(0, 100) || "document";
    return {
      buffer: Buffer.from(doc.fileData),
      mime: doc.fileMime,
      filename: `${safeTitle}.${ext}`
    };
  }

  async list(query: ListDocumentsQueryDto): Promise<DocumentSummaryDto[]> {
    const userId = this.currentUser.getUserId();
    const docs = await this.prisma.document.findMany({
      where: {
        userId,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.saved !== undefined ? { isSaved: query.saved } : {})
      },
      orderBy: { createdAt: "desc" }
    });
    return docs.map((doc) => DocumentSummaryDto.fromEntity(doc));
  }

  async findOne(id: string): Promise<DocumentDto> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({
      where: { id, userId }
    });
    if (!doc) {
      throw new NotFoundException(
        tDoc("documents.errors.notFound", "Document not found.")
      );
    }
    return DocumentDto.fromEntity(doc);
  }

  async rename(id: string, dto: UpdateDocumentDto): Promise<DocumentDto> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({
      where: { id, userId }
    });
    if (!doc) {
      throw new NotFoundException(
        tDoc("documents.errors.notFound", "Document not found.")
      );
    }
    const updated = await this.prisma.document.update({
      where: { id },
      data: { title: dto.title }
    });
    return DocumentDto.fromEntity(updated);
  }

  /**
   * Declare (or clear) which document this one is a newer version of — the
   * manual half of Goal 9's lineage, so a hand-edited CV gets the same link the
   * rewrite assistant creates automatically (ADR #15).
   *
   * A cycle would make the version walk and every future ancestor query
   * non-terminating, so it is rejected here rather than defended against
   * downstream: the column permits one, the write path must not.
   */
  async setParent(id: string, dto: SetDocumentParentDto): Promise<DocumentDto> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) {
      throw new NotFoundException(
        tDoc("documents.errors.notFound", "Document not found.")
      );
    }

    if (dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException(
          tDoc(
            "documents.errors.lineageSelf",
            "A document cannot be a version of itself."
          )
        );
      }
      const parent = await this.prisma.document.findFirst({
        where: { id: dto.parentId, userId }
      });
      // 400, not 404: the id in the path exists — the body is what is wrong.
      // It also keeps another user's document indistinguishable from a
      // non-existent one.
      if (!parent) {
        throw new BadRequestException(
          tDoc(
            "documents.errors.lineageParentNotFound",
            "The document you picked as the previous version was not found."
          )
        );
      }
      if (parent.kind !== doc.kind) {
        throw new BadRequestException(
          tDoc(
            "documents.errors.lineageKindMismatch",
            "A CV can only be a version of another CV, and a JD of another JD."
          )
        );
      }
      const { parents, complete } = await this.loadAncestors(
        dto.parentId,
        userId
      );
      // FAIL CLOSED on a truncated walk. A chain longer than the cap looks
      // exactly like a chain that ended at a root — every lookup past the cap
      // is simply absent from the map — so "no cycle found" would be a
      // statement about how far we looked, not about the data. Without this,
      // building a 21-link chain and then closing it is a supported operation.
      if (!complete) {
        throw new BadRequestException(
          tDoc(
            "documents.errors.lineageTooDeep",
            "This version history is too long to extend safely."
          )
        );
      }
      if (wouldCreateCycle(id, dto.parentId, parents)) {
        throw new BadRequestException(
          tDoc(
            "documents.errors.lineageCycle",
            "That would make the two documents versions of each other."
          )
        );
      }
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { parentId: dto.parentId }
    });
    return DocumentDto.fromEntity(updated);
  }

  /**
   * Walk up from `startId`, collecting id → parentId. Hard capped, so already
   * corrupted data cannot turn this into an unbounded query loop.
   *
   * `complete` says whether the walk reached an end (a root, a missing row, or
   * a loop already in the data) rather than hitting the cap. Callers that make
   * a SAFETY decision from the result must refuse to act when it is false —
   * see setParent.
   */
  private async loadAncestors(
    startId: string,
    userId: string
  ): Promise<{ parents: ParentLookup; complete: boolean }> {
    const parents: ParentLookup = new Map();
    let current: string | null = startId;
    let steps = 0;
    while (current !== null) {
      if (steps >= MAX_LINEAGE_DEPTH) return { parents, complete: false };
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
    return { parents, complete: true };
  }

  async remove(id: string): Promise<void> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({
      where: { id, userId }
    });
    if (!doc) {
      throw new NotFoundException(
        tDoc("documents.errors.notFound", "Document not found.")
      );
    }
    const refCount = await this.prisma.matchResult.count({
      where: { OR: [{ cvDocumentId: id }, { jdDocumentId: id }] }
    });
    if (refCount > 0) {
      throw new ConflictException(
        tDoc(
          "documents.errors.inUseByMatch",
          "Cannot delete: used in a match history."
        )
      );
    }
    await this.prisma.document.delete({ where: { id } });
  }
}
