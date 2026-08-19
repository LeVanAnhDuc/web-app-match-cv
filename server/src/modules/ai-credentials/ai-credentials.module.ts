import { Module } from "@nestjs/common";
import { CryptoModule } from "../../common/crypto/crypto.module";
import { AiModule } from "../ai/ai.module";
import { AiCredentialsController } from "./ai-credentials.controller";
import { AiCredentialsService } from "./ai-credentials.service";

@Module({
  imports: [CryptoModule, AiModule],
  controllers: [AiCredentialsController],
  providers: [AiCredentialsService],
  exports: [AiCredentialsService]
})
export class AiCredentialsModule {}
