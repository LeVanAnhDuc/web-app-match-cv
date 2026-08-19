import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AiCredentialsModule } from "../ai-credentials/ai-credentials.module";
import { CoverLettersController } from "./cover-letters.controller";
import { CoverLettersService } from "./cover-letters.service";

@Module({
  imports: [AiModule, AiCredentialsModule],
  controllers: [CoverLettersController],
  providers: [CoverLettersService]
})
export class CoverLettersModule {}
