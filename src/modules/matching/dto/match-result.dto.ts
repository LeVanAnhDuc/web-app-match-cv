import { ApiProperty } from "@nestjs/swagger";
import { MatchResult } from "@prisma/client";

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
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
