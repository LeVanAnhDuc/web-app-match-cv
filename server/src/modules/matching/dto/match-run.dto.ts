import { ApiProperty } from "@nestjs/swagger";
import { MatchRun } from "@prisma/client";

export class MatchRunDto {
  @ApiProperty() id: string;
  @ApiProperty() cvDocumentId: string;
  @ApiProperty() jdDocumentId: string;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: MatchRun): MatchRunDto {
    const dto = new MatchRunDto();
    dto.id = entity.id;
    dto.cvDocumentId = entity.cvDocumentId;
    dto.jdDocumentId = entity.jdDocumentId;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
