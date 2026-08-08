import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class CreateMatchDto {
  @ApiProperty({
    description:
      "id of a saved/transient Document with kind=CV, owned by the current user"
  })
  @IsUUID()
  cvDocumentId: string;

  @ApiProperty({
    description:
      "id of a saved/transient Document with kind=JD, owned by the current user"
  })
  @IsUUID()
  jdDocumentId: string;

  @ApiProperty({
    required: false,
    description:
      "id of one of the current user's AiCredentials. Omit to run on the system key."
  })
  @IsOptional()
  @IsUUID()
  credentialId?: string;
}
