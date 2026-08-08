import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

// Matches the source cap: anything longer than a whole CV was pasted by
// accident, not written as a letter.
export const CONTENT_MAX_LENGTH = 20_000;

/**
 * Only `content` is editable. Changing tone/length/language means generating
 * a new letter, not relabelling an existing piece of text.
 */
export class UpdateCoverLetterDto {
  @ApiProperty({ description: "Edited letter body, plain text." })
  @IsString()
  @Length(1, CONTENT_MAX_LENGTH)
  content: string;
}
