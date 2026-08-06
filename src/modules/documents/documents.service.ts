import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { SourceFormat } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { DocumentDto } from "./dto/document.dto";
import { DocumentSummaryDto } from "./dto/document-summary.dto";
import { ListDocumentsQueryDto } from "./dto/list-documents-query.dto";
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
