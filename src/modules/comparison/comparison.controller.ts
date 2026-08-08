import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ComparisonQueryDto } from "./dto/comparison-query.dto";
import { CvComparisonDto } from "./dto/cv-comparison.dto";
import { ComparisonService } from "./comparison.service";

@ApiTags("comparisons")
@Controller("comparisons")
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  /**
   * `:documentId` is the NEWER version; the older one is always its `parentId`.
   * That is the whole point of ADR #15 — letting the caller pass both sides
   * would reopen the "compare any two results" design the goal spec rejected,
   * because then the system no longer knows which one is the improvement.
   *
   * No AI call, no throttle beyond the global one.
   */
  @Get(":documentId")
  @ApiOkResponse({ type: CvComparisonDto })
  async compare(
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
    @Query() query: ComparisonQueryDto
  ): Promise<CvComparisonDto> {
    return this.comparisonService.compare(documentId, query);
  }
}
