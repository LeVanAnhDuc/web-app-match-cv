import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

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
}
