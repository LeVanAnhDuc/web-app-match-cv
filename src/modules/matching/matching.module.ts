import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { GeminiService } from './gemini.service';

@Module({
  controllers: [MatchingController],
  providers: [MatchingService, GeminiService],
})
export class MatchingModule {}
