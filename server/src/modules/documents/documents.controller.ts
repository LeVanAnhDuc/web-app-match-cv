import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { AllowGuest } from "../auth/decorators";
import { contentDisposition } from "./content-disposition";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { DocumentDto } from "./dto/document.dto";
import { DocumentSummaryDto } from "./dto/document-summary.dto";
import { ListDocumentsQueryDto } from "./dto/list-documents-query.dto";
import { SetDocumentParentDto } from "./dto/set-document-parent.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { DocumentsService } from "./documents.service";
import { createUploadFilePipe } from "./upload-file-pipe";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @AllowGuest({ createGuest: true })
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiCreatedResponse({ type: DocumentDto })
  @UseInterceptors(FileInterceptor("file"))
  async create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile(createUploadFilePipe())
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
  @AllowGuest()
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

  // A sub-resource so the rename contract above stays untouched.
  @Patch(":id/parent")
  @ApiOkResponse({ type: DocumentDto })
  async setParent(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: SetDocumentParentDto
  ): Promise<DocumentDto> {
    return this.documentsService.setParent(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.documentsService.remove(id);
  }

  @Get(":id/file")
  @AllowGuest()
  async file(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("download") download: string | undefined,
    @Res({ passthrough: true }) res: import("express").Response
  ): Promise<StreamableFile> {
    const { buffer, mime, filename, utf8Filename } =
      await this.documentsService.getFile(id);
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      contentDisposition(
        download === "1" ? "attachment" : "inline",
        filename,
        utf8Filename
      )
    );
    return new StreamableFile(buffer);
  }
}
