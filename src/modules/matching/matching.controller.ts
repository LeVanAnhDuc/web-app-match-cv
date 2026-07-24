import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchResultDto } from './dto/match-result.dto';
import { MatchingService } from './matching.service';

@ApiTags('match')
@Controller('match')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  @ApiCreatedResponse({ type: MatchResultDto })
  async create(@Body() dto: CreateMatchDto): Promise<MatchResultDto> {
    return this.matchingService.createMatch(dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: MatchResultDto })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MatchResultDto> {
    return this.matchingService.getById(id);
  }
}
