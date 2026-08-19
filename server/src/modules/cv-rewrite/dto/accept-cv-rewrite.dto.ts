import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  Length,
  ValidateNested
} from "class-validator";
import { MAX_CHANGES, MAX_REPLACEMENT_CHARS } from "../grounding";

// Anchors can legitimately be a long paragraph; this is only a payload bound,
// the real check is that the excerpt exists verbatim in the CV.
const MAX_ANCHOR_CHARS = 5_000;

export class AcceptedChangeDto {
  @ApiProperty({
    description:
      "Excerpt of the ORIGINAL CV this change replaces. Re-verified server-side: it must occur verbatim and exactly once."
  })
  @IsString()
  @Length(1, MAX_ANCHOR_CHARS)
  original: string;

  @ApiProperty({
    description: "Replacement text. Empty string means: remove this excerpt."
  })
  @IsString()
  @Length(0, MAX_REPLACEMENT_CHARS)
  replacement: string;
}

export class AcceptCvRewriteDto {
  @ApiProperty()
  @IsUUID()
  matchResultId: string;

  @ApiProperty({ description: "Title of the new CV document." })
  // Trimmed BEFORE the length check, or a whitespace-only title passes
  // validation and lands in the database as an empty one.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({
    type: [AcceptedChangeDto],
    description: "Only the changes the user approved."
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CHANGES)
  @ValidateNested({ each: true })
  @Type(() => AcceptedChangeDto)
  changes: AcceptedChangeDto[];
}
