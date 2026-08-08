import { ApiProperty } from "@nestjs/swagger";
import { MatchResult, MatchRun } from "@prisma/client";
import { MatchResultDto } from "./match-result.dto";

/**
 * A run plus whatever results exist **so far**. Fewer results than the user
 * selected is a valid, expected state: reloading mid-run shows exactly the
 * providers that had already finished (`erd.md`).
 */
export class MatchRunDetailDto {
  @ApiProperty() id: string;
  @ApiProperty() cvDocumentId: string;
  @ApiProperty() jdDocumentId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [MatchResultDto] }) results: MatchResultDto[];

  static fromEntity(
    entity: MatchRun & { results: MatchResult[] }
  ): MatchRunDetailDto {
    const dto = new MatchRunDetailDto();
    dto.id = entity.id;
    dto.cvDocumentId = entity.cvDocumentId;
    dto.jdDocumentId = entity.jdDocumentId;
    dto.createdAt = entity.createdAt;
    dto.results = entity.results.map((r) => MatchResultDto.fromEntity(r));
    return dto;
  }
}
