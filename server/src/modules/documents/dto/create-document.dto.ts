import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { DocumentKind } from "@prisma/client";
import { tDoc } from "../i18n-messages";

function toBoolean({ value }: { value: unknown }): boolean {
  return value === true || value === "true";
}

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentKind })
  @IsEnum(DocumentKind, {
    message: () =>
      tDoc("documents.errors.invalidKind", "Document kind must be CV or JD.")
  })
  kind: DocumentKind;

  @ApiProperty({
    type: Boolean,
    description: "Whether to persist this document for later reuse."
  })
  @Transform(toBoolean)
  @IsBoolean()
  save: boolean;

  @ApiPropertyOptional({
    description: "Required when save=true."
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: () =>
      tDoc(
        "documents.errors.titleTooLong",
        "Title must be at most 200 characters."
      )
  })
  title?: string;

  @ApiPropertyOptional({
    description: "Pasted text content — used when no file is uploaded."
  })
  @IsOptional()
  @IsString()
  // explicit paste-size ceiling (security review) — not the implicit body-parser default
  @MaxLength(100_000, {
    message: () =>
      tDoc(
        "documents.errors.textTooLong",
        "Pasted text must be at most 100,000 characters."
      )
  })
  sourceText?: string;
}
