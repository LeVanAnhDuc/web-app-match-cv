import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { AiService } from './ai.service';

@Module({
  controllers: [MatchingController],
  providers: [MatchingService, AiService],
})
export class MatchingModule {}
