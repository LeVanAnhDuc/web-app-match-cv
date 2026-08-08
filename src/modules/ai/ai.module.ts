import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";

/**
 * Infrastructure module with no controller: it owns the provider table and the
 * AI client, and is imported by every feature that needs to call a provider.
 * Keeping it separate from Matching is what stops AiCredentials and Matching
 * from forming an import cycle.
 */
@Module({
  providers: [AiService],
  exports: [AiService]
})
export class AiModule {}
