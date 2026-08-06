import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { DocumentDto } from "./dto/document.dto";
import { DocumentSummaryDto } from "./dto/document-summary.dto";
import { ListDocumentsQueryDto } from "./dto/list-documents-query.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { tDoc } from "./i18n-messages";
import { DOCX_MIME, PDF_MIME } from "./parsing";
import { DocumentsService } from "./documents.service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPE_REGEX = new RegExp(`^(${PDF_MIME}|${DOCX_MIME})$`);

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiCreatedResponse({ type: DocumentDto })
  @UseInterceptors(FileInterceptor("file"))
  async create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new FileTypeValidator({
            fileType: ALLOWED_FILE_TYPE_REGEX,
            skipMagicNumbersValidation: true,
            errorMessage: () =>
              tDoc(
                "documents.errors.unsupportedFileType",
                "Unsupported file type. Only PDF and DOCX are allowed."
              )
          }),
          new MaxFileSizeValidator({
            maxSize: MAX_FILE_SIZE_BYTES,
            errorMessage: () =>
              tDoc(
                "documents.errors.fileTooLarge",
                "File is too large. Maximum size is 10MB."
              )
          })
        ]
      })
    )
    file?: Express.Multer.File
  ): Promise<DocumentDto> {
    return this.documentsService.create(dto, file);
  }

  @Get()
  @ApiOkResponse({ type: [DocumentSummaryDto] })
  async list(
    @Query() query: ListDocumentsQueryDto
  ): Promise<DocumentSummaryDto[]> {
    return this.documentsService.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: DocumentDto })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<DocumentDto> {
    return this.documentsService.findOne(id);
  }

  @Patch(":id")
  @ApiOkResponse({ type: DocumentDto })
  async rename(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDocumentDto
  ): Promise<DocumentDto> {
    return this.documentsService.rename(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.documentsService.remove(id);
  }

  @Get(":id/file")
  async file(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("download") download: string | undefined,
    @Res({ passthrough: true }) res: import("express").Response
  ): Promise<StreamableFile> {
    const { buffer, mime, filename } = await this.documentsService.getFile(id);
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `${download === "1" ? "attachment" : "inline"}; filename="${filename}"`
    );
    return new StreamableFile(buffer);
  }
}
