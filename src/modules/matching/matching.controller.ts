import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CreateMatchDto } from "./dto/create-match.dto";
import { CreateMatchRunDto } from "./dto/create-match-run.dto";
import { MatchRunDetailDto } from "./dto/match-run-detail.dto";
import { MatchRunDto } from "./dto/match-run.dto";
import { MatchResultDto } from "./dto/match-result.dto";
import { MatchSummaryDto } from "./dto/match-summary.dto";
import { MatchingService } from "./matching.service";

@ApiTags("match")
@Controller("match")
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  @ApiCreatedResponse({ type: MatchResultDto })
  async create(@Body() dto: CreateMatchDto): Promise<MatchResultDto> {
    return this.matchingService.createMatch(dto);
  }

  @Post("runs")
  @ApiCreatedResponse({ type: MatchRunDto })
  async createRun(@Body() dto: CreateMatchRunDto): Promise<MatchRunDto> {
    return this.matchingService.createRun(dto);
  }

  // Declared BEFORE the ":id" route so "runs" is not captured as a match id.
  @Get("runs/:id")
  @ApiOkResponse({ type: MatchRunDetailDto })
  async findRun(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<MatchRunDetailDto> {
    return this.matchingService.getRun(id);
  }

  @Get()
  @ApiOkResponse({ type: [MatchSummaryDto] })
  async list(): Promise<MatchSummaryDto[]> {
    return this.matchingService.list();
  }

  @Get(":id")
  @ApiOkResponse({ type: MatchResultDto })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<MatchResultDto> {
    return this.matchingService.getById(id);
  }
}
