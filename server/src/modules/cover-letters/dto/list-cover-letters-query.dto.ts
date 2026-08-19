import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

/**
 * `matchResultId` is required on purpose. There is no screen that wants
 * "every letter I ever generated", and an unscoped listing would be a read
 * surface with no consumer.
 */
export class ListCoverLettersQueryDto {
  @ApiProperty({ description: "Only letters generated from this match." })
  @IsUUID()
  matchResultId: string;
}
