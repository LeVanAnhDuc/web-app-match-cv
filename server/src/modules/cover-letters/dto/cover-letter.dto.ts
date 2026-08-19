import { ApiProperty } from "@nestjs/swagger";
import {
  AiProvider,
  CoverLetter,
  CoverLetterLanguage,
  CoverLetterLength,
  CoverLetterStatus,
  CoverLetterTone
} from "@prisma/client";

/**
 * Read model for a generated letter.
 *
 * Carries `credentialId` and the provider/model snapshot, and nothing else
 * about the credential — the key columns never leave the service layer.
 */
export class CoverLetterDto {
  @ApiProperty() id: string;
  @ApiProperty() matchResultId: string;
  @ApiProperty({ enum: CoverLetterTone }) tone: CoverLetterTone;
  @ApiProperty({ enum: CoverLetterLength }) length: CoverLetterLength;
  @ApiProperty({ enum: CoverLetterLanguage }) language: CoverLetterLanguage;

  @ApiProperty({ description: "Plain text. Empty when status=failed." })
  content: string;

  @ApiProperty({
    type: [String],
    description:
      "Job requirements the model declined to claim because the CV does not support them (ADR #13)."
  })
  omittedRequirements: string[];

  @ApiProperty({ enum: CoverLetterStatus }) status: CoverLetterStatus;

  @ApiProperty({
    nullable: true,
    description:
      "Only when status=failed. Closed set: invalid_key | no_quota | model_unavailable | timeout | unreachable. Never a provider message.",
    example: "no_quota"
  })
  errorCode: string | null;

  @ApiProperty({ description: "True once the user edited the draft." })
  edited: boolean;

  @ApiProperty({
    nullable: true,
    description: "null means the system key was used"
  })
  credentialId: string | null;

  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() chatModel: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: CoverLetter): CoverLetterDto {
    const dto = new CoverLetterDto();
    dto.id = entity.id;
    dto.matchResultId = entity.matchResultId;
    dto.tone = entity.tone;
    dto.length = entity.length;
    dto.language = entity.language;
    dto.content = entity.content;
    dto.omittedRequirements = entity.omittedRequirements;
    dto.status = entity.status;
    dto.errorCode = entity.errorCode;
    dto.edited = entity.edited;
    dto.credentialId = entity.credentialId;
    dto.provider = entity.provider;
    dto.chatModel = entity.chatModel;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
