import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

/**
 * Opens a run. Deliberately carries no provider list: the client fires one
 * `POST /match` per provider afterwards, so the server never has to fan out
 * or track how many are still in flight (ADR #11).
 */
export class CreateMatchRunDto {
  @ApiProperty({ description: "id of a Document with kind=CV, owned by you" })
  @IsUUID()
  cvDocumentId: string;

  @ApiProperty({ description: "id of a Document with kind=JD, owned by you" })
  @IsUUID()
  jdDocumentId: string;
}
