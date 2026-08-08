import { ApiProperty } from "@nestjs/swagger";
import { AiProvider, MatchResult } from "@prisma/client";

export class MatchReportDto {
  @ApiProperty({ type: [String] }) strengths: string[];
  @ApiProperty({ type: [String] }) gaps: string[];
  @ApiProperty({ type: [String] }) suggestions: string[];
}

export class MatchResultDto {
  @ApiProperty() id: string;
  @ApiProperty() cvDocumentId: string;
  @ApiProperty() jdDocumentId: string;
  @ApiProperty() overallScore: number;
  @ApiProperty() semanticScore: number;
  @ApiProperty() keywordScore: number;
  @ApiProperty({ type: MatchReportDto }) report: MatchReportDto;

  // Snapshot of which AI produced this result. Kept on the row rather than
  // derived from the credential, so the record stays readable after the
  // credential is re-pointed at another model or deleted.
  @ApiProperty({
    nullable: true,
    description: "null means the system key was used"
  })
  credentialId: string | null;
  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() chatModel: string;
  @ApiProperty() embedModel: string;

  @ApiProperty() createdAt: Date;

  static fromEntity(entity: MatchResult): MatchResultDto {
    const dto = new MatchResultDto();
    dto.id = entity.id;
    dto.cvDocumentId = entity.cvDocumentId;
    dto.jdDocumentId = entity.jdDocumentId;
    dto.overallScore = entity.overallScore;
    dto.semanticScore = entity.semanticScore;
    dto.keywordScore = entity.keywordScore;
    dto.report = entity.report as unknown as MatchReportDto;
    dto.credentialId = entity.credentialId;
    dto.provider = entity.provider;
    dto.chatModel = entity.chatModel;
    dto.embedModel = entity.embedModel;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
