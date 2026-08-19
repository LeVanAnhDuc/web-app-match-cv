import { Module } from "@nestjs/common";
import { ComparisonController } from "./comparison.controller";
import { ComparisonService } from "./comparison.service";

/**
 * Deliberately does NOT import AiModule. The absence is the structural proof
 * that opening a comparison cannot reach a provider — see design.md §2.
 * PrismaModule and CurrentUserModule are @Global().
 */
@Module({
  controllers: [ComparisonController],
  providers: [ComparisonService]
})
export class ComparisonModule {}
