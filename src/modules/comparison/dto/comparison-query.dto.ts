import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class ComparisonQueryDto {
  @ApiPropertyOptional({
    description:
      "Which job description to compare on. Omitted, the server picks the most recent one both versions were matched against."
  })
  @IsOptional()
  @IsUUID()
  jdDocumentId?: string;
}
