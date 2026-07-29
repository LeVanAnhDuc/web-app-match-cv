import {
  BadRequestException,
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
        isSaved: dto.save
      }
    });

    return DocumentDto.fromEntity(created);
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
}
