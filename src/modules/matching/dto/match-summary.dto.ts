import { ApiProperty } from "@nestjs/swagger";

export class MatchSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() cvTitle!: string;
  @ApiProperty() jdTitle!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty() createdAt!: string;

  static fromEntity(e: {
    id: string;
    overallScore: number;
    createdAt: Date;
    cvDocument: { title: string };
    jdDocument: { title: string };
  }): MatchSummaryDto {
    const dto = new MatchSummaryDto();
    dto.id = e.id;
    dto.cvTitle = e.cvDocument.title;
    dto.jdTitle = e.jdDocument.title;
    dto.overallScore = e.overallScore;
    dto.createdAt = e.createdAt.toISOString();
    return dto;
  }
}
