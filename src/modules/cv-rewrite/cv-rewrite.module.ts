import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AiCredentialsModule } from "../ai-credentials/ai-credentials.module";
import { CvRewriteController } from "./cv-rewrite.controller";
import { CvRewriteService } from "./cv-rewrite.service";

/**
 * Depends on Ai + AiCredentials exactly as Matching does; the dependency graph
 * stays one-way. Matching is imported only for the shared `capForMatch` cap,
 * which is a plain function — no provider is pulled from it.
 */
@Module({
  imports: [AiModule, AiCredentialsModule],
  controllers: [CvRewriteController],
  providers: [CvRewriteService]
})
export class CvRewriteModule {}
