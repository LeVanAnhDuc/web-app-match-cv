import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class GenerateCvRewriteDto {
  @ApiProperty({
    description:
      "id of one of your succeeded MatchResults — its gaps and suggestions drive the rewrite"
  })
  @IsUUID()
  matchResultId: string;

  @ApiProperty({
    required: false,
    description:
      "id of one of your AiCredentials. Omit to run on the system key."
  })
  @IsOptional()
  @IsUUID()
  credentialId?: string;
}
