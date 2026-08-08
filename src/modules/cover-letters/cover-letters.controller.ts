import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";
import { CoverLettersService } from "./cover-letters.service";
import { CoverLetterDto } from "./dto/cover-letter.dto";
import { CreateCoverLetterDto } from "./dto/create-cover-letter.dto";
import { ListCoverLettersQueryDto } from "./dto/list-cover-letters-query.dto";
import { UpdateCoverLetterDto } from "./dto/update-cover-letter.dto";

// Tighter than the global 100/60s: every call here spends AI budget on a full
// CV + JD. Same reasoning as the credential test endpoint.
const GENERATE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("cover-letters")
@Controller("cover-letters")
export class CoverLettersController {
  constructor(private readonly service: CoverLettersService) {}

  @Post()
  @Throttle(GENERATE_THROTTLE)
  @ApiCreatedResponse({
    type: CoverLetterDto,
    description:
      "Also 201 when the provider failed — the row carries status=failed and an errorCode."
  })
  @ApiNotFoundResponse({ description: "Match or credential not owned by you" })
  @ApiBadRequestResponse({ description: "The match produced no report" })
  async generate(@Body() dto: CreateCoverLetterDto): Promise<CoverLetterDto> {
    return this.service.generate(dto);
  }

  @Get()
  @ApiOkResponse({ type: [CoverLetterDto] })
  async list(
    @Query() query: ListCoverLettersQueryDto
  ): Promise<CoverLetterDto[]> {
    return this.service.list(query);
  }

  @Patch(":id")
  @ApiOkResponse({ type: CoverLetterDto })
  @ApiNotFoundResponse({ description: "Not found or not owned by you" })
  @ApiBadRequestResponse({ description: "The letter failed to generate" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCoverLetterDto
  ): Promise<CoverLetterDto> {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Not found or not owned by you" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
