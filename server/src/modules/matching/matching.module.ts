import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AiCredentialsModule } from "../ai-credentials/ai-credentials.module";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";

@Module({
  imports: [AiModule, AiCredentialsModule],
  controllers: [MatchingController],
  providers: [MatchingService]
})
export class MatchingModule {}
