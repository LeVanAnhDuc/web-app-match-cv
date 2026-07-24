import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentDto } from './dto/document.dto';
import { DocumentSummaryDto } from './dto/document-summary.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { tDoc } from './i18n-messages';
import { DOCX_MIME, PDF_MIME } from './parsing';
import { DocumentsService } from './documents.service';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPE_REGEX = new RegExp(`^(${PDF_MIME}|${DOCX_MIME})$`);

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiCreatedResponse({ type: DocumentDto })
  @UseInterceptors(FileInterceptor('file'))
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
                'documents.errors.unsupportedFileType',
                'Unsupported file type. Only PDF and DOCX are allowed.',
              ),
          }),
          new MaxFileSizeValidator({
            maxSize: MAX_FILE_SIZE_BYTES,
            errorMessage: () =>
              tDoc(
                'documents.errors.fileTooLarge',
                'File is too large. Maximum size is 10MB.',
              ),
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    return this.documentsService.create(dto, file);
  }

  @Get()
  @ApiOkResponse({ type: [DocumentSummaryDto] })
  async list(
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentSummaryDto[]> {
    return this.documentsService.list(query);
  }
}
