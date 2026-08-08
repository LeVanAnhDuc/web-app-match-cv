import { ApiProperty } from "@nestjs/swagger";
import {
  CoverLetterLanguage,
  CoverLetterLength,
  CoverLetterTone
} from "@prisma/client";
import { IsEnum, IsOptional, IsUUID } from "class-validator";

export class CreateCoverLetterDto {
  @ApiProperty({
    description:
      "The succeeded MatchResult this letter is written from. Its report supplies both the material (strengths) and the forbidden list (gaps)."
  })
  @IsUUID()
  matchResultId: string;

  @ApiProperty({ enum: CoverLetterTone })
  @IsEnum(CoverLetterTone)
  tone: CoverLetterTone;

  @ApiProperty({ enum: CoverLetterLength })
  @IsEnum(CoverLetterLength)
  length: CoverLetterLength;

  @ApiProperty({
    enum: CoverLetterLanguage,
    description: "Language the letter is written in — not the UI language."
  })
  @IsEnum(CoverLetterLanguage)
  language: CoverLetterLanguage;

  @ApiProperty({
    required: false,
    description: "Omit to run on the system key."
  })
  @IsOptional()
  @IsUUID()
  credentialId?: string;
}
