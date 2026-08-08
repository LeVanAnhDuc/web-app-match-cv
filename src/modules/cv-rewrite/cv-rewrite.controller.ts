import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags
} from "@nestjs/swagger";
import { DocumentDto } from "../documents/dto/document.dto";
import { CvRewriteService } from "./cv-rewrite.service";
import { AcceptCvRewriteDto } from "./dto/accept-cv-rewrite.dto";
import { CvRewriteProposalDto } from "./dto/cv-rewrite-proposal.dto";
import { GenerateCvRewriteDto } from "./dto/generate-cv-rewrite.dto";

// Tighter than the global 100/60s: every call spends a chat completion on the
// user's key AND is one more time the CV leaves the system.
const GENERATE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

// Accept calls no provider, but it re-grounds every change against the full
// stored CV and writes a copy of it. Both scale with document size, so the
// global 100/60s is too generous a budget for CPU and storage alike.
const ACCEPT_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@ApiTags("cv-rewrite")
@Controller("cv-rewrite")
export class CvRewriteController {
  constructor(private readonly service: CvRewriteService) {}

  // Declared BEFORE any future ":id" route so "accept" is never captured as a param.
  @Post("accept")
  @Throttle(ACCEPT_THROTTLE)
  @ApiCreatedResponse({ type: DocumentDto })
  @ApiBadRequestResponse({
    description: "An approved change is no longer anchored in the original CV."
  })
  async accept(@Body() dto: AcceptCvRewriteDto): Promise<DocumentDto> {
    return this.service.accept(dto);
  }

  @Post()
  @Throttle(GENERATE_THROTTLE)
  @ApiCreatedResponse({ type: CvRewriteProposalDto })
  @ApiNotFoundResponse({ description: "Match result not found." })
  async generate(
    @Body() dto: GenerateCvRewriteDto
  ): Promise<CvRewriteProposalDto> {
    return this.service.generate(dto);
  }
}
