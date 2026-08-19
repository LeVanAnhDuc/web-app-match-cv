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
  Post
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags
} from "@nestjs/swagger";
import { AiCredentialsService } from "./ai-credentials.service";
import { AiCredentialDto } from "./dto/ai-credential.dto";
import { CreateAiCredentialDto } from "./dto/create-ai-credential.dto";
import { ProviderInfoDto } from "./dto/provider-info.dto";
import { TestResultDto } from "./dto/test-result.dto";
import { UpdateAiCredentialDto } from "./dto/update-ai-credential.dto";

// Tighter than the global 100/60s: this endpoint spends the user's provider
// quota, and without a cap the app would work as a key-validation oracle.
const TEST_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("ai-credentials")
@Controller("ai-credentials")
export class AiCredentialsController {
  constructor(private readonly service: AiCredentialsService) {}

  // Declared BEFORE the ":id" routes so "providers" is not captured as an id.
  @Get("providers")
  @ApiOkResponse({ type: [ProviderInfoDto] })
  listProviders(): ProviderInfoDto[] {
    return this.service.listProviders();
  }

  @Get()
  @ApiOkResponse({ type: [AiCredentialDto] })
  @ApiServiceUnavailableResponse({
    description: "Credential encryption is not configured"
  })
  async list(): Promise<AiCredentialDto[]> {
    return this.service.list();
  }

  @Post()
  @ApiCreatedResponse({ type: AiCredentialDto })
  @ApiConflictResponse({ description: "Label already used by this user" })
  async create(@Body() dto: CreateAiCredentialDto): Promise<AiCredentialDto> {
    return this.service.create(dto);
  }

  @Patch(":id")
  @ApiOkResponse({ type: AiCredentialDto })
  @ApiNotFoundResponse({ description: "Not found or not owned by you" })
  @ApiConflictResponse({ description: "Label already used by this user" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAiCredentialDto
  ): Promise<AiCredentialDto> {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Not found or not owned by you" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(":id/test")
  @HttpCode(HttpStatus.OK)
  @Throttle(TEST_THROTTLE)
  @ApiOkResponse({ type: TestResultDto })
  @ApiNotFoundResponse({ description: "Not found or not owned by you" })
  async test(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<TestResultDto> {
    return this.service.test(id);
  }
}
