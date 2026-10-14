import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe
} from "@nestjs/common";
import { tDoc } from "./i18n-messages";
import { DOCX_MIME, PDF_MIME } from "./parsing";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPE_REGEX = new RegExp(`^(${PDF_MIME}|${DOCX_MIME})$`);

export function createUploadFilePipe(): ParseFilePipe {
  return new ParseFilePipe({
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
      // Nest's validator is exclusive (`size < maxSize`); the client accepts
      // `size <= 10 MB`, so the boundary file itself must pass here too.
      new MaxFileSizeValidator({
        maxSize: MAX_FILE_SIZE_BYTES + 1,
        errorMessage: () =>
          tDoc(
            "documents.errors.fileTooLarge",
            "File is too large. Maximum size is 10MB."
          )
      })
    ]
  });
}
