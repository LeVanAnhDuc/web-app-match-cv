import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { DocumentKind } from "@prisma/client";

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined) return undefined;
  return value === true || value === "true";
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ enum: DocumentKind })
  @IsOptional()
  @IsEnum(DocumentKind)
  kind?: DocumentKind;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  saved?: boolean;
}
