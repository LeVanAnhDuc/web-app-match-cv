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

function toBoolean({ value }: { value: unknown }): boolean {
  return value === true || value === "true";
}

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentKind })
  @IsEnum(DocumentKind)
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
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: "Pasted text content — used when no file is uploaded."
  })
  @IsOptional()
  @IsString()
  @MaxLength(100_000) // explicit paste-size ceiling (security review) — not the implicit body-parser default
  sourceText?: string;
}
